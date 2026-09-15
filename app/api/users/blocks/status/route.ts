import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { checkBlockStatus } from "@/lib/user-blocks"

export const dynamic = "force-dynamic"

/**
 * GET /api/users/blocks/status?target_user_id=...
 * Used by profile / DM UI to decide whether to show Block or Unblock.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("target_user_id")
    if (!targetUserId) {
      return NextResponse.json({ error: "target_user_id is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const status = await checkBlockStatus(supabase, user.id, targetUserId)
    return NextResponse.json({ success: true, ...status })
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
