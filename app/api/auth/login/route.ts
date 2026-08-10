import { type NextRequest, NextResponse } from "next/server"
import { auth, authDbPool } from "@/lib/auth"
import { hashPassword } from "better-auth/crypto"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
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
      const errData = await sessionResult.json().catch(() => ({}))
      return NextResponse.json({ error: errData.message || "Invalid email or password" }, { status: 400 })
    }

    const sessionData = await sessionResult.json()
    const user = sessionData.user || sessionData.session?.user

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 })
    }

    // Password migration (bcrypt -> Argon2 on next login)
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

    const supabase = createServerClient()
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

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
