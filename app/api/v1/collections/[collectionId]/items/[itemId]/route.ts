import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ collectionId: string; itemId: string }> }) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { collectionId, itemId } = await params
  try {
    const { rows } = await authDbPool.query(
      `DELETE FROM collection_items item USING collections collection
       WHERE item.id = $1::uuid AND item.collection_id = collection.id AND collection.id = $2::uuid
         AND (collection.owner_id = $3::uuid OR (collection.is_collaborative IS TRUE AND EXISTS (
           SELECT 1 FROM collection_members member WHERE member.collection_id = collection.id
             AND member.user_id = $3::uuid AND member.status = 'active' AND member.role = 'editor'
         ))) RETURNING item.id`,
      [itemId, collectionId, user.id],
    )
    return rows.length ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "collection_item_not_found" }, { status: 404 })
  } catch (error) {
    console.error("[api/v1/collections] remove item failed:", error)
    return NextResponse.json({ error: "collection_remove_failed" }, { status: 503 })
  }
}
