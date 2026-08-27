import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { verifyCredentialPassword } from "@/lib/auth"

export const dynamic = "force-dynamic"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const newEmail = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "").trim()

    if (!EMAIL_PATTERN.test(newEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: "Enter your current password to confirm the change" }, { status: 400 })
    }
    if (newEmail.length > 255) {
      return NextResponse.json({ error: "Email is too long" }, { status: 400 })
    }

    const ok = await verifyCredentialPassword(user.id, password)
    if (!ok) {
      return NextResponse.json({ error: "Password is incorrect" }, { status: 400 })
    }

    // Same email — nothing to do.
    if (user.email?.toLowerCase() === newEmail) {
      return NextResponse.json({ success: true, message: "That's already your email.", email: newEmail })
    }

    // Don't let two accounts share an email.
    const dup = await authDbPool.query('SELECT id FROM "user" WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1;', [
      newEmail,
      user.id,
    ])
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 })
    }

    await authDbPool.query('UPDATE "user" SET email = $1, "emailVerified" = false, "updatedAt" = NOW() WHERE id = $2;', [
      newEmail,
      user.id,
    ])

    // Keep the app's profiles table in sync so profile reads show the new email.
    try {
      const { createServerClient } = await import("@/lib/supabase")
      const supabase = createServerClient()
      await supabase.from("profiles").update({ email: newEmail }).eq("id", user.id)
    } catch (err) {
      console.error("change-email: profiles sync failed:", err)
    }

    return NextResponse.json({ success: true, message: "Email updated. You'll be asked to verify it next sign-in.", email: newEmail })
  } catch (error: any) {
    console.error("change-email error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
