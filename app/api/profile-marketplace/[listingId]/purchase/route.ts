import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const MESSAGES: Record<string, string> = {
  DESIGN_NOT_AVAILABLE: "This design is not available right now.",
  CANNOT_BUY_OWN_DESIGN: "You cannot purchase your own design.",
  DESIGN_ALREADY_OWNED: "You already own this design.",
  BUYER_PROFILE_NOT_FOUND: "Your Loop profile could not be found.",
  INSUFFICIENT_LOOP_COINS: "You do not have enough Loop Coins.",
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const user = await getUserFromRequest(_request)
  if (!user) return NextResponse.json({ error: "Sign in to purchase a design." }, { status: 401 })

  try {
    const { listingId } = await params
    const supabase = createServerClient()
    const { data, error } = await supabase.rpc("purchase_profile_design", {
      p_listing_id: listingId,
      p_buyer_id: user.id,
    })
    if (error) {
      const code = Object.keys(MESSAGES).find((key) => error.message?.includes(key))
      const message = code ? MESSAGES[code] : "The purchase could not be completed."
      const status = code === "INSUFFICIENT_LOOP_COINS" ? 400 : code === "DESIGN_NOT_AVAILABLE" ? 404 : 409
      return NextResponse.json({ error: message }, { status })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .maybeSingle()

    return NextResponse.json({ success: true, purchase: data, loop_coins: Number(profile?.loop_coins || 0) })
  } catch (error) {
    console.error("Profile design purchase error:", error)
    return NextResponse.json({ error: "The purchase could not be completed." }, { status: 500 })
  }
}
