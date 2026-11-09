import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

type CollectionRow = {
  id: string
  owner_id: string
  title: string
  description: string
  visibility: "private" | "unlisted" | "public"
  is_collaborative: boolean
  item_count: number | string
  created_at: string
  updated_at: string
}

function collectionSummary(row: CollectionRow) {
  return { ...row, item_count: Number(row.item_count || 0) }
}

function errorResponse(error: unknown, message: string) {
  console.error("[api/v1/collections] request failed:", error)
  return NextResponse.json({ error: "collections_unavailable", message }, { status: 503 })
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request).catch(() => null)
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "24", 10) || 24, 1), 50)
  const offset = Math.min(Math.max(Number.parseInt(searchParams.get("offset") || "0", 10) || 0, 0), 1_000_000)
  const ownerId = searchParams.get("owner_id") || null
  const search = (searchParams.get("search") || "").trim() || null

  try {
    const { rows } = await authDbPool.query<CollectionRow>(
      `SELECT collection.id::text AS id,
              collection.owner_id::text AS owner_id,
              collection.title, collection.description, collection.visibility,
              collection.is_collaborative, COUNT(item.id)::bigint AS item_count,
              collection.created_at, collection.updated_at
       FROM collections AS collection
       LEFT JOIN collection_items AS item ON item.collection_id = collection.id
       WHERE (
         collection.visibility = 'public'
         OR ($1::uuid IS NOT NULL AND (
           collection.owner_id = $1::uuid
           OR (collection.is_collaborative IS TRUE AND EXISTS (
             SELECT 1 FROM collection_members AS member
             WHERE member.collection_id = collection.id
               AND member.user_id = $1::uuid AND member.status = 'active'
           ))
         ))
       )
       AND ($2::uuid IS NULL OR collection.owner_id = $2::uuid)
       AND ($3::text IS NULL OR collection.title ILIKE '%' || $3 || '%' OR collection.description ILIKE '%' || $3 || '%')
       GROUP BY collection.id
       ORDER BY collection.updated_at DESC
       LIMIT $4 OFFSET $5`,
      [user?.id ?? null, ownerId, search, limit, offset],
    )
    return NextResponse.json(rows.map(collectionSummary), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return errorResponse(error, "Could not load collections.")
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to create a collection." }, { status: 401 })

  let input: { title?: unknown; description?: unknown; visibility?: unknown; is_collaborative?: unknown }
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Send a valid collection." }, { status: 400 })
  }

  const title = typeof input.title === "string" ? input.title.trim() : ""
  const description = typeof input.description === "string" ? input.description.trim() : ""
  const visibility = input.visibility ?? "private"
  if (!title || title.length > 80) {
    return NextResponse.json({ error: "invalid_title", message: "Collection titles must contain 1 to 80 characters." }, { status: 422 })
  }
  if (description.length > 500) {
    return NextResponse.json({ error: "description_too_long", message: "Collection descriptions cannot exceed 500 characters." }, { status: 422 })
  }
  if (visibility !== "private" && visibility !== "unlisted" && visibility !== "public") {
    return NextResponse.json({ error: "invalid_visibility", message: "Visibility must be private, unlisted or public." }, { status: 422 })
  }

  try {
    const { rows } = await authDbPool.query<CollectionRow>(
      `INSERT INTO collections (owner_id, title, description, visibility, is_collaborative)
       VALUES ($1::uuid, $2, $3, $4, $5)
       RETURNING id::text AS id, owner_id::text AS owner_id, title, description,
                 visibility, is_collaborative, 0::bigint AS item_count, created_at, updated_at`,
      [user.id, title, description, visibility, input.is_collaborative === true],
    )
    return NextResponse.json(collectionSummary(rows[0]), { status: 201 })
  } catch (error) {
    return errorResponse(error, "Could not create the collection.")
  }
}
