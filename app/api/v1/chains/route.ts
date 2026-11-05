import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Chain list for the community, explore and profile surfaces.
 *
 * Those screens call `/api/v1/chains`, which only the Rust service serves, and
 * next.config proxies `/api/v1/*` only when RUST_API_ORIGIN is set. On a
 * deployment without it the request fell through to Next's 404 page, so the
 * clients were parsing HTML and the community's Chain rail stayed empty. This
 * serves the same JSON contract from Postgres.
 */

const SORTS = new Set(["recent", "active", "contributions"])

type ChainRow = {
  id: string
  creator_id: string
  creator_username: string | null
  creator_display_name: string | null
  creator_avatar_url: string | null
  circle_id: number | null
  source_chain_id: string | null
  title: string
  description: string | null
  prompt: string | null
  kind: string | null
  category: string | null
  visibility: string | null
  contribution_policy: string | null
  status: string | null
  cover_image_url: string | null
  metadata: unknown
  contribution_count: number | string | null
  participant_count: number | string | null
  created_at: string
  updated_at: string
}

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = intParam(searchParams.get("limit"), 24, 1, 50)
  const offset = intParam(searchParams.get("offset"), 0, 0, 1_000_000)
  const sort = searchParams.get("sort") || "recent"
  if (!SORTS.has(sort)) {
    return NextResponse.json(
      { error: "invalid_chain_sort", message: "Sort must be recent, active or contributions." },
      { status: 400 },
    )
  }

  const user = await getUserFromRequest(request).catch(() => null)
  const viewerId = user?.id ?? null
  const circleId = searchParams.get("circle_id") || null
  const creatorId = searchParams.get("creator_id") || null
  const kind = searchParams.get("kind") || null
  const category = searchParams.get("category") || null
  const search = searchParams.get("search") || null

  try {
    const { rows } = await authDbPool.query<ChainRow>(
      `SELECT
         chain.id::text AS id,
         chain.creator_id::text AS creator_id,
         creator.username AS creator_username,
         creator.display_name AS creator_display_name,
         creator.avatar_url AS creator_avatar_url,
         chain.circle_id,
         chain.source_chain_id::text AS source_chain_id,
         chain.title,
         chain.description,
         chain.prompt,
         chain.kind,
         chain.category,
         chain.visibility,
         chain.contribution_policy,
         chain.status,
         chain.cover_image_url,
         chain.metadata,
         chain.contribution_count,
         chain.participant_count,
         chain.created_at,
         chain.updated_at
       FROM chains AS chain
       JOIN profiles AS creator ON creator.id = chain.creator_id
       WHERE chain.status IN ('active', 'completed')
         AND (
           chain.visibility IN ('public', 'circle')
           AND (
             chain.circle_id IS NULL
             OR EXISTS (
               SELECT 1 FROM circle_members AS member
               WHERE member.circle_id = chain.circle_id
                 AND member.user_id::text = $1
                 AND member.status IN ('active', 'approved')
             )
           )
         )
         AND ($2::text IS NULL OR chain.kind = $2::text)
         AND ($3::text IS NULL OR chain.category = $3::text)
         AND ($4::text IS NULL OR chain.circle_id::text = $4::text)
         AND ($5::text IS NULL OR chain.creator_id::text = $5::text)
         AND (
           $6::text IS NULL
           OR chain.title ILIKE '%' || $6::text || '%'
           OR chain.description ILIKE '%' || $6::text || '%'
           OR chain.prompt ILIKE '%' || $6::text || '%'
         )
       ORDER BY
         CASE WHEN $7::text = 'recent' THEN chain.created_at END DESC,
         CASE WHEN $7::text = 'active' THEN chain.updated_at END DESC,
         CASE WHEN $7::text = 'contributions' THEN chain.contribution_count END DESC,
         chain.updated_at DESC
       LIMIT $8 OFFSET $9`,
      [viewerId, kind, category, circleId, creatorId, search, sort, limit, offset],
    )

    return NextResponse.json(
      {
        chains: rows.map((row) => ({
          ...row,
          contribution_count: Number(row.contribution_count || 0),
          participant_count: Number(row.participant_count || 0),
        })),
        limit,
        offset,
        has_more: rows.length === limit,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("[api/v1/chains] list failed:", error)
    return NextResponse.json(
      { error: "chains_unavailable", message: "Chains are unavailable right now." },
      { status: 503 },
    )
  }
}
