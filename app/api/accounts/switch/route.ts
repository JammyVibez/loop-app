import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * POST /api/accounts/switch
 * Switch to a linked account by replaying the exact Set-Cookie header
 * that Better Auth originally set during linking. This ensures the
 * cookie name, value, path, httpOnly, secure, and all attributes
 * are identical to what Better Auth expects.
 * Body: { user_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const targetUserId = body.user_id

    if (!targetUserId) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const isPrimary = targetUserId === user.id

    if (isPrimary) {
      return NextResponse.json({
        success: true,
        switch_to_primary: true,
        message: "Already on primary account",
      })
    }

    // Look up the stored Set-Cookie header for this linked account
    const { data: link } = await supabase
      .from("linked_accounts")
      .select("id, refresh_token")
      .eq("owner_id", user.id)
      .eq("linked_user_id", targetUserId)
      .maybeSingle()

    if (!link) {
      return NextResponse.json({ error: "Account not linked" }, { status: 403 })
    }

    const storedSetCookie = (link as any)?.refresh_token || null

    if (!storedSetCookie) {
      return NextResponse.json(
        { error: "No stored session. Please unlink and re-add this account." },
        { status: 400 }
      )
    }

    // Get the target profile for the response
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", targetUserId)
      .maybeSingle()

    // Build the response and replay the exact Set-Cookie header.
    // Better Auth set this cookie during signInEmail — same name,
    // same value, same attributes. The browser will apply it exactly.
    const res = NextResponse.json({
      success: true,
      profile: targetProfile,
    })

    // Replay the stored Set-Cookie header exactly as Better Auth set it.
    // This handles cookie name, value, path, httpOnly, secure, sameSite, etc.
    res.headers.set("set-cookie", storedSetCookie)

    return res
  } catch (error: any) {
    console.error("POST /api/accounts/switch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
