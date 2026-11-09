import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"
const TYPES = new Set(["text", "image", "video", "audio", "link", "list", "ranking", "poll", "document"])

export async function POST(request: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to contribute." }, { status: 401 })
  const { chainId } = await params
  let body: Record<string, any>
  try { body = await request.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }
  const type = typeof body.contribution_type === "string" ? body.contribution_type.trim().toLowerCase() : "text"
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {}
  if (!TYPES.has(type) || title.length > 120 || content.length > 8000 || JSON.stringify(payload).length > 65536) {
    return NextResponse.json({ error: "invalid_contribution", message: "Contribution fields are invalid or too long." }, { status: 422 })
  }
  if (!title && !content && Object.keys(payload).length === 0) return NextResponse.json({ error: "empty_contribution" }, { status: 422 })
  if (["image", "video", "audio", "document", "link"].includes(type)) {
    try { if (new URL(payload.url).protocol !== "https:") throw new Error() } catch { return NextResponse.json({ error: "invalid_contribution_url", message: "Links and media must use HTTPS." }, { status: 422 }) }
  }
  if (type === "list" || type === "ranking") {
    if (!Array.isArray(payload.items) || payload.items.length < 2 || payload.items.length > 40 || payload.items.some((entry: unknown) => typeof entry !== "string" || !entry.trim() || entry.length > 240)) {
      return NextResponse.json({ error: "invalid_structured_entries" }, { status: 422 })
    }
  }
  if (type === "poll" && (!content || !Array.isArray(payload.options) || payload.options.length < 2 || payload.options.length > 10 || payload.options.some((entry: unknown) => typeof entry !== "string" || !entry.trim() || entry.length > 160))) {
    return NextResponse.json({ error: "invalid_poll_contribution" }, { status: 422 })
  }

  const client = await authDbPool.connect()
  try {
    await client.query("BEGIN")
    const { rows: chains } = await client.query(
      `SELECT chain.id, chain.creator_id, chain.circle_id, chain.contribution_policy,
              chain.visibility, chain.status FROM chains chain WHERE chain.id = $1::uuid FOR UPDATE`, [chainId])
    const chain = chains[0]
    if (!chain) { await client.query("ROLLBACK"); return NextResponse.json({ error: "chain_not_found" }, { status: 404 }) }
    if (chain.status !== "active") { await client.query("ROLLBACK"); return NextResponse.json({ error: "chain_not_active" }, { status: 409 }) }
    const { rows: membership } = await client.query(
      "SELECT role FROM chain_members WHERE chain_id = $1::uuid AND user_id = $2::uuid", [chainId, user.id])
    const role = membership[0]?.role as string | undefined
    const isCreator = chain.creator_id === user.id
    const { rows: circleOwner } = chain.circle_id
      ? await client.query("SELECT 1 FROM circles WHERE id = $1::uuid AND owner_id = $2::uuid", [chain.circle_id, user.id])
      : { rows: [] }
    const { rows: circleMembership } = chain.circle_id
      ? await client.query("SELECT 1 FROM circle_members WHERE circle_id = $1::uuid AND user_id = $2::uuid AND status IN ('active','approved')", [chain.circle_id, user.id])
      : { rows: [] }
    const inCircle = circleOwner.length > 0 || circleMembership.length > 0
    if (chain.visibility === "circle" && !inCircle) { await client.query("ROLLBACK"); return NextResponse.json({ error: "chain_access_denied" }, { status: 403 }) }
    const mayContribute = (chain.visibility !== "circle" || inCircle) && (
      isCreator || ["owner", "collaborator", "contributor"].includes(role || "")
      || (role !== "viewer" && chain.contribution_policy === "open" && ["public", "unlisted"].includes(chain.visibility) && (!chain.circle_id || inCircle))
      || (role !== "viewer" && chain.contribution_policy === "circle_members" && inCircle)
    )
    if (!mayContribute) { await client.query("ROLLBACK"); return NextResponse.json({ error: "chain_contribution_restricted" }, { status: 403 }) }

    const parentId = typeof body.parent_contribution_id === "string" ? body.parent_contribution_id : null
    if (parentId) {
      const { rows } = await client.query("SELECT 1 FROM chain_contributions WHERE id = $1::uuid AND chain_id = $2::uuid AND status = 'published'", [parentId, chainId])
      if (!rows.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "invalid_contribution_parent" }, { status: 422 }) }
    }
    const { rows: positionRows } = await client.query("SELECT COALESCE(MAX(position), 0) + 1 AS position FROM chain_contributions WHERE chain_id = $1::uuid", [chainId])
    const { rows } = await client.query(
      `INSERT INTO chain_contributions (chain_id, author_id, parent_contribution_id, contribution_type, title, content, payload, position)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NULLIF($5,''), $6, $7::jsonb, $8)
       RETURNING id::text AS id, chain_id::text AS chain_id, author_id::text AS author_id,
         parent_contribution_id::text AS parent_contribution_id, contribution_type, title, content,
         payload, position, created_at`,
      [chainId, user.id, parentId, type, title, content, JSON.stringify(payload), positionRows[0].position])
    await client.query("INSERT INTO chain_members (chain_id, user_id, role) VALUES ($1::uuid,$2::uuid,'contributor') ON CONFLICT DO NOTHING", [chainId, user.id])
    await client.query(
      `UPDATE chains SET contribution_count = (SELECT COUNT(*) FROM chain_contributions WHERE chain_id = $1::uuid AND status = 'published'),
         participant_count = (SELECT COUNT(*) FROM chain_members WHERE chain_id = $1::uuid), updated_at = NOW()
       WHERE id = $1::uuid`, [chainId])
    const { rows: profile } = await client.query("SELECT username, display_name, avatar_url FROM profiles WHERE id = $1::uuid", [user.id])
    await client.query("COMMIT")
    return NextResponse.json({ contribution: { ...rows[0], author_username: profile[0]?.username || user.user_metadata.username || "", author_display_name: profile[0]?.display_name || user.user_metadata.display_name || "", author_avatar_url: profile[0]?.avatar_url || null } }, { status: 201 })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    console.error("[api/v1/chains] contribution failed:", error)
    return NextResponse.json({ error: "chain_contribution_failed", message: "Could not add this contribution." }, { status: 503 })
  } finally {
    client.release()
  }
}
