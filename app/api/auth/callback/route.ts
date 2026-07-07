import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { createClient, type User as SupabaseUser } from "@supabase/supabase-js"

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null
  return next
}

function fallbackUsername(user: SupabaseUser) {
  return (
    user.user_metadata?.username ||
    user.user_metadata?.preferred_username ||
    user.email?.split("@")[0] ||
    `user_${user.id.slice(0, 8)}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
}

async function ensureProfile(user: SupabaseUser) {
  const { data: existingProfile } = await serviceSupabase
    .from("profiles")
    .select("id, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle()

  if (existingProfile) return existingProfile

  const username = fallbackUsername(user)
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
    .select("id, onboarding_completed")
    .single()

  if (error) {
    throw error
  }

  return createdProfile
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_error", request.url))
  }

  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = []
  const supabase = createServerClient(
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

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user) {
      console.error("Auth callback exchange error:", error)
      return NextResponse.redirect(new URL("/login?error=auth_error", request.url))
    }

    const profile = await ensureProfile(data.user)
    const destination = nextPath || (profile?.onboarding_completed ? "/" : "/onboarding")
    const response = NextResponse.redirect(new URL(destination, request.url))

    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  } catch (error) {
    console.error("OAuth callback error:", error)
    return NextResponse.redirect(new URL("/login?error=server_error", request.url))
  }
}
