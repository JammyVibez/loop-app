import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/accounts
 * Returns all accounts linked to the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    const { data: primaryProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", user.id)
      .maybeSingle()

    const { data: links, error: linkError } = await supabase
      .from("linked_accounts")
      .select("id, linked_user_id, created_at")
      .eq("owner_id", user.id)
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
      const { data } = await supabase
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

    return NextResponse.json({
      success: true,
      accounts,
      max_accounts: (primaryProfile as any)?.is_premium ? 10 : 2,
      current_count: accounts.length,
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
 * Stores the FULL Set-Cookie header from Better Auth for exact replay
 * during account switching — no token parsing or cookie construction needed.
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

    const supabase = createServerClient()

    // Check how many accounts the user already has linked
    const { data: existingLinks } = await supabase
      .from("linked_accounts")
      .select("id")
      .eq("owner_id", user.id)

    // Get profile to check premium status
    const { data: profile } = await supabase
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

    // Use Better Auth to sign in as the target user.
    // This creates a proper session and returns Set-Cookie headers.
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

    // Extract the FULL Set-Cookie header from Better Auth's response.
    // We store this raw so during switching we can replay it exactly —
    // no need to parse or reconstruct cookies ourselves.
    const setCookieHeader = authRes.headers.get("set-cookie") || ""

    if (!setCookieHeader) {
      return NextResponse.json({ error: "Failed to create session for target account" }, { status: 500 })
    }

    // Check if already linked
    const { data: alreadyLinked } = await supabase
      .from("linked_accounts")
      .select("id")
      .eq("owner_id", user.id)
      .eq("linked_user_id", targetUserId)
      .maybeSingle()

    if (alreadyLinked) {
      return NextResponse.json({ error: "Account already linked" }, { status: 400 })
    }

    // Check if target is already an owner
    const { data: targetAsOwner } = await supabase
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

    // Store the FULL Set-Cookie header for exact replay during switching
    const { data: link, error: insertError } = await supabase
      .from("linked_accounts")
      .insert({
        owner_id: user.id,
        linked_user_id: targetUserId,
        refresh_token: setCookieHeader,
        created_at: new Date().toISOString(),
      })
      .select("id, linked_user_id")
      .single()

    if (insertError) {
      console.error("linked_accounts insert error:", insertError)
      return NextResponse.json({ error: "Failed to link account" }, { status: 500 })
    }

    const { data: targetProfile } = await supabase
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

    const supabase = createServerClient()

    let query = supabase.from("linked_accounts").delete().eq("owner_id", user.id)

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
