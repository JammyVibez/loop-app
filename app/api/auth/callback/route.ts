import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
undefined
import { ECONOMY_DEFAULTS } from "@/lib/economy"

export const dynamic = "force-dynamic"

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
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
      loop_coins: ECONOMY_DEFAULTS.signup_bonus,
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

function authErrorRedirect(request: NextRequest, code: string, reason?: string | null) {
  const url = new URL("/login", request.url)
  url.searchParams.set("error", code)
  if (reason) url.searchParams.set("reason", reason.slice(0, 300))
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"))

  // Supabase/Google redirect back with these when the OAuth provider itself
  // rejects the request (e.g. provider not enabled, redirect URI mismatch,
  // user denied consent). Surface the real reason instead of a generic error.
  const oauthError = requestUrl.searchParams.get("error")
  const oauthErrorDescription = requestUrl.searchParams.get("error_description")
  if (oauthError) {
    console.error("OAuth provider error on callback:", oauthError, oauthErrorDescription)
    return authErrorRedirect(request, "oauth_error", oauthErrorDescription || oauthError)
  }

  if (!code) {
    return authErrorRedirect(request, "auth_error", "No authorization code was returned by the provider.")
  }

  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
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
      return authErrorRedirect(request, "auth_error", error?.message)
    }

    const profile = await ensureProfile(data.user)
    // Prefer explicit next. Default incomplete users to onboarding (email verify paused).
    const destination =
      nextPath ||
      (profile?.onboarding_completed ? "/" : "/onboarding")
    const response = NextResponse.redirect(new URL(destination, request.url))

    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  } catch (error) {
    console.error("OAuth callback error:", error)
    return authErrorRedirect(request, "server_error", error instanceof Error ? error.message : undefined)
  }
}
