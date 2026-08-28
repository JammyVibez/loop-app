import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { generateSecret, generateTOTPUri } from "@/lib/totp"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()

    // Check if already enabled
    const { data: profile } = await supabase
      .from("profiles")
      .select("two_factor_enabled, email")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.two_factor_enabled) {
      return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 })
    }

    // Generate new secret
    const secret = generateSecret()
    const email = user.email || profile?.email || "user@loopapp.me"
    const uri = generateTOTPUri(secret, email)

    // Store secret temporarily (not enabled yet)
    await supabase
      .from("profiles")
      .update({ two_factor_secret: secret })
      .eq("id", user.id)

    return NextResponse.json({ secret, uri })
  } catch (error) {
    console.error("2FA setup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
