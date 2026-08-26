import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}


export async function POST(request: NextRequest) {
  try {
    const sender = await getUserFromRequest(request)

    if (!sender) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { target_username, coins_amount, gift_name, gift_icon, message } = await request.json()
    const amount = Number(coins_amount)

    if (!target_username || !amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid target username or coin amount" }, { status: 400 })
    }

    const cleanUsername = target_username.replace("@", "").trim().toLowerCase()
    const supabase = createServerClient()

    // 1. Check sender balance
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("loop_coins, username, display_name, avatar_url, video_avatar_url")
      .eq("id", sender.id)
      .single()

    const senderBalance = Number(senderProfile?.loop_coins ?? 0)
    if (senderBalance < amount) {
      return NextResponse.json({ error: `Insufficient balance. You need ${amount} coins.` }, { status: 400 })
    }

    // 2. Find receiver by username
    const { data: receiverProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, loop_coins")
      .ilike("username", cleanUsername)
      .maybeSingle()

    if (!receiverProfile) {
      return NextResponse.json({ error: `User @${cleanUsername} not found` }, { status: 404 })
    }

    if (receiverProfile.id === sender.id) {
      return NextResponse.json({ error: "You cannot gift coins to yourself" }, { status: 400 })
    }

    // 3. Deduct coins from sender & add to receiver
    const newSenderBalance = senderBalance - amount
    const receiverBalance = Number(receiverProfile.loop_coins ?? 0)
    const newReceiverBalance = receiverBalance + amount

    await supabase.from("profiles").upsert({ id: sender.id, loop_coins: newSenderBalance })
    await supabase.from("profiles").upsert({ id: receiverProfile.id, loop_coins: newReceiverBalance })

    // 4. Insert gift record into coin_gifts table
    const sUsername = senderProfile?.username || sender.email?.split("@")[0] || "user"
    const sName = senderProfile?.display_name || sUsername
    const sAvatar = senderProfile?.avatar_url || "/placeholder.svg"

    const giftRecord = {
      id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender_id: sender.id,
      sender_username: sUsername,
      sender_name: sName,
      sender_avatar: sAvatar,
      receiver_id: receiverProfile.id,
      receiver_username: receiverProfile.username || cleanUsername,
      coins_amount: amount,
      gift_name: gift_name || "Loop Coin Gift",
      gift_icon: gift_icon || "🎁",
      message: message || null,
      created_at: new Date().toISOString()
    }

    await supabase.from("coin_gifts").insert(giftRecord)

    // 5. Record wallet transactions for both users
    await supabase.from("wallet_transactions").insert([
      {
        id: `tx-send-${Date.now()}`,
        user_id: sender.id,
        amount_usd: 0,
        coins_amount: -amount,
        type: "gift_sent",
        description: `Sent ${gift_name || "gift"} (${amount} coins) to @${receiverProfile.username || cleanUsername}`,
        status: "completed",
        created_at: new Date().toISOString()
      },
      {
        id: `tx-recv-${Date.now()}`,
        user_id: receiverProfile.id,
        amount_usd: 0,
        coins_amount: amount,
        type: "gift_received",
        description: `Received ${gift_name || "gift"} (${amount} coins) from @${sUsername}`,
        status: "completed",
        created_at: new Date().toISOString()
      }
    ])

    return NextResponse.json({
      success: true,
      newBalance: newSenderBalance,
      message: `Successfully gifted ${amount} coins to @${cleanUsername}!`,
      gift: giftRecord
    })
  } catch (error: any) {
    console.error("POST /api/wallet/gift error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
