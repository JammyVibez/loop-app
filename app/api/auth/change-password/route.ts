import { type NextRequest, NextResponse } from "next/server"
import { getBearerToken, getUserFromRequest } from "@/lib/server-auth"
import { setCredentialPassword, verifyCredentialPassword } from "@/lib/auth"

export const dynamic = "force-dynamic"

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const currentPassword = String(body.current_password || body.currentPassword || "").trim()
    const newPassword = String(body.new_password || body.newPassword || "")

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required" }, { status: 400 })
    }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      return NextResponse.json(
        { error: "New password needs 8+ characters with an uppercase letter, a number, and a special character" },
        { status: 400 },
      )
    }
    if (newPassword.length > 128) {
      return NextResponse.json({ error: "Password is too long" }, { status: 400 })
    }

    const ok = await verifyCredentialPassword(user.id, currentPassword)
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    await setCredentialPassword(user.id, newPassword)

    // Revoke every session except the one making this request, so a leaked
    // password can't be used from other devices once it's been changed.
    try {
      const { authDbPool } = await import("@/lib/auth")
      const currentToken = getBearerToken(request)
      if (currentToken) {
        await authDbPool.query('DELETE FROM "session" WHERE "userId" = $1 AND token <> $2;', [user.id, currentToken])
      } else {
        await authDbPool.query('DELETE FROM "session" WHERE "userId" = $1;', [user.id])
      }
    } catch {
      /* best-effort session cleanup */
    }

    return NextResponse.json({ success: true, message: "Password updated. You're all set." })
  } catch (error: any) {
    console.error("change-password error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
