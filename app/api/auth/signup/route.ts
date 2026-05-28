import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use server-side env vars for API routes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, display_name } = await request.json()

    // Validate input
    if (!email || !password || !username || !display_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if username or email is already taken
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id, username, email")
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle()

    if (existingUser?.username === username) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 })
    }
    if (existingUser?.email === email) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    // Create user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    let createdUser = authData.user

    // In local development, Supabase email rate limits can block iterative QA.
    // Fallback to admin createUser so testing can proceed without waiting.
    if (authError) {
      const isDev = process.env.NODE_ENV !== "production"
      const isRateLimited = authError.message.toLowerCase().includes("rate limit")

      if (isDev && isRateLimited) {
        const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
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

    // Create profile using only stable fields.
    // Extra fields should be added later via dedicated migrations/features.
    const { error: profileError } = await supabase.from("profiles").insert({
      id: createdUser.id,
      email,
      username,
      display_name,
      avatar_url: null,
      banner_url: null,
      bio: null,
      loop_coins: 500,
      is_premium: false,
      is_verified: false,
      is_admin: false,
      privacy_settings: { profile_visibility: "public", message_privacy: "everyone" },
      notification_settings: { email: true, push: true, in_app: true },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      // Some deployments auto-create a profile via DB trigger.
      // If that happened first, don't fail signup.
      if (profileError.code === "23505") {
        return NextResponse.json({
          message: "Account created successfully. Please check your email to verify your account.",
          user: {
            id: createdUser.id,
            email,
            username,
            display_name,
          },
        })
      }

      console.error("Profile creation failed after auth signup:", profileError)
      return NextResponse.json(
        {
          error:
            "Account was created but profile setup failed. Please contact support or retry profile setup after login.",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      message: "Account created successfully. Please check your email to verify your account.",
      user: {
        id: createdUser.id,
        email,
        username,
        display_name,
      },
    })
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
