import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * Lightweight current-user profile for auth hydration.
 * Avoids the heavy /api/users/profile payload (loops, counts, etc).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, email, username, display_name, avatar_url, banner_url, bio, loop_coins, is_premium, premium_expires_at, is_verified, is_admin, theme_data, interests, onboarding_completed, location, website",
      )
      .eq("id", user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, profile })
  } catch (error: any) {
    console.error("auth/me error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
