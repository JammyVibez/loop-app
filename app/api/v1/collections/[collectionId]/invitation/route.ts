import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { collectionId } = await params
  const input = await request.json().catch(() => ({}))
  if (input.action !== "accept" && input.action !== "decline") {
    return NextResponse.json({ error: "invalid_collection_invitation_action", message: "Choose accept or decline." }, { status: 422 })
  }
  try {
    const { rows } = await authDbPool.query(
      `UPDATE collection_members member SET status = $3,
         accepted_at = CASE WHEN $3 = 'active' THEN NOW() ELSE member.accepted_at END
       FROM collections collection
       WHERE member.collection_id = $1::uuid AND member.user_id = $2::uuid
         AND collection.id = member.collection_id AND collection.is_collaborative IS TRUE
         AND member.status = 'pending' AND member.expires_at > NOW()
       RETURNING member.collection_id`,
      [collectionId, user.id, input.action === "accept" ? "active" : "declined"],
    )
    return rows.length ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "collection_invitation_not_found" }, { status: 404 })
  } catch (error) {
    console.error("[api/v1/collections] respond to invitation failed:", error)
    return NextResponse.json({ error: "collection_invitation_failed" }, { status: 503 })
  }
}
