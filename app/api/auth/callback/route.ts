
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      return NextResponse.redirect(new URL('/login?error=auth_error', request.url))
    }

    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (authError || !authData.user) {
      return NextResponse.redirect(new URL('/login?error=auth_error', request.url))
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, onboarding_completed")
      .eq("id", authData.user.id)
      .single()

    // Create profile if it doesn't exist
    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: authData.user.email,
        username: authData.user.user_metadata.preferred_username || authData.user.email?.split('@')[0],
        display_name: authData.user.user_metadata.full_name || authData.user.user_metadata.name,
        avatar_url: authData.user.user_metadata.avatar_url,
        loop_coins: 500,
        xp_points: 0,
        level: 1,
        is_premium: false,
        is_verified: false,
        is_admin: false,
        active_theme: 'default',
        privacy_settings: { profile_visibility: "public", message_privacy: "everyone" },
        notification_settings: { email: true, push: true, in_app: true },
        onboarding_completed: false,
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (profileError) {
        console.error("Profile creation error:", profileError)
        return NextResponse.redirect(new URL('/login?error=profile_error', request.url))
      }

      // Redirect to onboarding for new users
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    // Redirect based on onboarding status
    if (!existingProfile.onboarding_completed) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error("OAuth callback error:", error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
