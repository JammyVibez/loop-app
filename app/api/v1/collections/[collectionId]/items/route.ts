import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { collectionId } = await params
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }
  const type = body.item_type
  const keys = ["loop_id", "circle_id", "chain_id"].filter((key) => typeof body[key] === "string" && body[key])
  const external = typeof body.external_url === "string" ? body.external_url.trim() : ""
  let safeExternal = false
  if (external) {
    try {
      const url = new URL(external)
      safeExternal = url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password && external.length <= 2048
    } catch {
      safeExternal = false
    }
  }
  const valid = (type === "loop" && keys.length === 1 && keys[0] === "loop_id" && !external)
    || (type === "circle" && keys.length === 1 && keys[0] === "circle_id" && !external)
    || (type === "chain" && keys.length === 1 && keys[0] === "chain_id" && !external)
    || (type === "external" && keys.length === 0 && safeExternal)
  const title = typeof body.title_override === "string" ? body.title_override.trim() : ""
  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (!valid || title.length > 160 || note.length > 500) {
    return NextResponse.json({ error: "invalid_collection_item", message: "Choose a valid item and keep its title and note within the limits." }, { status: 422 })
  }

  const client = await authDbPool.connect()
  try {
    await client.query("BEGIN")
    const { rows: editable } = await client.query(
      `SELECT 1 FROM collections collection WHERE collection.id = $1::uuid AND (
        collection.owner_id = $2::uuid OR (collection.is_collaborative IS TRUE AND EXISTS (
          SELECT 1 FROM collection_members member WHERE member.collection_id = collection.id
            AND member.user_id = $2::uuid AND member.status = 'active' AND member.role = 'editor'
        ))) FOR UPDATE`, [collectionId, user.id])
    if (!editable.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "collection_not_found" }, { status: 404 }) }

    if (type !== "external") {
      const table = type === "loop" ? "loops" : type === "circle" ? "circles" : "chains"
      const idKey = type === "loop" ? "loop_id" : type === "circle" ? "circle_id" : "chain_id"
      let visibility = "target.visibility = 'public' OR target.creator_id = $2::uuid OR target.owner_id = $2::uuid"
      if (type === "loop") visibility = "target.visibility = 'public' OR target.author_id = $2::uuid OR (target.visibility = 'circle' AND EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = target.circle_id AND member.user_id = $2::uuid AND member.status IN ('active','approved')))"
      if (type === "circle") visibility = "(target.is_premium_only IS NOT TRUE OR EXISTS (SELECT 1 FROM profiles viewer WHERE viewer.id = $2::uuid AND viewer.is_premium IS TRUE AND (viewer.premium_expires_at IS NULL OR viewer.premium_expires_at > NOW()))) AND (target.is_private IS FALSE OR target.owner_id = $2::uuid OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = target.id AND member.user_id = $2::uuid AND member.status IN ('active','approved')))"
      if (type === "chain") visibility = "(target.circle_id IS NULL OR EXISTS (SELECT 1 FROM circles scoped WHERE scoped.id = target.circle_id AND (scoped.is_premium_only IS NOT TRUE OR EXISTS (SELECT 1 FROM profiles viewer WHERE viewer.id = $2::uuid AND viewer.is_premium IS TRUE AND (viewer.premium_expires_at IS NULL OR viewer.premium_expires_at > NOW()))))) AND (target.visibility <> 'circle' OR EXISTS (SELECT 1 FROM circles scoped WHERE scoped.id = target.circle_id AND scoped.owner_id = $2::uuid) OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = target.circle_id AND member.user_id = $2::uuid AND member.status IN ('active','approved'))) AND (target.creator_id = $2::uuid OR EXISTS (SELECT 1 FROM chain_members member WHERE member.chain_id = target.id AND member.user_id = $2::uuid) OR (target.visibility IN ('public','unlisted') AND (target.circle_id IS NULL OR EXISTS (SELECT 1 FROM circles scoped WHERE scoped.id = target.circle_id AND scoped.owner_id = $2::uuid) OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = target.circle_id AND member.user_id = $2::uuid AND member.status IN ('active','approved')))) OR (target.visibility = 'circle' AND EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = target.circle_id AND member.user_id = $2::uuid AND member.status IN ('active','approved')))"
      const { rows: target } = await client.query(`SELECT 1 FROM ${table} target WHERE target.id = $1::uuid AND (${visibility})`, [body[idKey], user.id])
      if (!target.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "collection_target_unavailable" }, { status: 404 }) }
    }

    const { rows } = await client.query(
      `INSERT INTO collection_items (collection_id, added_by, item_type, loop_id, circle_id, chain_id, external_url, title_override, note, position)
       VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid, $7, NULLIF($8,''), NULLIF($9,''),
         (SELECT COALESCE(MAX(position), -1) + 1 FROM collection_items WHERE collection_id = $1::uuid))
       RETURNING id::text AS id, item_type, loop_id::text AS loop_id, circle_id::text AS circle_id,
         chain_id::text AS chain_id, external_url, title_override, note, position, created_at`,
      [collectionId, user.id, type, body.loop_id || null, body.circle_id || null, body.chain_id || null, external || null, title, note],
    )
    await client.query("COMMIT")
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    if ((error as { code?: string })?.code === "23505") return NextResponse.json({ error: "item_already_saved" }, { status: 409 })
    console.error("[api/v1/collections] add item failed:", error)
    return NextResponse.json({ error: "collection_add_failed", message: "Could not add this item." }, { status: 503 })
  } finally {
    client.release()
  }
}
