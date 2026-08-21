import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * POST /api/accounts/switch
 * Switch to a linked account by setting the Better Auth session cookie
 * to the raw (unhashed) token stored during linking.
 * Better Auth will hash it and match it against the session table.
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

    // Look up the stored raw session token for this linked account
    const { data: link } = await supabase
      .from("linked_accounts")
      .select("id, refresh_token")
      .eq("owner_id", user.id)
      .eq("linked_user_id", targetUserId)
      .maybeSingle()

    if (!link) {
      return NextResponse.json({ error: "Account not linked" }, { status: 403 })
    }

    const rawToken = (link as any)?.refresh_token || null

    if (!rawToken) {
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

    // Build the response with the Better Auth session cookie set.
    // The raw token is what the browser stores. Better Auth will hash it
    // and look up the matching session row in the DB.
    const res = NextResponse.json({
      success: true,
      profile: targetProfile,
    })

    // Set the Better Auth session cookie with the raw (unhashed) token.
    // This must match what Better Auth's signInEmail sets.
    const isProd = process.env.NODE_ENV === "production"
    res.cookies.set("better-auth.session_token", rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return res
  } catch (error: any) {
    console.error("POST /api/accounts/switch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
