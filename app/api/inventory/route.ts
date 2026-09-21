import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)


/** The fields an inventory row now carries about itself (see the migration). */
const SNAPSHOT_COLUMNS =
  "id, user_id, item_id, item_type, is_active, acquired_at, item_name, item_data, preview_data, category, rarity"

/** "avatar_effect" → "Avatar effect" — a readable last resort for an item_name. */
function humanize(value: unknown): string {
  const text = String(value || "").replace(/[_-]+/g, " ").trim()
  if (!text) return ""
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * One inventory row, resolved against the live catalogue with the row's own
 * snapshot as the fallback.
 *
 * `item_id` is nullable and the foreign key clears it whenever a catalogue row
 * is deleted, so the join is an enrichment, never the source of truth. Returns
 * null for a row that names nothing at all — the caller drops those instead of
 * shipping a card labelled "Item".
 */
function mapItem(row: any, shop: any) {
  const itemType = row.item_type || shop?.item_type || shop?.category || "item"
  const name = shop?.name || row.item_name || humanize(row.item_type)
  if (!name) return null

  return {
    id: row.id,
    item_id: row.item_id,
    item_type: itemType,
    item_name: name,
    item_data: shop?.item_data || row.item_data || {},
    preview_data: shop?.preview_data || row.preview_data || {},
    rarity: shop?.rarity || row.rarity || "common",
    category: shop?.category || row.category || itemType,
    is_active: Boolean(row.is_active),
    purchased_at: row.acquired_at,
    acquired_at: row.acquired_at,
    // Null once the catalogue row is gone; the client renders from the snapshot.
    shop_item: shop || null,
  }
}

export async function GET(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Plain inventory rows — the join via FK can fail if the schema cache is
    // stale, and every field this route needs now lives on the row itself.
    const { data: inventory, error } = await supabase
      .from("user_inventory")
      .select(SNAPSHOT_COLUMNS)
      .eq("user_id", user.id)
      .order("acquired_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Inventory query error:", error)
      return NextResponse.json({ error: error.message || "Failed to fetch inventory" }, { status: 500 })
    }

    const rows = inventory || []
    const itemIds = Array.from(new Set(rows.map((r) => r.item_id).filter(Boolean)))

    let shopById = new Map<string, any>()
    if (itemIds.length > 0) {
      const { data: shops } = await supabase.from("shop_items").select("*").in("id", itemIds)
      for (const shop of shops || []) shopById.set(shop.id, shop)
    }

    const unresolved: string[] = []
    const items = rows
      .map((row) => {
        const item = mapItem(row, shopById.get(row.item_id) || null)
        if (!item) unresolved.push(String(row.id))
        return item
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    if (unresolved.length > 0) {
      // A row that names nothing is a data problem, not a card to render. Report
      // it so it can be reconciled instead of showing up as a blank tile.
      console.warn(`Inventory rows with no resolvable item skipped: ${unresolved.join(", ")}`)
    }

    return NextResponse.json({
      success: true,
      items,
      unresolved: unresolved.length,
      hasMore: items.length === limit,
    })
  } catch (error) {
    console.error("Error fetching inventory:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
