import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase"
import { ECONOMY_DEFAULTS } from "@/lib/economy"

export const dynamic = "force-dynamic"

function normalizeUsername(username: string) {
  return username.toLowerCase().replace(/[^a-z0-9_]/g, "")
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, display_name, invited_via_coloop, invited_by_username } = await request.json()
    const cleanUsername = normalizeUsername(username || "")
    const displayName = String(display_name || "").trim()

    if (!email || !password || !cleanUsername || !displayName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (cleanUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id, username, email")
      .or(`username.eq.${cleanUsername},email.eq.${email}`)
      .maybeSingle()

    if (existingUser?.username === cleanUsername) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 })
    }
    if (existingUser?.email === email) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    const signUpResult = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: displayName,
      },
      asResponse: true,
      headers: request.headers,
    })

    if (!signUpResult.ok) {
      const errData = await signUpResult.json().catch(() => ({}))
      return NextResponse.json({ error: errData.message || "Failed to create account" }, { status: 400 })
    }

    const signUpData = await signUpResult.json()
    const createdUser = signUpData.user || signUpData.session?.user

    if (!createdUser) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 400 })
    }

    // Auto-assign unique animated PFP and cover for new users
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "")
    const defaultAvatar = `${baseUrl}/api/default-avatar?id=${encodeURIComponent(createdUser.id)}&name=${encodeURIComponent(displayName)}`
    const defaultBanner = `${baseUrl}/api/default-avatar?id=${encodeURIComponent(createdUser.id)}&name=${encodeURIComponent(displayName)}&type=banner`

    const profilePayload = {
      id: createdUser.id,
      email,
      username: cleanUsername,
      display_name: displayName,
      avatar_url: defaultAvatar,
      banner_url: defaultBanner,
      bio: null,
      loop_coins: ECONOMY_DEFAULTS.signup_bonus,
      is_premium: false,
      is_verified: false,
      is_admin: false,
      privacy_settings: { profile_visibility: "public", message_privacy: "everyone" },
      notification_settings: { email: true, push: true, in_app: true },
      onboarding_completed: false,
      invited_via_coloop: Boolean(invited_via_coloop),
      invited_by_username: invited_by_username ? String(invited_by_username).toLowerCase().trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: profileUpsertError } = await supabase.from("profiles").upsert(profilePayload)
    if (profileUpsertError) {
      // Don't fail the signup — the Better Auth account already exists and
      // the user can still sign in. Surface this loudly server-side though,
      // since a missing profile row breaks most of the app for this user
      // until it's backfilled (e.g. via a misconfigured service role key).
      console.error("Signup: failed to create profile row for", createdUser.id, profileUpsertError)
    }

    const token = signUpData.token || signUpData.session?.token || signUpData.session?.id || createdUser.id

    const res = NextResponse.json({
      message: "Account created successfully",
      session: {
        access_token: token,
        refresh_token: token,
        user: {
          ...createdUser,
          username: cleanUsername,
          display_name: displayName,
          onboarding_completed: false,
        },
      },
      user: {
        ...createdUser,
        username: cleanUsername,
        display_name: displayName,
        onboarding_completed: false,
      },
    })

    const setCookieHeader = signUpResult.headers.get("set-cookie")
    if (setCookieHeader) {
      res.headers.set("set-cookie", setCookieHeader)
    }

    return res
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
