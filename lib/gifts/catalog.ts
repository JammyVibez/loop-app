/**
 * The canonical gift catalog.
 *
 * These ten gifts are the product's core live-room gifting line-up. They are
 * defined in code — not only seeded in `shop_items` — so a missing, renamed or
 * repriced catalog row can never break sending or rendering:
 *
 *   • the panel always has the full line-up with real artwork,
 *   • the send API charges the catalog price, never a client-supplied price,
 *   • the animation layer always knows which effect to play.
 *
 * Prices are the product's prices. Change them here and the row in
 * `scripts/premium-shop-catalog.sql` together.
 */

export type GiftRarity = "common" | "rare" | "epic" | "legendary"

/** Gift types. Matches the values the `gifts.gift_type` enum accepts. */
export type GiftType = "coins" | "premium" | "theme" | "animation" | "effect" | "badge"

export type GiftArt =
  | "pixel-heart"
  | "cute-cat"
  | "golden-trophy"
  | "rainbow-unicorn"
  | "royal-crown"
  | "golden-rocket"
  | "dragon-flame"
  | "galaxy-blast"
  | "supercar"
  | "shooting-star"

export type CelebrationStyle =
  | "hearts"
  | "paws"
  | "confetti"
  | "rainbow"
  | "gold"
  | "launch"
  | "flame"
  | "galaxy"
  | "speed"
  | "meteor"

export interface CanonicalGift {
  /** Stable id used as `gift_item_id` by the client. */
  id: string
  slug: GiftArt
  name: string
  /** Short card copy — one line. */
  description: string
  type: GiftType
  category: "badge" | "animation" | "effect"
  rarity: GiftRarity
  price: number
  /** Full-screen effect length. The panel shows this as "8s". */
  durationMs: number
  art: GiftArt
  celebration: CelebrationStyle
  palette: { primary: string; secondary: string; accent: string }
  /** Optional ambient sound name; playback is opt-in and muted by default. */
  sound?: "chime" | "pop" | "whoosh" | "boom"
}

