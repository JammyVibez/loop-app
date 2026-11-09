import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { collectionId } = await params
  const input = await request.json().catch(() => ({}))
  const username = typeof input.username === "string" ? input.username.trim().replace(/^@/, "") : ""
  const role = input.role === "editor" || input.role === "viewer" ? input.role : null
  if (!username || username.length > 50 || !role) return NextResponse.json({ error: "invalid_collection_member" }, { status: 422 })
  try {
    const { rows } = await authDbPool.query(
      `INSERT INTO collection_members (collection_id, user_id, role, invited_by, status, invited_at, expires_at)
       SELECT collection.id, invitee.id, $4, $2::uuid, 'pending', NOW(), NOW() + INTERVAL '30 days'
       FROM collections collection JOIN profiles invitee ON lower(invitee.username) = lower($3)
       WHERE collection.id = $1::uuid AND collection.owner_id = $2::uuid AND collection.is_collaborative IS TRUE
       ON CONFLICT (collection_id, user_id) DO UPDATE SET role = EXCLUDED.role,
         invited_by = EXCLUDED.invited_by, invited_at = NOW(), expires_at = NOW() + INTERVAL '30 days',
         status = CASE WHEN collection_members.status = 'active' THEN 'active' ELSE 'pending' END
       RETURNING collection_id::text AS collection_id, user_id::text AS user_id, role, status, expires_at`,
      [collectionId, user.id, username, role],
    )
    if (!rows.length) return NextResponse.json({ error: "collection_member_unavailable" }, { status: 404 })
    return NextResponse.json({ ...rows[0], username })
  } catch (error) {
    console.error("[api/v1/collections] invite member failed:", error)
    return NextResponse.json({ error: "collection_invitation_failed" }, { status: 503 })
  }
}
