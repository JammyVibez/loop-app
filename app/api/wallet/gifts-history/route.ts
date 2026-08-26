import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}


export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()

    // Fetch gifts received by user
    const { data: giftsReceived } = await supabase
      .from("coin_gifts")
      .select("*")
      .eq("receiver_id", user.id)
      .order("created_at", { ascending: false })

    // Fetch gifts sent by user
    const { data: giftsSent } = await supabase
      .from("coin_gifts")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })

    // Fetch user inventory items
    const { data: inventory } = await supabase
      .from("user_inventory")
      .select("*")
      .eq("user_id", user.id)
      .order("acquired_at", { ascending: false })

    return NextResponse.json({
      success: true,
      received: giftsReceived || [],
      sent: giftsSent || [],
      inventory: inventory || []
    })
  } catch (error: any) {
    console.error("GET /api/wallet/gifts-history error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
