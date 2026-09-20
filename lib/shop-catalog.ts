/**
 * What the shop knows about an item, with no React in sight.
 *
 * The shelves, the filters and the sorting live here so they can be checked
 * against the real catalogue in a test — the interesting bugs in a shop are
 * classification bugs (an item filed on two shelves, or none at all), and those
 * are invisible until someone notices something missing.
 */

/** A row of `shop_items`, as the public endpoint returns it. */
export interface ShopCatalogItem {
  id: string
  name: string
  description: string
  price: number
  price_coins?: number | null
  price_usd?: number | null
  category: string
  item_type: string
  rarity: string
  premium_only: boolean
  is_active?: boolean
  item_data: any
  preview_data?: any
  created_at?: string
  purchase_count?: number
}

/**
 * Which shelf an item belongs on.
 *
 * An explicit table rather than a keyword match, because the two overlap: every
 * theme carries `item_type: "profile_theme"`, so a substring search for
 * "profile" files all twenty of them under the profile shelf as well. Unknown
 * categories land in `other` and stay reachable there instead of vanishing.
 */
export const SHOP_BUCKETS: Record<string, string> = {
  theme: "theme",
  animation: "effect",
  effect: "effect",
  card_effect: "effect",
  avatar: "identity",
  badge: "identity",
  font: "identity",
  premium: "identity",
  coins: "coins",
}

export function shopBucket(item: Pick<ShopCatalogItem, "category">): string {
  return SHOP_BUCKETS[(item.category || "").toLowerCase()] || "other"
}

export type ShopBucketId = "featured" | "theme" | "effect" | "identity" | "coins" | "other" | "cosmetics"

export const RARITY_RANK: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }

export function rarityRank(rarity?: string | null): number {
  return RARITY_RANK[(rarity || "").toLowerCase()] || 0
}

/** Coins an item costs — `price_coins` is canonical, `price` is the legacy column. */
export function coinPrice(item: Pick<ShopCatalogItem, "price" | "price_coins">): number {
  return Number(item.price_coins ?? item.price ?? 0) || 0
}

export function usdPrice(item: Pick<ShopCatalogItem, "price_usd">): number {
  return Number(item.price_usd || 0) || 0
}

export type ShopSortId = "featured" | "new" | "cheap" | "expensive"

export const SHOP_SORTS: Array<{ id: ShopSortId; label: string }> = [
  { id: "featured", label: "Featured" },
  { id: "new", label: "Newest" },
  { id: "cheap", label: "Price: low to high" },
  { id: "expensive", label: "Price: high to low" },
]

/**
 * Order a shelf. Returns a new array — the caller's list is React state and
 * sorting it in place would reorder the source of truth.
 *
 * `featured` is the shop's own opinion: rarest first, then whatever has sold
 * most, then the pricier of two otherwise equal items.
 */
export function sortShopItems(items: ShopCatalogItem[], sort: ShopSortId): ShopCatalogItem[] {
  const newestFirst = (a: ShopCatalogItem, b: ShopCatalogItem) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))

  return [...items].sort((a, b) => {
    if (sort === "new") return newestFirst(a, b)
    if (sort === "cheap") return coinPrice(a) - coinPrice(b) || rarityRank(b.rarity) - rarityRank(a.rarity)
    if (sort === "expensive") return coinPrice(b) - coinPrice(a) || rarityRank(b.rarity) - rarityRank(a.rarity)
    return (
      rarityRank(b.rarity) - rarityRank(a.rarity) ||
      Number(b.purchase_count || 0) - Number(a.purchase_count || 0) ||
      coinPrice(b) - coinPrice(a)
    )
  })
}

/** Does an item match a text query? Names, descriptions and both category columns. */
export function matchesQuery(item: ShopCatalogItem, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return `${item.name} ${item.description || ""} ${item.category} ${item.item_type}`
    .toLowerCase()
    .includes(needle)
}
