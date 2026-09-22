import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getRateLimitSettings } from "@/lib/rate-limit-settings"

export const dynamic = "force-dynamic"

/**
 * The throttling policy the edge middleware enforces.
 *
 * Middleware cannot query Postgres, so it reads the admin-controlled policy
 * from here and caches it for a minute. Only the numeric limits are exposed —
 * no secrets, no user data — so this stays unauthenticated; the consequence of
 * reading it is exactly the behaviour every visitor already observes.
 */
export async function GET() {
  try {
    const settings = await getRateLimitSettings(createServerClient())
    return NextResponse.json(
      {
        enabled: settings.enabled,
        login_ip_max: settings.login_ip_max,
        signup_ip_max: settings.signup_ip_max,
        upload_max: settings.upload_max,
        anonymous_api_max: settings.anonymous_api_max,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("internal rate-limit config:", error)
    // Middleware treats a non-OK response as "use the shipped defaults".
    return NextResponse.json({ error: "Rate limit policy unavailable" }, { status: 503 })
  }
}
