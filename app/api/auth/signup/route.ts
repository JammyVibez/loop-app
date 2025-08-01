import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, display_name } = await request.json()

    // Validate input
    if (!email || !password || !username || !display_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if username is already taken
    const { data: existingUser } = await supabase.from("profiles").select("username").eq("username", username).single()

    if (existingUser) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 })
    }

    // Create user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 400 })
    }

    // Create user profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email,
      username,
      display_name,
      loop_coins: 500, // Starting coins
      is_premium: false,
      is_verified: false,
      is_admin: false,
      created_at: new Date().toISOString(),
    })

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
    }

    return NextResponse.json({
      message: "Account created successfully. Please check your email to verify your account.",
      user: {
        id: authData.user.id,
        email,
        username,
        display_name,
      },
    })
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
