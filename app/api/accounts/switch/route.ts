import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"
import { auth, authDbPool } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/accounts/switch
 * Switch to a linked account by creating a fresh Better Auth session
 * and setting the cookie via the response, just like the login route does.
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
      // Already on primary — return the current session token so client
      // can verify, but no cookie change needed.
      return NextResponse.json({
        success: true,
        switch_to_primary: true,
        message: "Already on primary account",
      })
    }

    // Verify the link exists
    const { data: link } = await supabase
      .from("linked_accounts")
      .select("id, refresh_token")
      .eq("owner_id", user.id)
      .eq("linked_user_id", targetUserId)
      .maybeSingle()

    if (!link) {
      return NextResponse.json({ error: "Account not linked" }, { status: 403 })
    }

    const storedToken = (link as any)?.refresh_token || null

    if (!storedToken) {
      return NextResponse.json(
        { error: "No stored session. Please unlink and re-add this account." },
        { status: 400 }
      )
    }

    // Verify the stored token is still valid in Better Auth's session table
    const sessionRes = await authDbPool.query(
      'SELECT s.token, s."userId" FROM "session" s WHERE s.token = $1 LIMIT 1;',
      [storedToken]
    )

    if (sessionRes.rows.length === 0) {
      await supabase
        .from("linked_accounts")
        .update({ refresh_token: null })
        .eq("owner_id", user.id)
        .eq("linked_user_id", targetUserId)

      return NextResponse.json(
        { error: "Session expired. Please unlink and re-add this account." },
        { status: 400 }
      )
    }

    // Get the target user's email so we can create a new session via Better Auth
    const targetUserRes = await authDbPool.query(
      'SELECT id, email FROM "user" WHERE id = $1 LIMIT 1;',
      [targetUserId]
    )
    const targetUser = targetUserRes.rows[0]
    if (!targetUser?.email) {
      return NextResponse.json({ error: "Target account not found" }, { status: 404 })
    }

    // Delete any existing sessions for the target user to avoid stale sessions
    await authDbPool.query(
      'DELETE FROM "session" WHERE "userId" = $1;',
      [targetUserId]
    ).catch(() => {})

    // Create a new session for the target user via Better Auth's signInEmail
    // We need the password to do this. Since we don't store passwords,
    // instead create a new session row directly and set the cookie.
    //
    // Better approach: Use Better Auth's internal API to create a session.
    // Since auth.api.signInEmail needs password and we don't have it,
    // we'll create the session row directly and set the cookie.

    const { v4: uuidv4 } = await import("uuid")
    const sessionToken = uuidv4().replace(/-/g, "")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Insert the session into Better Auth's session table
    await authDbPool.query(
      `INSERT INTO "session" (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [uuidv4(), sessionToken, targetUserId, expiresAt.toISOString()]
    )

    // Get the target profile for the response
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", targetUserId)
      .maybeSingle()

    // Build the response with the session cookie set, just like the login route
    const res = NextResponse.json({
      success: true,
      session: {
        access_token: sessionToken,
        token: sessionToken,
      },
      profile: targetProfile,
    })

    // Set the Better Auth session cookie — must match the name Better Auth uses.
    // middleware.ts checks for cookie.name.includes("better-auth")
    const cookieName = "better-auth.session_token"
    const isProd = process.env.NODE_ENV === "production"
    res.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "lax" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return res
  } catch (error: any) {
    console.error("POST /api/accounts/switch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
