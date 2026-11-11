/**
 * Upsert a server-side setting in `admin_settings`.
 *
 * Used for integration credentials that should be rotatable without a code
 * deploy. Values are never printed.
 *
 * Usage:
 *   node scripts/set-server-setting.mjs <key> <value>
 */
import { createClient } from "@supabase/supabase-js"

const [, , key, value] = process.argv
if (!key || !value) {
  console.error("usage: node scripts/set-server-setting.mjs <key> <value>")
  process.exit(1)
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Supabase credentials are not available in this environment.")
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const { error } = await supabase.from("admin_settings").upsert(
  {
    setting_key: key,
    setting_value: value,
    description: "Server-side integration credential",
  },
  { onConflict: "setting_key" },
)

if (error) {
  console.error(`failed to save ${key}: ${error.message}`)
  process.exit(1)
}

console.log(`saved ${key} (${value.length} characters)`)
