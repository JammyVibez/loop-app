import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * POST /api/accounts/switch
 * Switch to a linked account using stored refresh token (no password needed).
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

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!anonKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    let refreshToken: string | null = null

    if (isPrimary) {
      // Switching back to primary — look for the refresh token stored
      // when any linked account was added (the back-link stores it)
      const { data: backLink } = await supabase
        .from("linked_accounts")
        .select("refresh_token")
        .eq("linked_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      refreshToken = (backLink as any)?.refresh_token || null

      if (!refreshToken) {
        return NextResponse.json(
          { error: "No stored session for primary account. Please log out and log back in." },
          { status: 400 }
        )
      }
    } else {
      // Switching to a linked account — use the stored refresh token
      const { data: link } = await supabase
        .from("linked_accounts")
        .select("id, refresh_token")
        .eq("owner_id", user.id)
        .eq("linked_user_id", targetUserId)
        .maybeSingle()

      if (!link) {
        return NextResponse.json({ error: "Account not linked" }, { status: 403 })
      }

      refreshToken = (link as any)?.refresh_token || null
      if (!refreshToken) {
        return NextResponse.json(
          { error: "No stored session for this account. Please unlink and re-add it." },
          { status: 400 }
        )
      }
    }

    // Use the refresh token with the ANON key (not service role) to get a new session
    const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    const authData = await authRes.json()

    if (!authRes.ok || !authData?.session) {
      // Token expired — try re-linking hint
      return NextResponse.json(
        { error: "Session expired. Please unlink this account and add it again." },
        { status: 400 }
      )
    }

    // Update the stored refresh token with the new one (refresh tokens rotate)
    if (!isPrimary) {
      await supabase
        .from("linked_accounts")
        .update({ refresh_token: authData.session.refresh_token })
        .eq("owner_id", user.id)
        .eq("linked_user_id", targetUserId)
    } else {
      // Update all back-links with the new primary refresh token
      await supabase
        .from("linked_accounts")
        .update({ refresh_token: authData.session.refresh_token })
        .eq("linked_user_id", user.id)
    }

    // Get the target profile
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", isPrimary ? user.id : targetUserId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
      },
      profile: targetProfile,
    })
  } catch (error: any) {
    console.error("POST /api/accounts/switch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
