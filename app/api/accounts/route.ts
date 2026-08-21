import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * GET /api/accounts
 * Returns all accounts linked to the current user (the primary + linked ones).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Get the primary user's profile
    const { data: primaryProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", user.id)
      .maybeSingle()

    // Get linked accounts
    const { data: links, error: linkError } = await supabase
      .from("linked_accounts")
      .select("id, linked_user_id, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })

    if (linkError && linkError.code === "42P01") {
      // Table doesn't exist yet — return just primary
      return NextResponse.json({
        success: true,
        accounts: primaryProfile ? [{ ...primaryProfile, is_primary: true, link_id: null }] : [],
        max_accounts: (user as any).is_premium ? 10 : 2,
        current_count: 1,
      })
    }

    // Fetch profiles for linked accounts
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
      max_accounts: (user as any).is_premium ? 10 : 2,
      current_count: accounts.length,
    })
  } catch (error: any) {
    console.error("GET /api/accounts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/accounts
 * Link an existing account to the current user's account.
 * Body: { email: string, password: string }
 * The user must sign in to the target account first to get a session, OR
 * we re-authenticate them with email+password to obtain the target user ID.
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

    const isPremium = (profile as any)?.is_premium ?? false
    const maxAccounts = isPremium ? 10 : 2
    const currentCount = (existingLinks?.length || 0) + 1 // +1 for primary

    if (currentCount >= maxAccounts) {
      return NextResponse.json(
        {
          error: isPremium
            ? `Pro accounts are limited to ${maxAccounts} linked accounts`
            : `Free accounts are limited to ${maxAccounts} accounts. Upgrade to Pro for up to ${10}`,
        },
        { status: 400 }
      )
    }

    // Authenticate the target account using the service-role client
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Use the admin auth API to sign in the target user
    const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ email: targetEmail, password: targetPassword }),
    })

    const authData = await authRes.json()

    if (!authRes.ok || !authData?.user?.id) {
      return NextResponse.json({ error: "Invalid credentials for the target account" }, { status: 400 })
    }

    const targetUserId = authData.user.id

    // Can't link yourself to yourself
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot link your own account" }, { status: 400 })
    }

    // Check if this account is already linked
    const { data: alreadyLinked } = await supabase
      .from("linked_accounts")
      .select("id")
      .eq("owner_id", user.id)
      .eq("linked_user_id", targetUserId)
      .maybeSingle()

    if (alreadyLinked) {
      return NextResponse.json({ error: "Account already linked" }, { status: 400 })
    }

    // Check if the target user is already the owner of another link group
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

    // Insert the link
    const { data: link, error: insertError } = await supabase
      .from("linked_accounts")
      .insert({
        owner_id: user.id,
        linked_user_id: targetUserId,
        created_at: new Date().toISOString(),
      })
      .select("id, linked_user_id")
      .single()

    if (insertError) {
      console.error("linked_accounts insert error:", insertError)
      return NextResponse.json({ error: "Failed to link account" }, { status: 500 })
    }

    // Fetch the target profile to return
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified")
      .eq("id", targetUserId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      account: {
        ...targetProfile,
        is_primary: false,
        link_id: link.id,
      },
    })
  } catch (error: any) {
    console.error("POST /api/accounts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/accounts
 * Unlink an account. Body: { link_id: string } or { linked_user_id: string }
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
