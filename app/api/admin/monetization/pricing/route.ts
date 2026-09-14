import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { logAdminAction } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

const COIN_CATEGORY = "coins"

function toCents(usd: number): number {
  return Math.round(usd * 100)
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const supabase = createServerClient()

    const { data: tiers, error } = await supabase
      .from("shop_items")
      .select("id, name, description, price_usd, item_data, rarity, is_active, purchase_count, created_at, updated_at, sort_order")
      .eq("category", COIN_CATEGORY)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("item_data->coins_amount", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: history } = await supabase
      .from("pricing_change_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)

    return NextResponse.json({ success: true, tiers: tiers || [], history: history || [] })
  } catch (error: any) {
    console.error("GET pricing tiers error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const name = String(body.name || "").trim()
    const coinsAmount = Math.floor(Number(body.coins_amount || 0))
    const bonus = Math.max(0, Math.floor(Number(body.bonus || 0)))
    const priceUsd = Number(body.price_usd || 0)
    const rarity = ["common", "rare", "epic", "legendary"].includes(body.rarity) ? body.rarity : "common"
    const isActive = body.is_active !== false

    if (!name) return NextResponse.json({ error: "Package name is required" }, { status: 400 })
    if (!Number.isFinite(coinsAmount) || coinsAmount <= 0)
      return NextResponse.json({ error: "Coins amount must be a positive number" }, { status: 400 })
    if (!Number.isFinite(priceUsd) || priceUsd < 0.5)
      return NextResponse.json({ error: "Price must be at least $0.50" }, { status: 400 })

    const supabase = createServerClient()

    const { data: maxRow } = await supabase
      .from("shop_items")
      .select("sort_order")
      .eq("category", COIN_CATEGORY)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    const nextSort = Number(maxRow?.sort_order ?? 0) + 1

    const { data: tier, error } = await supabase
      .from("shop_items")
      .insert({
        name,
        description: String(body.description || `${(coinsAmount + bonus).toLocaleString()} Loop Coins`).trim(),
        price: 0,
        price_coins: null,
        price_usd: priceUsd,
        category: COIN_CATEGORY,
        item_type: "currency",
        rarity,
        premium_only: false,
        item_data: { coins_amount: coinsAmount, bonus },
        preview_data: { preview: coinsAmount >= 10000 ? "👑" : coinsAmount >= 1000 ? "💎" : "🪙" },
        metadata: { kind: "coin_pack", managed_by: "admin_panel" },
        is_active: isActive,
        sort_order: nextSort,
        created_by: user!.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAdminAction(supabase, {
      adminId: user!.id,
      action: "coin_pricing_create",
      targetUserId: null,
      reason: String(body.reason || "").trim() || null,
      details: { tier_id: tier.id, name, coins_amount: coinsAmount, bonus, price_usd: priceUsd },
    })

    return NextResponse.json({ success: true, tier })
  } catch (error: any) {
    console.error("POST pricing tier error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { response, user } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const { id } = body
    if (!id) return NextResponse.json({ error: "Tier id is required" }, { status: 400 })

    const supabase = createServerClient()

    const { data: existing } = await supabase
      .from("shop_items")
      .select("id, name, price_usd, item_data, is_active")
      .eq("id", id)
      .eq("category", COIN_CATEGORY)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: "Coin package not found" }, { status: 404 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim()
    if (typeof body.description === "string") updates.description = body.description.trim()

    const oldPrice = Number(existing.price_usd || 0)
    let newPrice = oldPrice
    if (body.price_usd !== undefined) {
      newPrice = Number(body.price_usd)
      if (!Number.isFinite(newPrice) || newPrice < 0.5)
        return NextResponse.json({ error: "Price must be at least $0.50" }, { status: 400 })
      updates.price_usd = newPrice
    }

    const oldData = (existing.item_data || {}) as { coins_amount?: number; bonus?: number }
    const newData: { coins_amount?: number; bonus?: number } = { ...oldData }
    if (body.coins_amount !== undefined) {
      const coinsAmount = Math.floor(Number(body.coins_amount))
      if (!Number.isFinite(coinsAmount) || coinsAmount <= 0)
        return NextResponse.json({ error: "Coins amount must be positive" }, { status: 400 })
      newData.coins_amount = coinsAmount
    }
    if (body.bonus !== undefined) newData.bonus = Math.max(0, Math.floor(Number(body.bonus) || 0))
    if (newData.coins_amount !== oldData.coins_amount || newData.bonus !== oldData.bonus) {
      updates.item_data = newData
    }

    if (["common", "rare", "epic", "legendary"].includes(body.rarity)) updates.rarity = body.rarity
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active
    if (body.sort_order !== undefined) updates.sort_order = Math.floor(Number(body.sort_order) || 0)

    const { data: tier, error } = await supabase
      .from("shop_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Price changes are recorded in the dedicated pricing history table so the
    // admin can see old price, new price, who changed it, and when.
    if (toCents(newPrice) !== toCents(oldPrice)) {
      await supabase.from("pricing_change_log").insert({
        tier_id: id,
        tier_name: (updates.name as string) || existing.name,
        old_price: oldPrice,
        new_price: newPrice,
        changed_by: user!.id,
        reason: String(body.reason || "").trim() || null,
      })
    }

    await logAdminAction(supabase, {
      adminId: user!.id,
      action: "coin_pricing_update",
      reason: String(body.reason || "").trim() || null,
      details: {
        tier_id: id,
        name: updates.name || existing.name,
        price_changed: toCents(newPrice) !== toCents(oldPrice),
        old_price: oldPrice,
        new_price: newPrice,
        coins_amount: newData.coins_amount,
        bonus: newData.bonus,
        is_active: updates.is_active,
      },
    })

    return NextResponse.json({ success: true, tier })
  } catch (error: any) {
    console.error("PATCH pricing tier error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { response, user } = await requireAdmin(request)
  if (response) return response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const reason = searchParams.get("reason")
    if (!id) return NextResponse.json({ error: "Tier id is required" }, { status: 400 })

    const supabase = createServerClient()

    const { data: existing } = await supabase
      .from("shop_items")
      .select("id, name, price_usd, purchase_count")
      .eq("id", id)
      .eq("category", COIN_CATEGORY)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: "Coin package not found" }, { status: 404 })

    // Soft-delete (deactivate) when the tier has sales history; hard-delete only
    // never-purchased tiers so past checkouts keep a valid record.
    const hasSales = Number(existing.purchase_count || 0) > 0
    if (hasSales) {
      const { error } = await supabase
        .from("shop_items")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from("shop_items").delete().eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminAction(supabase, {
      adminId: user!.id,
      action: hasSales ? "coin_pricing_deactivate" : "coin_pricing_delete",
      reason: reason || null,
      details: { tier_id: id, name: existing.name, had_sales: hasSales },
    })

    return NextResponse.json({ success: true, soft_deleted: hasSales })
  } catch (error: any) {
    console.error("DELETE pricing tier error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
