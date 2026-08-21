import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Use service-role client to bypass RLS for linked_accounts queries
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Extract the raw session token value from a Set-Cookie header string.
 * Better Auth sets: better-auth.session_token=<token>; Path=/; ...
 * We need just the <token> value.
 */
function extractRawToken(setCookieHeader: string): string | null {
  if (!setCookieHeader) return null
  // Could be multiple Set-Cookie lines joined by commas
  const lines = setCookieHeader.split(/,\s*(?=better-auth)/)
  for (const line of lines) {
    const match = line.match(/better-auth\.session_token=([^;]+)/)
    if (match) return match[1].trim()
  }
  return null
}

/**
 * GET /api/accounts
 * Returns all accounts linked to the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const admin = getAdminClient()

    // Check if current user is a linked user (not the owner)
    const { data: asLinked } = await admin
      .from("linked_accounts")
      .select("id, owner_id, created_at")
      .eq("linked_user_id", user.id)
      .limit(1)
      .maybeSingle()

    const isLinkedUser = Boolean(asLinked)
    const ownerId = isLinkedUser ? asLinked!.owner_id : user.id

    const { data: primaryProfile } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", ownerId)
      .maybeSingle()

    // Query all links for this owner
    const { data: links, error: linkError } = await admin
      .from("linked_accounts")
      .select("id, linked_user_id, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true })

    if (linkError && linkError.code === "42P01") {
      return NextResponse.json({
        success: true,
        accounts: primaryProfile ? [{ ...primaryProfile, is_primary: true, link_id: null }] : [],
        max_accounts: (primaryProfile as any)?.is_premium ? 10 : 2,
        current_count: 1,
      })
    }

    const linkedIds = (links || []).map((l) => l.linked_user_id)
    let linkedProfiles: any[] = []

    if (linkedIds.length > 0) {
      const { data } = await admin
        .from("profiles")
        .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
        .in("id", linkedIds)
      linkedProfiles = data || []
    }

    const accounts = [
      ...(primaryProfile ? [{ ...primaryProfile, is_primary: true, link_id: null }] : []),
      ...linkedProfiles.map((p) => ({
        ...p,
        is_primary: false,
        link_id: links?.find((l) => l.linked_user_id === p.id)?.id || null,
      })),
    ]

    // Mark the currently active account (the one being used right now)
    const activeAccounts = accounts.map((a) => ({
      ...a,
      is_primary: a.id === user.id, // The currently logged-in account is "active"
    }))

    return NextResponse.json({
      success: true,
      accounts: activeAccounts,
      max_accounts: (primaryProfile as any)?.is_premium ? 10 : 2,
      current_count: activeAccounts.length,
    })
  } catch (error: any) {
    console.error("GET /api/accounts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/accounts
 * Link an existing account using Better Auth sign-in.
 * Body: { email, password }
 *
 * Stores raw session tokens for both accounts so switching is one-click:
 * - refresh_token: linked user's raw session token (for switching TO them)
 * - primary_session: primary user's raw session token (for switching BACK)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const targetEmail = body.email?.trim()
    const targetPassword = body.password

    if (!targetEmail || !targetPassword) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })
    }

    const admin = getAdminClient()

    // Check how many accounts the user already has linked
    const { data: existingLinks } = await admin
      .from("linked_accounts")
      .select("id")
      .eq("owner_id", user.id)

    // Get profile to check premium status
    const { data: profile } = await admin
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .maybeSingle()

    const isPremium = Boolean((profile as any)?.is_premium)
    const maxAccounts = isPremium ? 10 : 2
    const currentCount = (existingLinks?.length || 0) + 1

    if (currentCount >= maxAccounts) {
      return NextResponse.json(
        {
          error: isPremium
            ? `Pro accounts are limited to ${maxAccounts} linked accounts`
            : `Free accounts are limited to ${maxAccounts} accounts. Upgrade to Pro for up to 10`,
        },
        { status: 400 }
      )
    }

    // Use Better Auth to sign in as the target user to create a session
    const authRes = await auth.api.signInEmail({
      body: {
        email: targetEmail,
        password: targetPassword,
      },
      asResponse: true,
      headers: request.headers,
    })

    if (!authRes.ok) {
      const errData = await authRes.json().catch(() => ({}))
      return NextResponse.json({ error: errData.message || "Invalid credentials for the target account" }, { status: 400 })
    }

    const authData = await authRes.json()
    const targetUserId = authData.user?.id || authData.session?.user?.id

    if (!targetUserId) {
      return NextResponse.json({ error: "Could not authenticate target account" }, { status: 400 })
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot link your own account" }, { status: 400 })
    }

    // Extract the raw session token from the linked user's signInEmail response
    const linkedSetCookie = authRes.headers.get("set-cookie") || ""
    const linkedRawToken = extractRawToken(linkedSetCookie)
    if (!linkedRawToken) {
      return NextResponse.json({ error: "Failed to create session for target account" }, { status: 500 })
    }

    // Extract the primary user's raw session token from the request cookie
    const rawCookieHeader = request.headers.get("cookie") || ""
    const cookieMatch = rawCookieHeader.match(/better-auth\.session_token=([^;]+)/)
    const primaryRawToken = cookieMatch ? cookieMatch[1] : ""

    // Check if already linked
    const { data: alreadyLinked } = await admin
      .from("linked_accounts")
      .select("id")
      .eq("owner_id", user.id)
      .eq("linked_user_id", targetUserId)
      .maybeSingle()

    if (alreadyLinked) {
      return NextResponse.json({ error: "Account already linked" }, { status: 400 })
    }

    // Check if target is already an owner
    const { data: targetAsOwner } = await admin
      .from("linked_accounts")
      .select("id")
      .eq("owner_id", targetUserId)
      .maybeSingle()

    if (targetAsOwner) {
      return NextResponse.json(
        { error: "This account is already linked to another primary account" },
        { status: 400 }
      )
    }

    // Store raw session tokens (not full Set-Cookie headers)
    const { data: link, error: insertError } = await admin
      .from("linked_accounts")
      .insert({
        owner_id: user.id,
        linked_user_id: targetUserId,
        refresh_token: linkedRawToken,
        primary_session: primaryRawToken,
        created_at: new Date().toISOString(),
      })
      .select("id, linked_user_id")
      .single()

    if (insertError) {
      console.error("linked_accounts insert error:", insertError)
      return NextResponse.json({ error: "Failed to link account" }, { status: 500 })
    }

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", targetUserId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      account: { ...targetProfile, is_primary: false, link_id: link.id },
      has_session: true,
    })
  } catch (error: any) {
    console.error("POST /api/accounts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/accounts
 * Unlink an account. Body: { link_id, linked_user_id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { link_id, linked_user_id } = body

    if (!link_id && !linked_user_id) {
      return NextResponse.json({ error: "link_id or linked_user_id required" }, { status: 400 })
    }

    const admin = getAdminClient()

    let query = admin.from("linked_accounts").delete().eq("owner_id", user.id)

    if (link_id) {
      query = query.eq("id", link_id)
    } else if (linked_user_id) {
      query = query.eq("linked_user_id", linked_user_id)
    }

    const { error } = await query

    if (error) {
      console.error("linked_accounts delete error:", error)
      return NextResponse.json({ error: "Failed to unlink account" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("DELETE /api/accounts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
