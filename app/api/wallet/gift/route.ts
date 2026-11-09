import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

type TransferResult = { balance: number } | { error: string }

/**
 * Move coins with a balance predicate in the UPDATE. Two rapid transfers can
 * never spend the same coins, and a concurrent write makes us retry instead of
 * overwriting the other balance.
 */
async function debitCoins(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  amount: number,
): Promise<TransferResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: profile, error: readError } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", userId)
      .maybeSingle()

    if (readError) return { error: "We couldn't read your wallet. Please try again." }
    if (!profile) return { error: "Wallet not found." }

    const current = Math.max(0, Math.floor(Number(profile.loop_coins || 0)))
    if (current < amount) return { error: "Not enough coins for this transfer." }

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ loop_coins: current - amount, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("loop_coins", current)
      .select("loop_coins")
      .maybeSingle()

    if (!updateError && updated) return { balance: Number(updated.loop_coins) }
    if (updateError && updateError.code !== "PGRST116") {
      return { error: "We couldn't update your balance. Please try again." }
    }
  }

  return { error: "Your balance changed while sending. Review it and try again." }
}

async function creditCoins(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  amount: number,
): Promise<TransferResult> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: profile, error: readError } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", userId)
      .maybeSingle()

    if (readError) return { error: "We couldn't read the recipient wallet." }
    if (!profile) return { error: "Recipient wallet not found." }

    const current = Math.max(0, Math.floor(Number(profile.loop_coins || 0)))
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ loop_coins: current + amount, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("loop_coins", current)
      .select("loop_coins")
      .maybeSingle()

    if (!updateError && updated) return { balance: Number(updated.loop_coins) }
    if (updateError && updateError.code !== "PGRST116") {
      return { error: "We couldn't credit the recipient wallet." }
    }
  }

  return { error: "The recipient wallet was busy. Please try again." }
}

export async function POST(request: NextRequest) {
  try {
    const sender = await getUserFromRequest(request)
    if (!sender) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const rawAmount = Number(body?.coins_amount)
    const amount = Number.isInteger(rawAmount) ? rawAmount : 0
    const rawUsername = typeof body?.target_username === "string" ? body.target_username : ""
    const cleanUsername = rawUsername.replace(/^@+/, "").trim().toLowerCase()

    if (!cleanUsername || cleanUsername.length > 50) {
      return NextResponse.json({ error: "Enter a valid recipient username." }, { status: 400 })
    }
    if (!amount || amount < 1) {
      return NextResponse.json({ error: "Enter a coin amount of at least 1." }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: senderProfile, error: senderError } = await supabase
      .from("profiles")
      .select("loop_coins, username, display_name, avatar_url")
      .eq("id", sender.id)
      .maybeSingle()

    if (senderError || !senderProfile) {
      return NextResponse.json({ error: "We couldn't load your wallet. Please refresh and try again." }, { status: 404 })
    }

    const senderBalance = Math.max(0, Math.floor(Number(senderProfile.loop_coins || 0)))
    if (senderBalance < amount) {
      return NextResponse.json(
        { error: `You need ${(amount - senderBalance).toLocaleString()} more coins for this transfer.` },
        { status: 402 },
      )
    }

    const { data: receiverProfile, error: receiverError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, loop_coins")
      .ilike("username", cleanUsername)
      .maybeSingle()

    if (receiverError) {
      return NextResponse.json({ error: "We couldn't look up that recipient." }, { status: 500 })
    }
    if (!receiverProfile) {
      return NextResponse.json({ error: `No user found with @${cleanUsername}.` }, { status: 404 })
    }
    if (receiverProfile.id === sender.id) {
      return NextResponse.json({ error: "You can't send coins to yourself." }, { status: 400 })
    }

    const debit = await debitCoins(supabase, sender.id, amount)
    if ("error" in debit) {
      return NextResponse.json({ error: debit.error }, { status: debit.error.includes("Not enough") ? 402 : 409 })
    }

    const credit = await creditCoins(supabase, receiverProfile.id, amount)
    if ("error" in credit) {
      const refund = await creditCoins(supabase, sender.id, amount)
      if ("error" in refund) {
        console.error("Wallet gift refund failed after credit failure:", refund.error)
      }
      return NextResponse.json(
        {
          error: "The transfer couldn't be completed, so your coins were returned. Please try again.",
        },
        { status: 502 },
      )
    }

    const giftName =
      typeof body?.gift_name === "string" && body.gift_name.trim()
        ? body.gift_name.trim().slice(0, 80)
        : "Loop Coin Transfer"
    const giftIcon =
      typeof body?.gift_icon === "string" && body.gift_icon.trim()
        ? body.gift_icon.trim().slice(0, 16)
        : "🪙"
    const message =
      typeof body?.message === "string" && body.message.trim()
        ? body.message.trim().slice(0, 140)
        : null

    const senderUsername = senderProfile.username || sender.email?.split("@")[0] || "user"
    const senderName = senderProfile.display_name || senderUsername
    const giftId = `gift-${randomUUID()}`
    const giftRecord = {
      id: giftId,
      sender_id: sender.id,
      sender_username: senderUsername,
      sender_name: senderName,
      sender_avatar: senderProfile.avatar_url || "/placeholder.svg",
      receiver_id: receiverProfile.id,
      receiver_username: receiverProfile.username || cleanUsername,
      coins_amount: amount,
      gift_name: giftName,
      gift_icon: giftIcon,
      message,
      created_at: new Date().toISOString(),
    }

    const { error: giftError } = await supabase.from("coin_gifts").insert(giftRecord)
    if (giftError) {
      console.error("Wallet gift record insert failed:", giftError)
      const [refundSender, reverseRecipient] = await Promise.all([
        creditCoins(supabase, sender.id, amount),
        debitCoins(supabase, receiverProfile.id, amount),
      ])
      if ("error" in refundSender || "error" in reverseRecipient) {
        console.error("Wallet gift rollback incomplete:", {
          refundSender: "error" in refundSender ? refundSender.error : null,
          reverseRecipient: "error" in reverseRecipient ? reverseRecipient.error : null,
        })
      }
      return NextResponse.json(
        { error: "We couldn't save the gift, so your coins were returned. Please try again." },
        { status: 500 },
      )
    }

    const now = new Date().toISOString()
    const { error: ledgerError } = await supabase.from("wallet_transactions").insert([
      {
        id: `tx-send-${randomUUID()}`,
        user_id: sender.id,
        amount_usd: 0,
        coins_amount: -amount,
        type: "gift_sent",
        description: `Sent ${giftName} (${amount.toLocaleString()} coins) to @${receiverProfile.username || cleanUsername}`,
        status: "completed",
        payment_method: "wallet",
        created_at: now,
      },
      {
        id: `tx-recv-${randomUUID()}`,
        user_id: receiverProfile.id,
        amount_usd: 0,
        coins_amount: amount,
        type: "gift_received",
        description: `Received ${giftName} (${amount.toLocaleString()} coins) from @${senderUsername}`,
        status: "completed",
        payment_method: "wallet",
        created_at: now,
      },
    ])

    if (ledgerError) {
      // The transfer itself succeeded. Keep the gift and log the ledger issue
      // rather than rolling back money the recipient can already see.
      console.error("Wallet gift ledger insert failed:", ledgerError)
    }

    return NextResponse.json({
      success: true,
      newBalance: debit.balance,
      message: `Sent ${amount.toLocaleString()} coins to @${receiverProfile.username || cleanUsername}.`,
      gift: giftRecord,
    })
  } catch (error: any) {
    console.error("POST /api/wallet/gift error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
