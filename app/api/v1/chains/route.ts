import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const SORTS = new Set(["recent", "active", "contributions"])
const KINDS = new Set(["story", "worldbuilding", "ranking", "playlist", "gallery", "challenge", "project", "recommendations", "open"])
const POLICIES = new Set(["open", "members", "circle_members"])
const VISIBILITIES = new Set(["public", "unlisted", "private", "circle"])

type ChainRow = {
  id: string
  creator_id: string
  creator_username: string | null
  creator_display_name: string | null
  creator_avatar_url: string | null
  circle_id: string | null
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
         chain.circle_id::text AS circle_id,
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
           (
             chain.visibility IN ('public', 'circle')
             AND (chain.circle_id IS NULL
               OR EXISTS (SELECT 1 FROM circles circle WHERE circle.id = chain.circle_id AND circle.owner_id::text = $1)
               OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = chain.circle_id
                 AND member.user_id::text = $1 AND member.status IN ('active', 'approved')))
           )
           OR ($1::text IS NOT NULL AND (
             chain.visibility <> 'circle'
             OR EXISTS (SELECT 1 FROM circles circle WHERE circle.id = chain.circle_id AND circle.owner_id::text = $1)
             OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = chain.circle_id
               AND member.user_id::text = $1 AND member.status IN ('active', 'approved'))
           ) AND (chain.creator_id::text = $1 OR EXISTS (
             SELECT 1 FROM chain_members member WHERE member.chain_id = chain.id AND member.user_id::text = $1
           )))
         )
         AND ($2::text IS NULL OR chain.kind = $2::text)
         AND ($3::text IS NULL OR chain.category = $3::text)
         AND ($4::text IS NULL OR chain.circle_id::text = $4::text)
         AND ($5::text IS NULL OR chain.creator_id::text = $5::text)
         AND ($6::text IS NULL OR chain.title ILIKE '%' || $6::text || '%'
           OR chain.description ILIKE '%' || $6::text || '%' OR chain.prompt ILIKE '%' || $6::text || '%')
       ORDER BY
         CASE WHEN $7::text = 'recent' THEN chain.created_at END DESC,
         CASE WHEN $7::text = 'active' THEN chain.updated_at END DESC,
         CASE WHEN $7::text = 'contributions' THEN chain.contribution_count END DESC,
         chain.updated_at DESC
       LIMIT $8 OFFSET $9`,
      [viewerId, kind, category, circleId, creatorId, search, sort, limit + 1, offset],
    )

    const hasMore = rows.length > limit
    rows.length = Math.min(rows.length, limit)
    return NextResponse.json(
      {
        chains: rows.map((row) => ({
          ...row,
          description: row.description || "",
          prompt: row.prompt || "",
          contribution_count: Number(row.contribution_count || 0),
          participant_count: Number(row.participant_count || 0),
        })),
        limit,
        offset,
        has_more: hasMore,
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

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to create a Chain." }, { status: 401 })
  let input: Record<string, unknown>
  try { input = await request.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }

  const title = typeof input.title === "string" ? input.title.trim() : ""
  const description = typeof input.description === "string" ? input.description.trim() : ""
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : ""
  const kind = typeof input.kind === "string" ? input.kind.trim().toLowerCase() : "open"
  const category = typeof input.category === "string" ? input.category.trim().toLowerCase() : "general"
  const visibility = typeof input.visibility === "string" ? input.visibility.trim().toLowerCase() : "public"
  const policy = typeof input.contribution_policy === "string" ? input.contribution_policy.trim().toLowerCase() : "open"
  const circleId = typeof input.circle_id === "string" && input.circle_id ? input.circle_id : null
  const sourceDropId = typeof input.source_drop_id === "string" && input.source_drop_id ? input.source_drop_id : null
  const cover = typeof input.cover_image_url === "string" && input.cover_image_url.trim() ? input.cover_image_url.trim() : null
  const metadata = input.metadata ?? {}
  if (Object.keys(input).some((key) => !["title", "description", "prompt", "kind", "category", "visibility", "contribution_policy", "circle_id", "source_drop_id", "cover_image_url", "metadata"].includes(key))) {
    return NextResponse.json({ error: "invalid_chain_input", message: "Chain input contains unsupported fields." }, { status: 422 })
  }
  if (!title || title.length > 120 || description.length > 2000 || prompt.length > 1200) {
    return NextResponse.json({ error: "invalid_chain_text", message: "Title, description or prompt is outside its allowed length." }, { status: 422 })
  }
  if (!KINDS.has(kind) || !POLICIES.has(policy) || !VISIBILITIES.has(visibility) || !category || category.length > 40) {
    return NextResponse.json({ error: "invalid_chain_settings", message: "Choose a supported Chain format, visibility and contribution policy." }, { status: 422 })
  }
  if ((visibility === "circle") !== Boolean(circleId)) {
    return NextResponse.json({ error: "invalid_circle_scope", message: "Circle visibility requires a Circle." }, { status: 422 })
  }
  if (cover && (!/^https:\/\//i.test(cover) || cover.length > 2048)) {
    return NextResponse.json({ error: "invalid_chain_cover", message: "Cover images must use HTTPS." }, { status: 422 })
  }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object" || "origin" in metadata || JSON.stringify(metadata).length > 32768) {
    return NextResponse.json({ error: "invalid_chain_metadata", message: "Chain metadata must be a JSON object no larger than 32 KiB." }, { status: 422 })
  }
  if (sourceDropId && !circleId) return NextResponse.json({ error: "drop_origin_requires_circle", message: "A Circle Drop Chain must remain inside its Circle." }, { status: 422 })

  const client = await authDbPool.connect()
  try {
    await client.query("BEGIN")
    if (circleId) {
      const { rows } = await client.query(
        `SELECT 1 FROM circles circle WHERE circle.id = $1::uuid AND (circle.owner_id = $2::uuid OR EXISTS (
          SELECT 1 FROM circle_members member WHERE member.circle_id = circle.id AND member.user_id = $2::uuid
            AND member.status IN ('active', 'approved')
        ))`, [circleId, user.id])
      if (!rows.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "circle_membership_required" }, { status: 403 }) }
    }
    let finalMetadata = metadata
    if (sourceDropId && circleId) {
      const { rows } = await client.query(
        "SELECT title FROM circle_challenges WHERE id = $1::uuid AND circle_id = $2::uuid", [sourceDropId, circleId])
      if (!rows.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "source_drop_not_found" }, { status: 404 }) }
      finalMetadata = { ...metadata, origin: { type: "circle_challenge", id: sourceDropId, circle_id: circleId, title: rows[0].title } }
    }
    const { rows } = await client.query(
      `INSERT INTO chains (creator_id, circle_id, title, description, prompt, kind, category, visibility,
          contribution_policy, cover_image_url, metadata)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING id::text AS id, creator_id::text AS creator_id, circle_id::text AS circle_id,
         source_chain_id::text AS source_chain_id, title, description, prompt, kind, category, visibility,
         contribution_policy, status, cover_image_url, metadata, contribution_count, participant_count,
         created_at, updated_at`,
      [user.id, circleId, title, description, prompt, kind, category, visibility, policy, cover, JSON.stringify(finalMetadata)],
    )
    const chain = rows[0]
    await client.query("INSERT INTO chain_members (chain_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'owner') ON CONFLICT DO NOTHING", [chain.id, user.id])
    const { rows: profiles } = await client.query("SELECT username, display_name, avatar_url FROM profiles WHERE id = $1::uuid", [user.id])
    await client.query("COMMIT")
    return NextResponse.json({ ...chain, creator_username: profiles[0]?.username || user.user_metadata.username || "", creator_display_name: profiles[0]?.display_name || user.user_metadata.display_name || "", creator_avatar_url: profiles[0]?.avatar_url || user.user_metadata.avatar_url || null }, { status: 201 })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    console.error("[api/v1/chains] create failed:", error)
    return NextResponse.json({ error: "chain_create_failed", message: "Could not create this Chain." }, { status: 503 })
  } finally {
    client.release()
  }
}
