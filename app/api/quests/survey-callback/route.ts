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
 * POST/GET /api/quests/survey-callback — server-to-server postback from the
 * survey/offerwall network (Pollfish, TheoremReach, AdGate, etc.).
 *
 * Reward is credited ONLY on the network's verified completion postback with a
 * valid HMAC signature — identical anti-spoofing model to the ad callback.
 *
 * Expected params:
 *   user_id, quest_id, transaction_id, signature
 *   signature = HMAC-SHA256 hex of "user_id:quest_id:transaction_id"
 *               keyed with admin_settings.survey_network_secret
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

  const { data: secretRow } = await supabase
    .from("admin_settings")
    .select("setting_value")
    .eq("setting_key", "survey_network_secret")
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

  if (!verifySignature(
    new URLSearchParams({ user_id, quest_id, transaction_id, signature }).toString(),
    secret,
  )) {
    console.warn("survey-callback: signature verification failed", { quest_id, transaction_id })
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  // Idempotency by transaction id.
  const { data: existing } = await supabase
    .from("quest_claims")
    .select("id")
    .eq("source", "survey_postback")
    .contains("details" as any, { transaction_id })
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ success: true, duplicate: true })
  }

  if (!questRateLimit(user_id, "survey", 10, 60_000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  }

  const { data: quest } = await supabase.from("quests").select("*").eq("id", quest_id).eq("is_active", true).maybeSingle()
  if (!quest) return NextResponse.json({ error: "Quest not found" }, { status: 404 })
  if ((quest as Quest).quest_type !== "survey") {
    return NextResponse.json({ error: "Quest is not a survey quest" }, { status: 400 })
  }

  const progress = await recordQuestProgress(supabase, quest as Quest, user_id, 1)
  if (progress.completed) {
    const credited = await creditQuestRewards(supabase, quest as Quest, user_id, "survey_postback")
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
    console.error("GET /api/quests/survey-callback error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    return await handle(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])))
  } catch (error: any) {
    console.error("POST /api/quests/survey-callback error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
