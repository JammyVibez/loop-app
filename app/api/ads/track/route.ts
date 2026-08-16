import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const adId = String(body.ad_id || "")
    const action = body.action === "click" ? "click" : "impression"
    if (!adId) return NextResponse.json({ success: true })

    // De-dup impressions per ad per viewer using a lightweight presence table
    // keyed on the ad + a client session id (not a user id, so guests count).
    if (action === "impression") {
      const sessionId = String(body.session_id || "anon").slice(0, 80)
      const { data: existing } = await supabase
        .from("ad_impressions")
        .select("id")
        .eq("ad_id", adId)
        .eq("session_id", sessionId)
        .maybeSingle()
      if (!existing) {
        await supabase.from("ad_impressions").insert({ ad_id: adId, session_id: sessionId })
        await supabase.rpc("increment_ad_counter", { p_ad_id: adId, p_column: "impressions" })
      }
    } else {
      await supabase.rpc("increment_ad_counter", { p_ad_id: adId, p_column: "clicks" })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    // Tracking must never break the feed.
    console.error("ads track:", error)
    return NextResponse.json({ success: true })
  }
}
