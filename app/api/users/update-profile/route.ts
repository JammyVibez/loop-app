
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    
    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json()
    const { bio, interests, avatar_url, profile_theme, onboarding_completed } = body

    const payload: Record<string, unknown> = {
      bio,
      interests,
      avatar_url,
      onboarding_completed,
      updated_at: new Date().toISOString(),
    }

    if (profile_theme !== undefined) {
      payload.theme_data = profile_theme
    }

    // Update profile
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select()
      .single()

    // Some DB versions may not have newer onboarding columns yet; retry without them.
    for (const optionalColumn of ["theme_data", "interests"]) {
      if (profileError?.code === "PGRST204" && optionalColumn in payload) {
        delete payload[optionalColumn]
        ;({ data: profile, error: profileError } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", user.id)
          .select()
          .single())
      }
    }

    if (profileError) {
      console.error("Profile update error:", profileError)
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      profile
    })
  } catch (error) {
    console.error("Update profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
