import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { verifyTOTP, generateBackupCodes, hashBackupCode } from "@/lib/totp"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json({ error: "Enter a 6-digit code" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Get the stored secret
    const { data: profile } = await supabase
      .from("profiles")
      .select("two_factor_secret, two_factor_enabled")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.two_factor_secret) {
      return NextResponse.json({ error: "No 2FA setup in progress. Start setup first." }, { status: 400 })
    }

    if (profile.two_factor_enabled) {
      return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 })
    }

    // Verify the code
    const isValid = verifyTOTP(profile.two_factor_secret, code)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid code. Check your authenticator app." }, { status: 400 })
    }

    // Generate backup codes
    const rawCodes = generateBackupCodes(10)
    const hashedCodes = rawCodes.map(hashBackupCode)

    // Enable 2FA
    await supabase
      .from("profiles")
      .update({
        two_factor_enabled: true,
        two_factor_backup_codes: hashedCodes,
      })
      .eq("id", user.id)

    // Log security event
    try {
      await supabase.from("security_audit_log").insert({
        user_id: user.id,
        action: "2fa_enabled",
        details: JSON.stringify({ method: "totp" }),
      })
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      backupCodes: rawCodes,
    })
  } catch (error) {
    console.error("2FA verify-enable error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
