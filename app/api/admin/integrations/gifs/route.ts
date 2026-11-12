import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { getServerSetting, invalidateServerSetting } from "@/lib/server-settings"

export const dynamic = "force-dynamic"

const KEYS = [
  { id: "giphy", env: "GIPHY_API_KEY", setting: "giphy_api_key", label: "Giphy" },
  { id: "klipy", env: "KLIPY_API_KEY", setting: "klipy_api_key", label: "Klipy" },
] as const

async function providerStatus(provider: (typeof KEYS)[number]) {
  const fromEnv = process.env[provider.env]
  const fromDb = await getServerSetting(provider.setting)
  return {
    configured: Boolean(fromEnv || fromDb),
    source: fromEnv ? "environment" : fromDb ? "admin_settings" : null,
    label: provider.label,
  }
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const [giphy, klipy] = await Promise.all(KEYS.map(providerStatus))
  return NextResponse.json({ success: true, providers: { giphy, klipy } })
}

/**
 * Admin-only credential rotation. Keys are written to `admin_settings` with the
 * service role and never returned to the client — the same storage the Giphy
 * key has always used, so the GIF route can rotate keys without a redeploy.
 */
export async function PUT(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const body = await request.json().catch(() => ({}))
  const supabase = createServerClient()
  const saved: string[] = []

  for (const provider of KEYS) {
    const raw = body?.[provider.id]
    if (typeof raw !== "string") continue
    const value = raw.trim()
    if (!value) continue
    if (value.length < 8 || value.length > 300) {
      return NextResponse.json({ error: `${provider.label} key looks invalid` }, { status: 400 })
    }

    const { error } = await supabase.from("admin_settings").upsert(
      {
        setting_key: provider.setting,
        setting_value: value,
        description: `${provider.label} API key for GIF and sticker search`,
      },
      { onConflict: "setting_key" },
    )

    if (error) {
      return NextResponse.json({ error: `Could not save the ${provider.label} key` }, { status: 500 })
    }
    invalidateServerSetting(provider.setting)
    saved.push(provider.id)
  }

  if (!saved.length) {
    return NextResponse.json({ error: "Enter at least one API key" }, { status: 400 })
  }

  const [giphy, klipy] = await Promise.all(KEYS.map(providerStatus))
  return NextResponse.json({ success: true, saved, providers: { giphy, klipy } })
}
