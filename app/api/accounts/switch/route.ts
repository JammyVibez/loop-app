import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * POST /api/accounts/switch
 * Switch to a linked account by signing a new session for that user.
 * Body: { user_id: string, password: string }
 *
 * This re-authenticates as the target user and returns a new session token
 * the client can use to become that user.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const targetUserId = body.user_id
    const password = body.password

    if (!targetUserId) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Verify the target account is linked to the current user
    const { data: link } = await supabase
      .from("linked_accounts")
      .select("id")
      .eq("owner_id", user.id)
      .eq("linked_user_id", targetUserId)
      .maybeSingle()

    // Also allow switching back to the primary (yourself)
    const isPrimary = targetUserId === user.id

    if (!link && !isPrimary) {
      return NextResponse.json({ error: "Account not linked" }, { status: 403 })
    }

    // Get the target profile to find their email
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, email, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", targetUserId)
      .maybeSingle()

    if (!targetProfile) {
      return NextResponse.json({ error: "Target profile not found" }, { status: 404 })
    }

    // If switching back to primary, we need the password
    if (isPrimary) {
      if (!password) {
        return NextResponse.json(
          { error: "Password required to switch back to primary account" },
          { status: 400 }
        )
      }
    }

    // If switching to a linked account, we need the password for that account
    if (!isPrimary && !password) {
      return NextResponse.json(
        { error: "Password required to switch accounts" },
        { status: 400 }
      )
    }

    // Re-authenticate as the target user using their email + password
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Get the email for the target user
    const targetEmail = targetProfile.email || (targetProfile as any).email

    if (!targetEmail) {
      return NextResponse.json({ error: "Cannot determine target account email" }, { status: 500 })
    }

    // We need to get the target user's email from the auth system
    const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ email: targetEmail, password }),
    })

    const authData = await authRes.json()

    if (!authRes.ok || !authData?.session) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 })
    }

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
