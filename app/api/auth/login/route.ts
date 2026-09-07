import { type NextRequest, NextResponse } from "next/server"
import { auth, authDbPool } from "@/lib/auth"
import { hashPassword } from "better-auth/crypto"
import { createServerClient } from "@/lib/supabase"
import {
  checkRateLimit,
  getClientIp,
  recordFailedAuthAttempt,
  clearFailedAuthAttempts,
  isAuthLocked,
} from "@/lib/rate-limit"
import { getRateLimitSettings } from "@/lib/rate-limit-settings"

export const dynamic = "force-dynamic"

const rateLimited = (retryAfter: number, message?: string) =>
  NextResponse.json(
    {
      error: "Too many requests",
      message: message || `Too many login attempts. Try again in ${retryAfter} seconds.`,
      retryAfter,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  )

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Read the admin policy (cached in-process for 15s). Brute-force
    // protection has a hard floor here: even with the master switch off the
    // account lockout only relaxes to very permissive limits — it never
    // fully disappears, because credential attacks are not a tuneable
    // annoyance, they're a security boundary.
    const policy = await getRateLimitSettings(createServerClient())
    const ipMax = policy.enabled ? policy.login_ip_max : 60
    const failMax = policy.enabled ? policy.login_fail_max : 20
    const lockBaseMs = policy.login_lockout_base_min * 60 * 1000

    // ── 1. IP burst guard — stops scripted floods from one source. ──
    const ipCheck = checkRateLimit(`login-ip:${getClientIp(request)}`, { maxRequests: ipMax, windowMs: 60_000 })
    if (!ipCheck.allowed) {
      return rateLimited(ipCheck.retryAfter || 60)
    }

    // ── 2. Account lockout pre-check — reject before the password verifier ──
    // runs, so a locked account costs attackers almost nothing but a hash
    // compare (and dictionary attempts against it stop immediately).
    const acctKey = `login-acct:${email}`
    const lock = isAuthLocked(acctKey)
    if (lock.locked) {
      return rateLimited(lock.retryAfter || 300, "Too many failed attempts. Try again later.")
    }

    const sessionResult = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      asResponse: true,
      headers: request.headers,
    })

    if (!sessionResult.ok) {
      // Invalid credentials (or unknown account). Count toward the lockout so
      // brute-force / dictionary attacks accumulate even across rotating IPs.
      const errData = await sessionResult.json().catch(() => ({}))
      const failed = recordFailedAuthAttempt(acctKey, failMax, lockBaseMs)
      if (failed.locked) {
        return rateLimited(failed.retryAfter, "Too many failed attempts. Try again later.")
      }
      return NextResponse.json(
        { error: errData.message || "Invalid email or password" },
        { status: 401 },
      )
    }

    const sessionData = await sessionResult.json()
    const user = sessionData.user || sessionData.session?.user

    if (!user) {
      const failed = recordFailedAuthAttempt(acctKey, failMax, lockBaseMs)
      if (failed.locked) {
        return rateLimited(failed.retryAfter, "Too many failed attempts. Try again later.")
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Successful login clears the failure counter for this account.
    clearFailedAuthAttempts(acctKey)

    // Run password migration and profile fetch in parallel — saves ~100-300ms.
    const supabase = createServerClient()
    const [profileResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle(),
      // Password migration (bcrypt -> Argon2 on next login) — fire-and-forget.
      // The session is already valid; a stale hash just means this login used
      // the old algorithm. The rehash will complete before the next login.
      (async () => {
        try {
          const accRes = await authDbPool.query(
            'SELECT password FROM "account" WHERE "userId" = $1 AND "providerId" = \'credential\' LIMIT 1;',
            [user.id]
          )
          if (accRes.rows.length > 0) {
            const currentHash = accRes.rows[0].password
            if (currentHash && (currentHash.startsWith("$2a$") || currentHash.startsWith("$2b$") || currentHash.startsWith("$2y$"))) {
              const newArgonHash = await hashPassword(password)
              await authDbPool.query(
                'UPDATE "account" SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = \'credential\';',
                [newArgonHash, user.id]
              )
              console.log(`Migrated password from bcrypt to Argon2 for user ${user.id}`)
            }
          }
        } catch (rehashErr) {
          console.error("Password rehash error:", rehashErr)
        }
      })(),
    ])
    const { data: profile, error: profileError } = profileResult

    // Don't let a raw Postgres/PostgREST error (e.g. "Invalid JWT structure"
    // from a misconfigured SUPABASE_SERVICE_ROLE_KEY) block login — the
    // Better Auth session above already succeeded. Log it and continue with
    // whatever profile data we have; the client will retry via /api/auth/me.
    if (profileError) {
      console.error("Login: profile lookup failed (session still created):", profileError)
    }

    const token = sessionData.token || sessionData.session?.token || sessionData.session?.id || user.id

    const res = NextResponse.json({
      message: "Login successful",
      session: {
        access_token: token,
        refresh_token: token,
        user: { ...user, ...profile },
      },
      user: { ...user, ...profile },
    })

    const setCookieHeader = sessionResult.headers.get("set-cookie")
    if (setCookieHeader) {
      res.headers.set("set-cookie", setCookieHeader)
    }

    return res
  } catch (error: any) {
    console.error("Login error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
