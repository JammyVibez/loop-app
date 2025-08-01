import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Sign in user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user || !authData.session) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Login successful",
      session: authData.session,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        banner_url: profile.banner_url,
        bio: profile.bio,
        loop_coins: profile.loop_coins,
        is_premium: profile.is_premium,
        is_verified: profile.is_verified,
        is_admin: profile.is_admin,
        theme_data: profile.theme_data,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
