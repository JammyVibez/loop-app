import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { logAdminAction } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/monetization/coins?user_id=<uuid>
 * Returns the user's balance plus their full coin transaction history.
 */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")
    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

    const supabase = createServerClient()

    const [{ data: profile, error: profileError }, { data: txs, error: txError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, loop_coins, is_premium, premium_expires_at, is_banned")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("coin_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
    ])

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

    // Wallet transactions (Stripe purchases) alongside the coin ledger.
    const { data: walletTxs } = await supabase
      .from("wallet_transactions")
      .select("id, amount_usd, coins_amount, type, description, status, payment_method, created_at, deleted_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)

    return NextResponse.json({
      success: true,
      profile,
      transactions: txs || [],
      wallet_transactions: walletTxs || [],
    })
  } catch (error: any) {
    console.error("GET admin coins error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/monetization/coins
 * Body: { user_id, amount (signed), reason }
 * Manually adds or deducts coins from a user's balance with a required reason.
 */
export async function POST(request: NextRequest) {
  const { response, user: admin } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const userId = String(body.user_id || "")
    const amount = Math.floor(Number(body.amount || 0))
    const reason = String(body.reason || "").trim()

    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    if (!reason) return NextResponse.json({ error: "A reason is required for audit purposes" }, { status: 400 })
    if (!Number.isFinite(amount) || amount === 0)
      return NextResponse.json({ error: "Amount must be a non-zero number (negative to deduct)" }, { status: 400 })

    const supabase = createServerClient()

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, loop_coins")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const current = Number(profile.loop_coins || 0)
    const next = current + amount
    if (next < 0) {
      return NextResponse.json(
        { error: `Deduction would take the balance negative (current: ${current.toLocaleString()})` },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ loop_coins: next, updated_at: new Date().toISOString() })
      .eq("id", userId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    const { data: tx, error: txError } = await supabase
      .from("coin_transactions")
      .insert({
        user_id: userId,
        amount,
        transaction_type: "admin_grant",
        description: `Admin ${amount > 0 ? "added" : "deducted"} ${Math.abs(amount).toLocaleString()} coins: ${reason}`,
        reference_id: null,
      })
      .select()
      .single()

    if (txError) {
      console.error("coin_transactions insert failed after balance change:", txError)
    }

    await logAdminAction(supabase, {
      adminId: admin!.id,
      action: "coin_adjust",
      targetUserId: userId,
      reason,
      details: {
        amount,
        old_balance: current,
        new_balance: next,
        tx_id: tx?.id ?? null,
        username: profile.username,
      },
    })

    return NextResponse.json({ success: true, new_balance: next, transaction: tx ?? null })
  } catch (error: any) {
    console.error("POST admin coins error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/monetization/coins
 * Body: { transaction_id, amount?, description?, reason }
 * Corrects an existing coin transaction record. The user's balance is
 * adjusted by the delta so the ledger stays consistent.
 */
export async function PATCH(request: NextRequest) {
  const { response, user: admin } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const txId = String(body.transaction_id || "")
    const reason = String(body.reason || "").trim()

    if (!txId) return NextResponse.json({ error: "transaction_id is required" }, { status: 400 })
    if (!reason) return NextResponse.json({ error: "A reason is required for audit purposes" }, { status: 400 })

    const supabase = createServerClient()

    const { data: tx, error: txError } = await supabase
      .from("coin_transactions")
      .select("*")
      .eq("id", txId)
      .maybeSingle()

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    const updates: Record<string, unknown> = {}
    let delta = 0

    if (body.amount !== undefined) {
      const newAmount = Math.floor(Number(body.amount))
      if (!Number.isFinite(newAmount) || newAmount === 0)
        return NextResponse.json({ error: "Amount must be a non-zero number" }, { status: 400 })
      delta = newAmount - Number(tx.amount || 0)
      updates.amount = newAmount
    }
    if (typeof body.description === "string" && body.description.trim()) {
      updates.description = body.description.trim()
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from("coin_transactions")
      .update(updates)
      .eq("id", txId)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Keep the balance in sync with the corrected ledger entry.
    let newBalance: number | null = null
    if (delta !== 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("loop_coins")
        .eq("id", tx.user_id)
        .maybeSingle()
      newBalance = Number(profile?.loop_coins || 0) + delta
      if (newBalance < 0) {
        return NextResponse.json(
          { error: `Correction would take the balance negative (${newBalance}) — adjust the amount instead` },
          { status: 400 },
        )
      }
      const { error: balError } = await supabase
        .from("profiles")
        .update({ loop_coins: newBalance, updated_at: new Date().toISOString() })
        .eq("id", tx.user_id)
      if (balError) return NextResponse.json({ error: balError.message }, { status: 500 })
    }

    await logAdminAction(supabase, {
      adminId: admin!.id,
      action: "coin_tx_edit",
      targetUserId: tx.user_id,
      reason,
      details: {
        transaction_id: txId,
        old_amount: tx.amount,
        new_amount: updates.amount ?? tx.amount,
        balance_delta: delta,
        new_balance: newBalance,
        old_description: tx.description,
      },
    })

    return NextResponse.json({ success: true, transaction: updated, new_balance: newBalance })
  } catch (error: any) {
    console.error("PATCH admin coins error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/monetization/coins?transaction_id=<uuid>&reason=<text>
 * Deletes a coin transaction record (with confirmation handled client-side)
 * and reverses its effect on the user's balance so the ledger stays honest.
 */
export async function DELETE(request: NextRequest) {
  const { response, user: admin } = await requireAdmin(request)
  if (response) return response

  try {
    const { searchParams } = new URL(request.url)
    const txId = searchParams.get("transaction_id")
    const reason = searchParams.get("reason") || ""
    if (!txId) return NextResponse.json({ error: "transaction_id is required" }, { status: 400 })
    if (!reason.trim()) return NextResponse.json({ error: "A reason is required for audit purposes" }, { status: 400 })

    const supabase = createServerClient()

    const { data: tx, error: txError } = await supabase
      .from("coin_transactions")
      .select("*")
      .eq("id", txId)
      .maybeSingle()

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    // Reverse the transaction's effect on the balance before deleting it.
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", tx.user_id)
      .maybeSingle()

    const newBalance = Number(profile?.loop_coins || 0) - Number(tx.amount || 0)
    if (newBalance < 0) {
      return NextResponse.json(
        { error: `Deleting would take the balance negative (${newBalance}) — deduct coins manually instead` },
        { status: 400 },
      )
    }

    const { error: deleteError } = await supabase.from("coin_transactions").delete().eq("id", txId)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    const { error: balError } = await supabase
      .from("profiles")
      .update({ loop_coins: newBalance, updated_at: new Date().toISOString() })
      .eq("id", tx.user_id)
    if (balError) {
      // Restore the ledger entry if the balance update failed so records stay consistent.
      await supabase.from("coin_transactions").insert(tx)
      return NextResponse.json({ error: balError.message }, { status: 500 })
    }

    await logAdminAction(supabase, {
      adminId: admin!.id,
      action: "coin_tx_delete",
      targetUserId: tx.user_id,
      reason,
      details: {
        deleted_transaction: tx,
        balance_reversal: -Number(tx.amount || 0),
        new_balance: newBalance,
      },
    })

    return NextResponse.json({ success: true, new_balance: newBalance })
  } catch (error: any) {
    console.error("DELETE admin coins error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
