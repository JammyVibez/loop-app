import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type Supabase = ReturnType<typeof createServerClient>

/**
 * Bump one of the ad's counters.
 *
 * Prefers the atomic `increment_ad_counter` RPC, but falls back to a
 * read-modify-write when that function hasn't been applied to the database.
 * Tracking used to fail silently in that case — the admin panel showed every
 * creative stuck at 0 impressions / 0 clicks, which looks exactly like "the ad
 * system is broken".
 */
async function bumpCounter(supabase: Supabase, adId: string, column: "impressions" | "clicks") {
  const { error: rpcError } = await supabase.rpc("increment_ad_counter", { p_ad_id: adId, p_column: column })
  if (!rpcError) return

  console.warn(`ads track: increment_ad_counter unavailable (${rpcError.message}), using fallback`)

  const { data: ad, error: readError } = await supabase
    .from("ads")
    .select("impressions, clicks")
    .eq("id", adId)
    .maybeSingle()
  if (readError || !ad) {
    console.error("ads track: could not read ad counters:", readError?.message)
    return
  }

  const next = Number(column === "clicks" ? ad.clicks : ad.impressions || 0) + 1
  const { error: updateError } = await supabase
    .from("ads")
    .update({ [column]: next })
    .eq("id", adId)
  if (updateError) console.error("ads track: could not write ad counters:", updateError.message)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const adId = String(body.ad_id || "")
    const action = body.action === "click" ? "click" : "impression"
    if (!adId) return NextResponse.json({ success: true })

    if (action === "click") {
      await bumpCounter(supabase, adId, "clicks")
      return NextResponse.json({ success: true })
    }

    // One impression per ad per viewer session. The dedupe table is keyed on a
    // client session id (not a user id) so signed-out visitors count too.
    const sessionId = String(body.session_id || "anon").slice(0, 80)

    const { data: existing, error: lookupError } = await supabase
      .from("ad_impressions")
      .select("id")
      .eq("ad_id", adId)
      .eq("session_id", sessionId)
      .maybeSingle()

    if (lookupError) {
      // Dedupe unavailable — better to count (slightly high) than to show the
      // admin a permanent zero everywhere.
      console.warn("ads track: ad_impressions unavailable:", lookupError.message)
    } else if (existing) {
      return NextResponse.json({ success: true, deduped: true })
    } else {
      const { error: insertError } = await supabase
        .from("ad_impressions")
        .insert({ ad_id: adId, session_id: sessionId })
      // 23505 = concurrent insert already recorded this impression.
      if (insertError && insertError.code !== "23505") {
        console.warn("ads track: could not record impression:", insertError.message)
      } else if (insertError?.code === "23505") {
        return NextResponse.json({ success: true, deduped: true })
      }
    }

    await bumpCounter(supabase, adId, "impressions")
    return NextResponse.json({ success: true })
  } catch (error: any) {
    // Tracking must never break the feed.
    console.error("ads track:", error)
    return NextResponse.json({ success: true })
  }
}
