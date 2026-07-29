import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getEconomySettings, normalizeEconomySettings, saveEconomySettings } from "@/lib/economy"

export const dynamic = "force-dynamic"

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const supabase = createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) }

  const { data: profile } = await supabase.from("profiles").select("id, is_admin").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }
  return { user, supabase }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error
    const economy = await getEconomySettings(auth.supabase)
    return NextResponse.json({ success: true, economy })
  } catch (error: any) {
    console.error("admin economy GET:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const patch = body.economy || body.settings || body
    const economy = await saveEconomySettings(
      auth.supabase,
      normalizeEconomySettings({ ...(await getEconomySettings(auth.supabase)), ...patch }),
      auth.user.id,
    )

    return NextResponse.json({
      success: true,
      economy,
      message: "Economy settings saved",
    })
  } catch (error: any) {
    console.error("admin economy POST:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
