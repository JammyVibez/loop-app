import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params
  const user = await getUserFromRequest(request).catch(() => null)
  try {
    if (collectionId === "invitations") {
      if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
      const { rows: invitations } = await authDbPool.query(
        `SELECT collection.id::text AS collection_id, collection.title, collection.description,
                collection.owner_id::text AS owner_id, owner.username AS owner_username,
                owner.display_name AS owner_display_name, owner.avatar_url AS owner_avatar_url,
                member.role, member.invited_at, member.expires_at
         FROM collection_members member JOIN collections collection ON collection.id = member.collection_id
         JOIN profiles owner ON owner.id = collection.owner_id
         WHERE member.user_id = $1::uuid AND member.status = 'pending'
           AND member.expires_at > NOW() AND collection.is_collaborative IS TRUE
         ORDER BY member.invited_at DESC LIMIT 50`, [user.id])
      return NextResponse.json(invitations, { headers: { "Cache-Control": "no-store" } })
    }
    const { rows } = await authDbPool.query(
      `SELECT collection.id::text AS id, collection.owner_id::text AS owner_id, collection.title,
              collection.description, collection.visibility, collection.is_collaborative,
              collection.created_at, collection.updated_at, COUNT(item.id)::bigint AS item_count,
              COALESCE($2::uuid IS NOT NULL AND (collection.owner_id = $2::uuid OR
                (collection.is_collaborative IS TRUE AND EXISTS (
                  SELECT 1 FROM collection_members member WHERE member.collection_id = collection.id
                    AND member.user_id = $2::uuid AND member.status = 'active' AND member.role = 'editor'
                ))), false) AS can_edit
       FROM collections collection LEFT JOIN collection_items item ON item.collection_id = collection.id
       WHERE collection.id = $1::uuid AND (collection.visibility IN ('public','unlisted') OR
         ($2::uuid IS NOT NULL AND (collection.owner_id = $2::uuid OR
           (collection.is_collaborative IS TRUE AND EXISTS (
             SELECT 1 FROM collection_members member WHERE member.collection_id = collection.id
               AND member.user_id = $2::uuid AND member.status = 'active'
           ))))) GROUP BY collection.id`,
      [collectionId, user?.id ?? null],
    )
    const collection = rows[0]
    if (!collection) return NextResponse.json({ error: "collection_not_found" }, { status: 404 })
    const { rows: items } = await authDbPool.query(
      `SELECT item.id::text AS id, item.item_type, item.loop_id::text AS loop_id,
              item.circle_id::text AS circle_id, item.chain_id::text AS chain_id,
              item.external_url, item.title_override, item.note, item.position, item.created_at
       FROM collection_items item
       WHERE item.collection_id = $1::uuid AND (
         item.item_type = 'external'
         OR (item.item_type = 'loop' AND EXISTS (
           SELECT 1 FROM loops target WHERE target.id = item.loop_id AND (
             target.visibility = 'public' OR target.author_id::text = $2
             OR (target.visibility = 'circle' AND EXISTS (
               SELECT 1 FROM circle_members member WHERE member.circle_id = target.circle_id
                 AND member.user_id::text = $2 AND member.status IN ('active', 'approved')
             ))
           )
         ))
         OR (item.item_type = 'circle' AND EXISTS (
           SELECT 1 FROM circles target WHERE target.id = item.circle_id
             AND (target.is_premium_only IS NOT TRUE OR EXISTS (
               SELECT 1 FROM profiles viewer WHERE viewer.id::text = $2 AND viewer.is_premium IS TRUE
                 AND (viewer.premium_expires_at IS NULL OR viewer.premium_expires_at > NOW())
             ))
             AND (target.is_private IS FALSE OR target.owner_id::text = $2
               OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = target.id
                 AND member.user_id::text = $2 AND member.status IN ('active', 'approved')))
         ))
         OR (item.item_type = 'chain' AND EXISTS (
           SELECT 1 FROM chains target WHERE target.id = item.chain_id
             AND (target.circle_id IS NULL OR EXISTS (
               SELECT 1 FROM circles scoped WHERE scoped.id = target.circle_id
                 AND (scoped.is_premium_only IS NOT TRUE OR EXISTS (
                   SELECT 1 FROM profiles viewer WHERE viewer.id::text = $2 AND viewer.is_premium IS TRUE
                     AND (viewer.premium_expires_at IS NULL OR viewer.premium_expires_at > NOW())
                 ))
             ))
             AND (target.visibility <> 'circle' OR EXISTS (
               SELECT 1 FROM circles scoped WHERE scoped.id = target.circle_id AND scoped.owner_id::text = $2
             ) OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = target.circle_id
               AND member.user_id::text = $2 AND member.status IN ('active', 'approved')))
             AND (target.creator_id::text = $2
               OR EXISTS (SELECT 1 FROM chain_members member WHERE member.chain_id = target.id AND member.user_id::text = $2)
               OR (target.visibility IN ('public', 'unlisted') AND (target.circle_id IS NULL
                 OR EXISTS (SELECT 1 FROM circles scoped WHERE scoped.id = target.circle_id AND scoped.owner_id::text = $2)
                 OR EXISTS (SELECT 1 FROM circle_members member WHERE member.circle_id = target.circle_id
                   AND member.user_id::text = $2 AND member.status IN ('active', 'approved'))
               ))
               OR (target.visibility = 'circle' AND EXISTS (
                 SELECT 1 FROM circle_members member WHERE member.circle_id = target.circle_id
                   AND member.user_id::text = $2 AND member.status IN ('active', 'approved')
               )))
         ))
       ) ORDER BY item.position, item.created_at LIMIT 200`,
      [collectionId, user?.id ?? null],
    )
    const { rows: collaborators } = collection.is_collaborative
      ? await authDbPool.query(
          `SELECT member.user_id::text AS user_id, profile.username, profile.display_name, profile.avatar_url,
                  member.role, member.joined_at FROM collection_members member
           JOIN profiles profile ON profile.id = member.user_id
           WHERE member.collection_id = $1::uuid AND member.status = 'active' ORDER BY member.joined_at`,
          [collectionId],
        )
      : { rows: [] }
    const canManage = user?.id === collection.owner_id
    const { rows: pending_invitations } = canManage
      ? await authDbPool.query(
          `SELECT member.user_id::text AS user_id, profile.username, profile.display_name, member.role,
                  member.invited_at, member.expires_at FROM collection_members member
           JOIN profiles profile ON profile.id = member.user_id
           WHERE member.collection_id = $1::uuid AND member.status = 'pending' AND member.expires_at > NOW()
           ORDER BY member.invited_at`,
          [collectionId],
        )
      : { rows: [] }
    return NextResponse.json({
      collection: { ...collection, item_count: items.length }, items, collaborators, pending_invitations,
      can_edit: collection.can_edit, can_manage_members: canManage,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[api/v1/collections] detail failed:", error)
    return NextResponse.json({ error: "collections_unavailable", message: "Could not load this collection." }, { status: 503 })
  }
}
