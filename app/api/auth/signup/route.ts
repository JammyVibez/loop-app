import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getAppUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
}

function normalizeUsername(username: string) {
  return username.toLowerCase().replace(/[^a-z0-9_]/g, "")
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, display_name } = await request.json()
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

    const metadata = {
      username: cleanUsername,
      display_name: displayName,
      full_name: displayName,
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${getAppUrl(request)}/api/auth/callback`,
      },
    })

    let createdUser = authData.user

    if (authError) {
      const isDev = process.env.NODE_ENV !== "production"
      const isRateLimited = authError.message.toLowerCase().includes("rate limit")

      if (isDev && isRateLimited) {
        const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: metadata,
        })

        if (adminError) {
          return NextResponse.json({ error: adminError.message }, { status: 400 })
        }

        createdUser = adminData.user ?? null
      } else {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    if (!createdUser) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 400 })
    }

    const profilePayload = {
      id: createdUser.id,
      email,
      username: cleanUsername,
      display_name: displayName,
      avatar_url: null,
      banner_url: null,
      bio: null,
      loop_coins: 500,
      is_premium: false,
      is_verified: false,
      is_admin: false,
      privacy_settings: { profile_visibility: "public", message_privacy: "everyone" },
      notification_settings: { email: true, push: true, in_app: true },
      onboarding_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: profileError } = await supabase.from("profiles").insert(profilePayload)

    if (profileError) {
      if (profileError.code === "23505") {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            email,
            username: cleanUsername,
            display_name: displayName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", createdUser.id)

        if (updateError) {
          console.error("Profile update after trigger failed:", updateError)
          return NextResponse.json({ error: "Username or email is already in use" }, { status: 400 })
        }
      } else {
        console.error("Profile creation failed after auth signup:", profileError)
        return NextResponse.json(
          { error: "Account was created but profile setup failed. Please contact support or retry profile setup after login." },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      message: "Account created successfully. Please check your email to verify your account.",
      user: {
        id: createdUser.id,
        email,
        username: cleanUsername,
        display_name: displayName,
      },
    })
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
