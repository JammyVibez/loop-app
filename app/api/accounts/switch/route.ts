import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"
import { authDbPool } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/accounts/switch
 * Switch to a linked account using the stored Better Auth session token.
 * No password needed — the token is created when the account was first linked.
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

    let storedToken: string | null = null

    if (isPrimary) {
      // Switching back to primary — we need to find the primary user's current session.
      // The simplest approach: verify the current user's own Better Auth session is still
      // valid and return it. If not, they need to log in again.
      const currentToken = request.headers.get("authorization")?.replace("Bearer ", "")
      if (!currentToken) {
        return NextResponse.json(
          { error: "No active session. Please log out and log back in." },
          { status: 400 }
        )
      }

      // Verify the current session token is valid
      const sessionRes = await authDbPool.query(
        'SELECT s.token, s."userId" FROM "session" s WHERE s.token = $1 AND s."expiresAt" > NOW() LIMIT 1;',
        [currentToken]
      )

      if (sessionRes.rows.length === 0) {
        return NextResponse.json(
          { error: "Your session has expired. Please log out and log back in." },
          { status: 400 }
        )
      }

      // Session is valid — the client already has this token, but let's return
      // the profile so the UI can update
      const { data: primaryProfile } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
        .eq("id", user.id)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        session: {
          token: currentToken,
        },
        profile: primaryProfile,
      })
    } else {
      // Switching to a linked account — look up the stored Better Auth session token
      const { data: link } = await supabase
        .from("linked_accounts")
        .select("id, refresh_token")
        .eq("owner_id", user.id)
        .eq("linked_user_id", targetUserId)
        .maybeSingle()

      if (!link) {
        return NextResponse.json({ error: "Account not linked" }, { status: 403 })
      }

      storedToken = (link as any)?.refresh_token || null

      if (!storedToken) {
        return NextResponse.json(
          { error: "No stored session for this account. Please unlink and re-add it." },
          { status: 400 }
        )
      }

      // Verify the stored token is still valid in Better Auth's session table
      const sessionRes = await authDbPool.query(
        'SELECT s.token, s."userId" FROM "session" s WHERE s.token = $1 AND s."expiresAt" > NOW() LIMIT 1;',
        [storedToken]
      )

      if (sessionRes.rows.length === 0) {
        // Token expired — the user needs to re-link. Clear the stale token.
        await supabase
          .from("linked_accounts")
          .update({ refresh_token: null })
          .eq("owner_id", user.id)
          .eq("linked_user_id", targetUserId)

        return NextResponse.json(
          { error: "Session expired. Please unlink this account and add it again." },
          { status: 400 }
        )
      }

      // Token is valid — return it so the client can use it
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
        .eq("id", targetUserId)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        session: {
          token: storedToken,
        },
        profile: targetProfile,
      })
    }
  } catch (error: any) {
    console.error("POST /api/accounts/switch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
