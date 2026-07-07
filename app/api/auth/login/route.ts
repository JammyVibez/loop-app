import { type NextRequest, NextResponse } from "next/server"
import { createClient, type User as SupabaseUser } from "@supabase/supabase-js"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function createAuthClient(request: NextRequest, pendingCookies: Array<{ name: string; value: string; options: CookieOptions }>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    },
  )
}

async function ensureProfile(user: SupabaseUser) {
  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (profile) return profile

  const username = user.user_metadata?.username || user.user_metadata?.preferred_username || user.email?.split("@")[0] || "user"
  const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || username

  const { data: createdProfile, error } = await serviceSupabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      username,
      display_name: displayName,
      avatar_url: user.user_metadata?.avatar_url || null,
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
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return createdProfile
}

export async function POST(request: NextRequest) {
  try {
    const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = []
    const supabase = createAuthClient(request, pendingCookies)
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.error("Auth error:", authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 })
    }

    const profile = await ensureProfile(authData.user)

    const response = NextResponse.json({
      message: "Login successful",
      session: authData.session,
      user: { ...authData.user, ...profile },
    })

    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
