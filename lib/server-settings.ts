import { createServerClient } from "@/lib/supabase"

/**
 * Server-side configuration stored in `admin_settings`.
 *
 * Integration credentials (Giphy/Tenor keys, etc.) can live in the deployment
 * environment or be rotated from the database without a redeploy. Values here
 * are read with the service role, so they never reach the client.
 */
const CACHE_TTL = 5 * 60_000
const cache = new Map<string, { value: string | null; at: number }>()

function coerce(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null
  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as { value?: unknown }).value
    return typeof inner === "string" && inner.trim() ? inner.trim() : null
  }
  return null
}

export async function getServerSetting(key: string): Promise<string | null> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value

  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", key)
      .maybeSingle()

    const value = coerce(data?.setting_value)
    cache.set(key, { value, at: Date.now() })
    return value
  } catch {
    // A settings lookup must never take a feature down; miss = fall back.
    cache.set(key, { value: null, at: Date.now() })
    return null
  }
}

/** Credential lookup: environment first, database second. */
export async function getIntegrationCredential(envName: string, settingKey: string): Promise<string | null> {
  const fromEnv = process.env[envName]
  if (fromEnv) return fromEnv
  return getServerSetting(settingKey)
}
