import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"
type Context = { params: Promise<{ chainId: string }> }

function paging(search: string | null, fallback: number, max: number) {
  const value = Number.parseInt(search || "", 10)
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : fallback
}

export async function GET(request: NextRequest, { params }: Context) {
  const { chainId } = await params
  const user = await getUserFromRequest(request).catch(() => null)
  const { searchParams } = new URL(request.url)
  const limit = Math.min(paging(searchParams.get("limit"), 40, 100), 100) || 40
  const offset = paging(searchParams.get("offset"), 0, 1_000_000)
  try {
    const { rows } = await authDbPool.query(
      `SELECT chain.id::text AS id, chain.creator_id::text AS creator_id,
              creator.username AS creator_username, creator.display_name AS creator_display_name,
              creator.avatar_url AS creator_avatar_url, chain.circle_id::text AS circle_id,
              chain.source_chain_id::text AS source_chain_id, chain.title, chain.description,
              chain.prompt, chain.kind, chain.category, chain.visibility, chain.contribution_policy,
              chain.status, chain.cover_image_url, chain.metadata, chain.contribution_count,
              chain.participant_count, chain.created_at, chain.updated_at,
              COALESCE($2::uuid IS NOT NULL AND (
                chain.creator_id = $2::uuid OR EXISTS (
                  SELECT 1 FROM chain_members member WHERE member.chain_id = chain.id
                    AND member.user_id = $2::uuid AND member.role IN ('owner','collaborator','contributor')
                ) OR (chain.status = 'active' AND chain.contribution_policy = 'open'
                  AND chain.visibility IN ('public','unlisted') AND (
                    chain.circle_id IS NULL OR EXISTS (
                      SELECT 1 FROM circles circle WHERE circle.id = chain.circle_id AND circle.owner_id = $2::uuid
                    ) OR EXISTS (
                      SELECT 1 FROM circle_members member WHERE member.circle_id = chain.circle_id
                        AND member.user_id = $2::uuid AND member.status IN ('active','approved')
                    )
                  )
                ) OR (chain.status = 'active' AND chain.contribution_policy = 'circle_members' AND (
                  EXISTS (SELECT 1 FROM circles circle WHERE circle.id = chain.circle_id AND circle.owner_id = $2::uuid)
                  OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = chain.circle_id
                    AND member.user_id = $2::uuid AND member.status IN ('active','approved'))
                ))
              ), false) AS can_contribute,
              COALESCE($2::uuid IS NOT NULL AND (chain.creator_id = $2::uuid OR EXISTS (
                SELECT 1 FROM chain_members member WHERE member.chain_id = chain.id
                  AND member.user_id = $2::uuid AND member.role = 'owner'
              )), false) AS can_manage
       FROM chains chain JOIN profiles creator ON creator.id = chain.creator_id
       WHERE chain.id = $1::uuid AND (
         (chain.visibility IN ('public','unlisted') AND (chain.circle_id IS NULL OR
           EXISTS (SELECT 1 FROM circles circle WHERE circle.id = chain.circle_id AND circle.owner_id = $2::uuid)
           OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = chain.circle_id
             AND member.user_id = $2::uuid AND member.status IN ('active','approved'))))
         OR (chain.visibility = 'circle' AND $2::uuid IS NOT NULL AND (
           EXISTS (SELECT 1 FROM circles circle WHERE circle.id = chain.circle_id AND circle.owner_id = $2::uuid)
           OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = chain.circle_id
             AND member.user_id = $2::uuid AND member.status IN ('active','approved'))))
         OR ($2::uuid IS NOT NULL AND chain.visibility IN ('private','unlisted') AND (
           chain.creator_id = $2::uuid OR EXISTS (
             SELECT 1 FROM chain_members member WHERE member.chain_id = chain.id AND member.user_id = $2::uuid
           )) AND (chain.circle_id IS NULL OR EXISTS (
             SELECT 1 FROM circles circle WHERE circle.id = chain.circle_id AND circle.owner_id = $2::uuid
           ) OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = chain.circle_id
             AND member.user_id = $2::uuid AND member.status IN ('active','approved'))))
       )`,
      [chainId, user?.id ?? null],
    )
    const chain = rows[0]
    if (!chain) return NextResponse.json({ error: "chain_not_found", message: "This Chain is unavailable." }, { status: 404 })

    const { rows: contributionRows } = await authDbPool.query(
      `SELECT contribution.id::text AS id, contribution.chain_id::text AS chain_id,
              contribution.author_id::text AS author_id, profile.username AS author_username,
              profile.display_name AS author_display_name, profile.avatar_url AS author_avatar_url,
              contribution.parent_contribution_id::text AS parent_contribution_id,
              contribution.contribution_type, contribution.title, contribution.content,
              contribution.payload, contribution.position, contribution.created_at
       FROM chain_contributions contribution JOIN profiles profile ON profile.id = contribution.author_id
       WHERE contribution.chain_id = $1::uuid AND contribution.status = 'published'
       ORDER BY contribution.position LIMIT $2 OFFSET $3`,
      [chainId, limit + 1, offset],
    )
    const hasMore = contributionRows.length > limit
    const contributions = contributionRows.slice(0, limit)
    const { rows: members } = chain.can_manage
      ? await authDbPool.query(
          `SELECT member.user_id::text AS user_id, profile.username,
                  COALESCE(profile.display_name, profile.username) AS display_name,
                  profile.avatar_url, member.role, member.joined_at
           FROM chain_members member JOIN profiles profile ON profile.id = member.user_id
           WHERE member.chain_id = $1::uuid
           ORDER BY CASE member.role WHEN 'owner' THEN 0 WHEN 'collaborator' THEN 1 WHEN 'contributor' THEN 2 ELSE 3 END, member.joined_at`,
          [chainId],
        )
      : { rows: [] }

    return NextResponse.json({
      chain: { ...chain, contribution_count: Number(chain.contribution_count || 0), participant_count: Number(chain.participant_count || 0) },
      contributions,
      can_contribute: chain.can_contribute,
      can_manage: chain.can_manage,
      members,
      contributions_limit: limit,
      contributions_offset: offset,
      contributions_has_more: hasMore,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[api/v1/chains] detail failed:", error)
    return NextResponse.json({ error: "chain_load_failed", message: "Could not load this Chain." }, { status: 503 })
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { chainId } = await params
  const input = await request.json().catch(() => null)
  if (!input || typeof input !== "object") return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  const title = typeof input.title === "string" ? input.title.trim() : null
  const description = typeof input.description === "string" ? input.description.trim() : null
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : null
  const status = typeof input.status === "string" ? input.status.trim() : null
  if (title !== null && (!title || title.length > 120)) return NextResponse.json({ error: "invalid_chain_title" }, { status: 422 })
  if (description !== null && description.length > 2000 || prompt !== null && prompt.length > 1200) return NextResponse.json({ error: "chain_text_too_long" }, { status: 422 })
  if (status !== null && !["active", "paused", "completed", "archived"].includes(status)) return NextResponse.json({ error: "invalid_chain_status" }, { status: 422 })
  if (title === null && description === null && prompt === null && status === null) return NextResponse.json({ error: "empty_chain_update" }, { status: 400 })
  try {
    const { rows } = await authDbPool.query(
      `UPDATE chains SET title = COALESCE($3, title), description = COALESCE($4, description),
         prompt = COALESCE($5, prompt), status = COALESCE($6, status), updated_at = NOW()
       WHERE id = $1::uuid AND (creator_id = $2::uuid OR EXISTS (
         SELECT 1 FROM chain_members member WHERE member.chain_id = chains.id
           AND member.user_id = $2::uuid AND member.role = 'owner'
       )) AND ($6::text IS NULL OR status = $6 OR
         (status = 'active' AND $6 IN ('active','paused','completed','archived')) OR
         (status = 'paused' AND $6 IN ('paused','active','completed','archived')) OR
         (status = 'completed' AND $6 IN ('completed','archived')) OR
         (status = 'archived' AND $6 = 'archived'))
       RETURNING id::text AS id, creator_id::text AS creator_id, circle_id::text AS circle_id,
         source_chain_id::text AS source_chain_id, title, description, prompt, kind, category, visibility,
         contribution_policy, status, cover_image_url, metadata, contribution_count, participant_count, created_at, updated_at`,
      [chainId, user.id, title, description, prompt, status],
    )
    const chain = rows[0]
    if (!chain) return NextResponse.json({ error: "chain_not_found" }, { status: 404 })
    const { rows: profile } = await authDbPool.query("SELECT username, display_name, avatar_url FROM profiles WHERE id = $1::uuid", [user.id])
    return NextResponse.json({ ...chain, creator_username: profile[0]?.username || "", creator_display_name: profile[0]?.display_name || "", creator_avatar_url: profile[0]?.avatar_url || null })
  } catch (error) {
    console.error("[api/v1/chains] update failed:", error)
    return NextResponse.json({ error: "chain_update_failed" }, { status: 503 })
  }
}