export const CANONICAL_GIFTS: CanonicalGift[] = [
  {
    id: "gift-pixel-heart",
    slug: "pixel-heart",
    name: "Pixel Heart",
    description: "A chunky 8-bit heart that bursts into pixels.",
    type: "badge",
    category: "badge",
    rarity: "common",
    price: 250,
    durationMs: 6000,
    art: "pixel-heart",
    celebration: "hearts",
    palette: { primary: "#ff3d7f", secondary: "#ff8fb1", accent: "#ffe0ea" },
    sound: "pop",
  },
  {
    id: "gift-cute-cat",
    slug: "cute-cat",
    name: "Cute Cat",
    description: "A sleepy little cat with a ribbon and warm sparkles.",
    type: "badge",
    category: "badge",
    rarity: "common",
    price: 300,
    durationMs: 6500,
    art: "cute-cat",
    celebration: "paws",
    palette: { primary: "#ffb26b", secondary: "#ffd8a8", accent: "#fff3e2" },
    sound: "pop",
  },
  {
    id: "gift-golden-trophy",
    slug: "golden-trophy",
    name: "Golden Trophy",
    description: "A champion's trophy with a shower of gold.",
    type: "badge",
    category: "badge",
    rarity: "epic",
    price: 800,
    durationMs: 7000,
    art: "golden-trophy",
    celebration: "confetti",
    palette: { primary: "#f5c542", secondary: "#ffe89a", accent: "#b7791f" },
    sound: "chime",
  },
  {
    id: "gift-rainbow-unicorn",
    slug: "rainbow-unicorn",
    name: "Rainbow Unicorn",
    description: "A prism-maned unicorn that paints the room in colour.",
    type: "badge",
    category: "badge",
    rarity: "legendary",
    price: 1200,
    durationMs: 8500,
    art: "rainbow-unicorn",
    celebration: "rainbow",
    palette: { primary: "#f472b6", secondary: "#a78bfa", accent: "#67e8f9" },
    sound: "chime",
  },
  {
    id: "gift-royal-crown",
    slug: "royal-crown",
    name: "Royal Crown",
    description: "A jewelled crown for the one who rules the room.",
    type: "badge",
    category: "badge",
    rarity: "epic",
    price: 2000,
    durationMs: 7500,
    art: "royal-crown",
    celebration: "gold",
    palette: { primary: "#fbbf24", secondary: "#a78bfa", accent: "#fef3c7" },
    sound: "chime",
  },
  {
    id: "gift-golden-rocket",
    slug: "golden-rocket",
    name: "Golden Rocket",
    description: "A gilded rocket that launches straight off the screen.",
    type: "animation",
    category: "animation",
    rarity: "rare",
    price: 600,
    durationMs: 7000,
    art: "golden-rocket",
    celebration: "launch",
    palette: { primary: "#fbbf24", secondary: "#fb923c", accent: "#fff7ed" },
    sound: "whoosh",
  },
  {
    id: "gift-dragon-flame",
    slug: "dragon-flame",
    name: "Dragon Flame",
    description: "A dragon's breath rolls across the stage in embers.",
    type: "animation",
    category: "animation",
    rarity: "rare",
    price: 900,
    durationMs: 8000,
    art: "dragon-flame",
    celebration: "flame",
    palette: { primary: "#ef4444", secondary: "#f97316", accent: "#fde68a" },
    sound: "boom",
  },
  {
    id: "gift-galaxy-blast",
    slug: "galaxy-blast",
    name: "Galaxy Blast",
    description: "A cosmic explosion of stars, dust and gravity.",
    type: "animation",
    category: "animation",
    rarity: "legendary",
    price: 5000,
    durationMs: 10000,
    art: "galaxy-blast",
    celebration: "galaxy",
    palette: { primary: "#a855f7", secondary: "#22d3ee", accent: "#f0abfc" },
    sound: "boom",
  },
  {
    id: "gift-supercar",
    slug: "supercar",
    name: "Supercar",
    description: "A hypercar drifts through the room at full throttle.",
    type: "animation",
    category: "animation",
    rarity: "legendary",
    price: 6500,
    durationMs: 9000,
    art: "supercar",
    celebration: "speed",
    palette: { primary: "#ef4444", secondary: "#f97316", accent: "#fde68a" },
    sound: "whoosh",
  },
  {
    id: "gift-shooting-star",
    slug: "shooting-star",
    name: "Shooting Star",
    description: "A wishing star streaks past and leaves a trail of light.",
    type: "effect",
    category: "effect",
    rarity: "rare",
    price: 1200,
    durationMs: 7000,
    art: "shooting-star",
    celebration: "meteor",
    palette: { primary: "#fde68a", secondary: "#a78bfa", accent: "#e0f2fe" },
    sound: "whoosh",
  },
]

export const GIFT_PANEL_TABS = [
  { id: "coins", label: "Coins" },
  { id: "badge", label: "Badge" },
  { id: "animation", label: "Animation" },
  { id: "effect", label: "Effect" },
  { id: "premium", label: "Premium" },
] as const

export type GiftTabId = (typeof GIFT_PANEL_TABS)[number]["id"]

export function findCanonicalGift(input?: string | null): CanonicalGift | null {
  if (!input) return null
  const key = String(input).trim().toLowerCase()
  return (
    CANONICAL_GIFTS.find(
      (gift) =>
        gift.id.toLowerCase() === key ||
        gift.slug === key ||
        gift.name.toLowerCase() === key ||
        `gift: ${gift.name.toLowerCase()}` === key,
    ) || null
  )
}

export function giftDurationLabel(ms: number) {
  return `${Math.round(ms / 1000)}s`
}

export function giftTypeForTab(type?: string | null): GiftTabId {
  switch (String(type || "").toLowerCase()) {
    case "coins":
    case "currency":
      return "coins"
    case "premium":
      return "premium"
    case "animation":
      return "animation"
    case "effect":
      return "effect"
    default:
      // Badges, gift items, themes and specials all read as collectible gifts.
      return "badge"
  }
}

/** Colors used by the panel's generic fallback art for catalogue gifts. */
export const GIFT_TYPE_PALETTE: Record<GiftTabId, { primary: string; secondary: string }> = {
  coins: { primary: "#fbbf24", secondary: "#fde68a" },
  badge: { primary: "#a78bfa", secondary: "#f472b6" },
  animation: { primary: "#22d3ee", secondary: "#818cf8" },
  effect: { primary: "#f0abfc", secondary: "#a855f7" },
  premium: { primary: "#fbbf24", secondary: "#a78bfa" },
}
