import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { type Quest, questRateLimit, creditQuestRewards, recordQuestProgress } from "@/lib/quests"
import { createHmac, timingSafeEqual } from "crypto"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

/**
 * POST/GET /api/quests/ad-callback — server-to-server reward postback from the
 * rewarded-ad network (AdMob SSV, ironSource, Adsterra, AdGem, etc.).
 *
 * The network calls this AFTER the user fully watches the ad, sending a signed
 * payload. The reward is credited ONLY here — the client's "I watched it"
 * signal is never trusted.
 *
 * Expected params (query for GET, JSON body for POST):
 *   user_id        — your user id passed in the ad call's user_id/custom_data
 *   quest_id       — which ad quest to progress
 *   transaction_id — unique id from the network (idempotency)
 *   signature      — HMAC-SHA256 hex of "user_id:quest_id:transaction_id"
 *                    keyed with the network secret (admin_settings.ad_network_secret)
 *
 * Configure the shared secret in Admin → Quests → Integrations. Networks like
 * AdMob SSV use their own key format — point them at this endpoint and adapt
 * the signature line below if needed.
 */
function verifySignature(raw: string, secret: string): boolean {
  if (!secret) return false
  const parts = Object.fromEntries(new URLSearchParams(raw))
  const { user_id, quest_id, transaction_id, signature } = parts
  if (!user_id || !quest_id || !transaction_id || !signature) return false
  const expected = createHmac("sha256", secret).update(`${user_id}:${quest_id}:${transaction_id}`).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(String(signature))
  return a.length === b.length && timingSafeEqual(a, b)
}

async function handle(params: Record<string, string>) {
  const { user_id, quest_id, transaction_id, signature } = params

  // 1. Load the network secret.
  const { data: secretRow } = await supabase
    .from("admin_settings")
    .select("setting_value")
    .eq("setting_key", "ad_network_secret")
    .maybeSingle()
  const secretVal = secretRow?.setting_value
  const secret =
    typeof secretVal === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(secretVal)
            return String(parsed?.value ?? parsed ?? "")
          } catch {
            return secretVal
          }
        })()
      : String((secretVal as any)?.value ?? "")

  // 2. Verify the HMAC signature (server-side verification — the core safeguard).
  if (!verifySignature(
    new URLSearchParams({ user_id, quest_id, transaction_id, signature }).toString(),
    secret,
  )) {
    console.warn("ad-callback: signature verification failed", { quest_id, transaction_id })
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  // 3. Idempotency by transaction id — networks retry; never double-reward.
  const { data: existing } = await supabase
    .from("quest_claims")
    .select("id")
    .eq("source", "ad_postback")
    .contains("details" as any, { transaction_id })
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ success: true, duplicate: true })
  }

  // 4. Rate limit per user.
  if (!questRateLimit(user_id, "ad", 10, 60_000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  }

  // 5. Load the quest and credit.
  const { data: quest } = await supabase.from("quests").select("*").eq("id", quest_id).eq("is_active", true).maybeSingle()
  if (!quest) return NextResponse.json({ error: "Quest not found" }, { status: 404 })
  if ((quest as Quest).quest_type !== "ad") {
    return NextResponse.json({ error: "Quest is not an ad quest" }, { status: 400 })
  }

  const progress = await recordQuestProgress(supabase, quest as Quest, user_id, 1)
  if (progress.completed) {
    const credited = await creditQuestRewards(supabase, quest as Quest, user_id, "ad_postback")
    if (credited.ok) {
      await supabase
        .from("quest_progress")
        .update({ claimed_at: new Date().toISOString() })
        .eq("quest_id", quest_id)
        .eq("user_id", user_id)
    }
    return NextResponse.json({ success: true, completed: true, rewarded: credited.ok, coins: credited.coins, xp: credited.xp })
  }

  return NextResponse.json({ success: true, completed: false, progress: progress.progress, required: progress.required })
}

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams)
    return await handle(params)
  } catch (error: any) {
    console.error("GET /api/quests/ad-callback error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    return await handle(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])))
  } catch (error: any) {
    console.error("POST /api/quests/ad-callback error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
