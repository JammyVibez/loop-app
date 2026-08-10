import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const {
      data: { user: sender },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !sender) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { session_id, gift_amount, recipients } = await request.json()

    const amount = Number(gift_amount)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid gift amount" }, { status: 400 })
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "No active co-authors specified to split gift" }, { status: 400 })
    }

    // Check sender balance
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("id, loop_coins, display_name, username")
      .eq("id", sender.id)
      .single()

    const currentCoins = Number(senderProfile?.loop_coins ?? 0)
    if (currentCoins < amount) {
      return NextResponse.json(
        { error: `Insufficient Loop Coins balance (${currentCoins} available, ${amount} required)` },
        { status: 400 }
      )
    }

    // Deduct total gift amount from sender
    await supabase
      .from("profiles")
      .update({ loop_coins: currentCoins - amount })
      .eq("id", sender.id)

    // Log sender transaction
    await supabase.from("coin_transactions").insert({
      user_id: sender.id,
      amount: -amount,
      type: "gift_sent",
      description: `Co-Loop Split Gift (${amount} coins split among ${recipients.length} authors)`,
      created_at: new Date().toISOString(),
    })

    // Calculate split
    const splitAmount = Math.floor(amount / recipients.length)
    const senderName = senderProfile?.display_name || senderProfile?.username || "A supporter"

    const distributed: any[] = []

    for (const recipient of recipients) {
      const recipientId = typeof recipient === "string" ? recipient : recipient.id
      if (!recipientId) continue

      const { data: recProfile } = await supabase
        .from("profiles")
        .select("id, loop_coins, display_name, username")
        .eq("id", recipientId)
        .single()

      if (recProfile) {
        const newBal = Number(recProfile.loop_coins ?? 0) + splitAmount
        await supabase
          .from("profiles")
          .update({ loop_coins: newBal })
          .eq("id", recipientId)

        // Log transaction
        await supabase.from("coin_transactions").insert({
          user_id: recipientId,
          amount: splitAmount,
          type: "gift_received",
          description: `Co-Loop Gift Share from ${senderName} (+${splitAmount} coins)`,
          created_at: new Date().toISOString(),
        })

        // Notify recipient
        await supabase.from("notifications").insert({
          user_id: recipientId,
          type: "co_loop_gift",
          title: "Co-Loop Gift Revenue Share! 🎁",
          message: `${senderName} gifted ${amount} coins to your Co-Loop! You received your share of ${splitAmount} Loop Coins!`,
          data: { session_id, amount, splitAmount, sender_id: sender.id },
          is_read: false,
        })

        distributed.push({
          id: recipientId,
          name: recProfile.display_name || recProfile.username,
          splitAmount,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Gifted ${amount} coins! Each co-author received ${splitAmount} Loop Coins!`,
      splitAmount,
      totalGifted: amount,
      distributed,
    })
  } catch (error: any) {
    console.error("Co-Loop gift error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
