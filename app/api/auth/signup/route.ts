import { randomUUID } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase"
import { ECONOMY_DEFAULTS } from "@/lib/economy"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { getRateLimitSettings } from "@/lib/rate-limit-settings"
import { isUuid } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

function normalizeUsername(username: string) {
  return username.toLowerCase().replace(/[^a-z0-9_]/g, "")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")
    const cleanUsername = normalizeUsername(body.username || "")
    const displayName = String(body.display_name || "").trim()
    const invitedViaColoop = Boolean(body.invited_via_coloop)
    const invitedByUsername = body.invited_by_username ? String(body.invited_by_username).toLowerCase().trim() : null

    if (!email || !password || !cleanUsername || !displayName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Anti-abuse: tight per-IP window (spam-account factories hit this first)
    // plus a per-email/hour cap so the same address can't mint accounts in a
    // loop. Failures count too — no point letting bots probe taken emails.
    // Limits are admin-tuneable via the rate-limits panel; when the master
    // switch is off, signups relax to a permissive floor instead of vanishing
    // entirely so spam waves can still be dampened.
    const policy = await getRateLimitSettings(createServerClient())
    const ipMax = policy.enabled ? policy.signup_ip_max : 20
    const emailMax = policy.enabled ? policy.signup_email_max : 10
    const ipCheck = checkRateLimit(`signup-ip:${getClientIp(request)}`, { maxRequests: ipMax, windowMs: 60_000 })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests", message: `Slow down — try again in ${ipCheck.retryAfter} seconds.`, retryAfter: ipCheck.retryAfter },
        { status: 429, headers: { "Retry-After": String(ipCheck.retryAfter) } },
      )
    }
    const emailCheck = checkRateLimit(`signup-email:${email}`, { maxRequests: emailMax, windowMs: 60 * 60 * 1000 })
    if (!emailCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests", message: "Too many signup attempts for this email. Try again later.", retryAfter: emailCheck.retryAfter },
        { status: 429, headers: { "Retry-After": String(emailCheck.retryAfter) } },
      )
    }

    if (cleanUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const supabase = createServerClient()

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

    const signUpResult = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: displayName,
      },
      asResponse: true,
      headers: request.headers,
    })

    if (!signUpResult.ok) {
      const errData = await signUpResult.json().catch(() => ({}))
      return NextResponse.json({ error: errData.message || "Failed to create account" }, { status: 400 })
    }

    const signUpData = await signUpResult.json()
    const createdUser = signUpData.user || signUpData.session?.user

    if (!createdUser) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 400 })
    }

    // profiles.id is a uuid column while Better Auth owns a free-form text id.
    // If the auth id isn't a UUID, mint one for the profile row — server routes
    // bridge back to it via the account email (see lib/server-auth).
    const profileId = isUuid(createdUser.id) ? createdUser.id : randomUUID()
    if (profileId !== createdUser.id) {
      console.warn(`Signup: bridged Better Auth id "${createdUser.id}" to profile ${profileId}`)
    }

    // Auto-assign unique animated PFP and cover for new users
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "")
    const defaultAvatar = `${baseUrl}/api/default-avatar?id=${encodeURIComponent(profileId)}&name=${encodeURIComponent(displayName)}`
    const defaultBanner = `${baseUrl}/api/default-avatar?id=${encodeURIComponent(profileId)}&name=${encodeURIComponent(displayName)}&type=banner`

    const profilePayload = {
      id: profileId,
      email,
      username: cleanUsername,
      display_name: displayName,
      avatar_url: defaultAvatar,
      banner_url: defaultBanner,
      bio: null,
      loop_coins: ECONOMY_DEFAULTS.signup_bonus,
      is_premium: false,
      is_verified: false,
      is_admin: false,
      privacy_settings: { profile_visibility: "public", message_privacy: "everyone" },
      notification_settings: { email: true, push: true, in_app: true },
      onboarding_completed: false,
      invited_via_coloop: invitedViaColoop,
      invited_by_username: invitedByUsername,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: profileUpsertError } = await supabase.from("profiles").upsert(profilePayload)
    if (profileUpsertError) {
      // Don't fail the signup — the Better Auth account already exists and
      // the user can still sign in. Surface this loudly server-side though,
      // since a missing profile row breaks most of the app for this user
      // until it's backfilled (e.g. via a misconfigured service role key).
      console.error("Signup: failed to create profile row for", profileId, profileUpsertError)
    }

    // Invite-a-friend quests credit the inviter, not the new account. The
    // attribution comes from the /signup?ref=<username> link (the one
    // /invite hands out) and never counts a self-referral. Quest failures
    // must not break signup, so this is best-effort.
    if (invitedByUsername && invitedByUsername !== cleanUsername) {
      try {
        const { data: inviter } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", invitedByUsername)
          .maybeSingle()
        if ((inviter as any)?.id) {
          const { trackQuestAction } = await import("@/lib/quest-tracker")
          await trackQuestAction(supabase, (inviter as any).id, "invite_friend")
        }
      } catch (questError) {
        console.error("invite_friend quest track failed (non-fatal):", questError)
      }
    }

    const token = signUpData.token || signUpData.session?.token || signUpData.session?.id || createdUser.id

    const res = NextResponse.json({
      message: "Account created successfully",
      session: {
        access_token: token,
        refresh_token: token,
        user: {
          ...createdUser,
          username: cleanUsername,
          display_name: displayName,
          onboarding_completed: false,
        },
      },
      user: {
        ...createdUser,
        username: cleanUsername,
        display_name: displayName,
        onboarding_completed: false,
      },
    })

    const setCookieHeader = signUpResult.headers.get("set-cookie")
    if (setCookieHeader) {
      res.headers.set("set-cookie", setCookieHeader)
    }

    return res
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
