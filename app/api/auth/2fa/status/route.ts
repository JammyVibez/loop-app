import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("two_factor_enabled")
      .eq("id", user.id)
      .maybeSingle()

    return NextResponse.json({
      enabled: Boolean(profile?.two_factor_enabled),
    })
  } catch (error) {
    console.error("2FA status error:", error)
    return NextResponse.json({ enabled: false })
  }
}
