import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { deleteAccountAsAdmin } from "@/lib/admin-delete-account"

export const dynamic = "force-dynamic"

// POST: Admin deletes a user account (auth login revoked, profile masked).
export async function POST(req: NextRequest) {
  try {
    const { user, response } = await requireAdmin(req)
    if (response) return response

    const body = await req.json().catch(() => ({}))
    const userId = body?.user_id as string | undefined

    const result = await deleteAccountAsAdmin({
      actorId: user!.id,
      targetId: userId,
      reason: body?.reason,
    })

    if (!result.ok) {
      const status = result.error === "User not found" ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      success: true,
      message: `Account for @${result.username} has been deleted.`,
    })
  } catch (err: any) {
    console.error("[admin/delete-account] error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
