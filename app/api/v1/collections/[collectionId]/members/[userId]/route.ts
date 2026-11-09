import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ collectionId: string; userId: string }> }) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { collectionId, userId } = await params
  try {
    const { rows } = await authDbPool.query(
      `DELETE FROM collection_members member USING collections collection
       WHERE member.collection_id = collection.id AND collection.id = $1::uuid
         AND member.user_id = $2::uuid AND member.user_id <> collection.owner_id
         AND (collection.owner_id = $3::uuid OR member.user_id = $3::uuid)
       RETURNING member.user_id`, [collectionId, userId, user.id])
    return rows.length ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "collection_member_not_found" }, { status: 404 })
  } catch (error) {
    console.error("[api/v1/collections] remove member failed:", error)
    return NextResponse.json({ error: "collection_member_update_failed" }, { status: 503 })
  }
}
