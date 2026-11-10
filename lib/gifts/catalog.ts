/**
 * The canonical gift catalog.
 *
 * These gifts are the product's live gifting line-up. They are defined in code
 * — not only seeded in `shop_items` — so a missing, renamed or repriced catalog
 * row can never break sending or rendering:
 *
 *   • the panel always has the full line-up with real artwork,
 *   • the send API charges the catalog price, never a client-supplied price,
 *   • the animation layer always knows which effect to play,
 *   • the receiver can see what a gift does and what it is worth in coins.
 *
 * Prices and conversion values are the product's prices. Change them here and
 * the matching row in `scripts/premium-shop-catalog.sql` together.
 */

export type GiftRarity = "common" | "rare" | "epic" | "legendary"

/** Gift types. Matches the values the `gifts.gift_type` enum accepts. */
export type GiftType = "coins" | "premium" | "theme" | "animation" | "effect" | "badge"

/** What the receiver gets from a gift, independent of its animation type. */
export type GiftUse =
  | "currency"
  | "standard"
  | "boost"
  | "support"
  | "interactive"
  | "exclusive"
  | "utility"
  | "premium"

export type GiftPanelTab =
  | "coins"
  | "badge"
  | "boost"
  | "support"
  | "interactive"
  | "premium"
  | "utility"

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
  use: GiftUse
  /** Plain-language purpose shown while sending and receiving. */
  useLabel: string
  /** What the recipient actually gets. */
  effect: string
  /** Server-owned coin value if the recipient converts this gift. */
  coinValue: number
  /** Duration of a timed effect (badge, highlight, boost). */
  effectHours?: number
  /** Boost coins added to the post this gift was sent on. */
  boostAmount?: number
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
    use: "standard",
    useLabel: "Collectible",
    effect: "Adds Pixel Heart to your gift collection.",
    coinValue: 200,
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
    use: "standard",
    useLabel: "Collectible",
    effect: "Adds Cute Cat to your gift collection.",
    coinValue: 240,
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
    use: "support",
    useLabel: "Supporter badge",
    effect: "Adds a Golden Trophy collectible and a 7-day supporter badge.",
    coinValue: 650,
    effectHours: 168,
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
    use: "exclusive",
    useLabel: "Exclusive collectible",
    effect: "Adds Rainbow Unicorn to your collection and unlocks a 30-day profile glow.",
    coinValue: 1000,
    effectHours: 720,
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
    use: "exclusive",
    useLabel: "Exclusive collectible",
    effect: "Adds Royal Crown to your collection and a 30-day crown badge.",
    coinValue: 1700,
    effectHours: 720,
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
    use: "interactive",
    useLabel: "Reaction unlock",
    effect: "Unlocks the Rocket Launch reaction animation in your collection.",
    coinValue: 480,
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
    use: "interactive",
    useLabel: "Reaction unlock",
    effect: "Unlocks the Dragon Flame reaction animation in your collection.",
    coinValue: 720,
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
    use: "exclusive",
    useLabel: "Exclusive animation",
    effect: "Adds Galaxy Blast to your collection and a 30-day cosmic profile glow.",
    coinValue: 4200,
    effectHours: 720,
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
    use: "exclusive",
    useLabel: "Exclusive animation",
    effect: "Adds Supercar to your collection and a 30-day speed profile glow.",
    coinValue: 5500,
    effectHours: 720,
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
    use: "utility",
    useLabel: "24-hour highlight",
    effect: "Puts a Shooting Star highlight on your profile for 24 hours.",
    coinValue: 900,
    effectHours: 24,
    rarity: "rare",
    price: 1200,
    durationMs: 7000,
    art: "shooting-star",
    celebration: "meteor",
    palette: { primary: "#fde68a", secondary: "#a78bfa", accent: "#e0f2fe" },
    sound: "whoosh",
  },
  {
    id: "gift-signal-flare",
    slug: "shooting-star",
    name: "Signal Flare",
    description: "A bright flare that sends a post climbing through the feed.",
    type: "animation",
    use: "boost",
    useLabel: "Post boost",
    effect: "Adds 100 boost coins to the post it was sent on. Falls back to a 6-hour profile highlight.",
    coinValue: 320,
    effectHours: 6,
    boostAmount: 100,
    rarity: "rare",
    price: 450,
    durationMs: 5000,
    art: "shooting-star",
    celebration: "meteor",
    palette: { primary: "#fb923c", secondary: "#fde68a", accent: "#fff7ed" },
    sound: "whoosh",
  },
  {
    id: "gift-spotlight",
    slug: "golden-trophy",
    name: "Spotlight",
    description: "A warm spotlight that puts you in front of the room.",
    type: "badge",
    use: "utility",
    useLabel: "Profile highlight",
    effect: "Puts a Spotlight highlight on your profile for 24 hours.",
    coinValue: 650,
    effectHours: 24,
    rarity: "epic",
    price: 900,
    durationMs: 6000,
    art: "golden-trophy",
    celebration: "gold",
    palette: { primary: "#fbbf24", secondary: "#fde68a", accent: "#fffbeb" },
    sound: "chime",
  },
  {
    id: "gift-guardian-rose",
    slug: "pixel-heart",
    name: "Guardian Rose",
    description: "A soft rose for someone who always has your back.",
    type: "badge",
    use: "support",
    useLabel: "Supporter badge",
    effect: "Adds a Guardian Rose collectible and a 7-day supporter badge.",
    coinValue: 280,
    effectHours: 168,
    rarity: "common",
    price: 350,
    durationMs: 5500,
    art: "pixel-heart",
    celebration: "hearts",
    palette: { primary: "#fb7185", secondary: "#fecdd3", accent: "#fff1f2" },
    sound: "pop",
  },
  {
    id: "gift-gilded-laurel",
    slug: "golden-trophy",
    name: "Gilded Laurel",
    description: "A golden laurel for the supporter everyone remembers.",
    type: "badge",
    use: "support",
    useLabel: "30-day supporter badge",
    effect: "Adds a Gilded Laurel collectible and a 30-day supporter badge.",
    coinValue: 1250,
    effectHours: 720,
    rarity: "epic",
    price: 1600,
    durationMs: 7200,
    art: "golden-trophy",
    celebration: "gold",
    palette: { primary: "#d4a017", secondary: "#fde68a", accent: "#fffbeb" },
    sound: "chime",
  },
  {
    id: "gift-echo-heart",
    slug: "pixel-heart",
    name: "Echo Heart",
    description: "A heartbeat that ripples back as a sparkling reaction.",
    type: "animation",
    use: "interactive",
    useLabel: "Reaction unlock",
    effect: "Unlocks the Heart Echo reaction animation in your collection.",
    coinValue: 350,
    rarity: "rare",
    price: 500,
    durationMs: 6200,
    art: "pixel-heart",
    celebration: "hearts",
    palette: { primary: "#f472b6", secondary: "#c4b5fd", accent: "#fdf2f8" },
    sound: "pop",
  },
  {
    id: "gift-fireworks-finale",
    slug: "galaxy-blast",
    name: "Fireworks Finale",
    description: "A sky-filling finale that turns any moment into an event.",
    type: "animation",
    use: "interactive",
    useLabel: "Reaction unlock",
    effect: "Unlocks the Fireworks Finale reaction animation in your collection.",
    coinValue: 520,
    rarity: "epic",
    price: 750,
    durationMs: 8500,
    art: "galaxy-blast",
    celebration: "confetti",
    palette: { primary: "#f97316", secondary: "#a855f7", accent: "#fef3c7" },
    sound: "boom",
  },
  {
    id: "gift-midnight-throne",
    slug: "royal-crown",
    name: "Midnight Throne",
    description: "A dark-jewelled crown for the quiet ruler of the night.",
    type: "badge",
    use: "exclusive",
    useLabel: "30-day exclusive",
    effect: "Adds Midnight Throne to your collection and a 30-day exclusive badge and glow.",
    coinValue: 2400,
    effectHours: 720,
    rarity: "legendary",
    price: 3000,
    durationMs: 8000,
    art: "royal-crown",
    celebration: "gold",
    palette: { primary: "#6366f1", secondary: "#a78bfa", accent: "#e0e7ff" },
    sound: "chime",
  },
  {
    id: "gift-cosmic-aurora",
    slug: "rainbow-unicorn",
    name: "Cosmic Aurora",
    description: "An aurora that wraps your profile in living light.",
    type: "animation",
    use: "exclusive",
    useLabel: "30-day exclusive",
    effect: "Adds Cosmic Aurora to your collection and a 30-day animated profile glow.",
    coinValue: 6500,
    effectHours: 720,
    rarity: "legendary",
    price: 8000,
    durationMs: 11000,
    art: "rainbow-unicorn",
    celebration: "galaxy",
    palette: { primary: "#22d3ee", secondary: "#a78bfa", accent: "#cffafe" },
    sound: "chime",
  },
  {
    id: "gift-priority-reply",
    slug: "golden-rocket",
    name: "Priority Reply",
    description: "A little lift that makes your next reply impossible to miss.",
    type: "effect",
    use: "utility",
    useLabel: "24-hour reply highlight",
    effect: "Puts a Priority Reply highlight on your profile for 24 hours.",
    coinValue: 420,
    effectHours: 24,
    rarity: "rare",
    price: 600,
    durationMs: 5000,
    art: "golden-rocket",
    celebration: "launch",
    palette: { primary: "#38bdf8", secondary: "#a78bfa", accent: "#e0f2fe" },
    sound: "whoosh",
  },
  {
    id: "gift-hype-train",
    slug: "supercar",
    name: "Hype Train",
    description: "A full-throttle arrival that pushes a post into the fast lane.",
    type: "animation",
    use: "boost",
    useLabel: "12-hour post boost",
    effect: "Adds 300 boost coins to the post it was sent on. Falls back to a 12-hour profile highlight.",
    coinValue: 1000,
    effectHours: 12,
    boostAmount: 300,
    rarity: "legendary",
    price: 1400,
    durationMs: 9500,
    art: "supercar",
    celebration: "speed",
    palette: { primary: "#f43f5e", secondary: "#fb923c", accent: "#ffe4e6" },
    sound: "whoosh",
  },
]

export const GIFT_PANEL_TABS = [
  { id: "coins", label: "Coins" },
  { id: "badge", label: "Standard" },
  { id: "boost", label: "Boost" },
  { id: "support", label: "Support" },
  { id: "interactive", label: "Interactive" },
  { id: "premium", label: "Exclusive" },
  { id: "utility", label: "Utility" },
] as const

export type GiftTabId = (typeof GIFT_PANEL_TABS)[number]["id"]

export function giftPanelTabForUse(use?: string | null): GiftTabId {
  switch (String(use || "").toLowerCase()) {
    case "currency":
      return "coins"
    case "boost":
      return "boost"
    case "support":
      return "support"
    case "interactive":
      return "interactive"
    case "exclusive":
    case "premium":
      return "premium"
    case "utility":
      return "utility"
    default:
      return "badge"
  }
}

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
    case "effect":
      return "interactive"
    default:
      // Badges, gift items, themes and specials all read as collectible gifts.
      return "badge"
  }
}

/** Colors used by the panel's generic fallback art for catalogue gifts. */
export const GIFT_TYPE_PALETTE: Record<GiftTabId, { primary: string; secondary: string }> = {
  coins: { primary: "#fbbf24", secondary: "#fde68a" },
  badge: { primary: "#a78bfa", secondary: "#f472b6" },
  boost: { primary: "#fb923c", secondary: "#fde68a" },
  support: { primary: "#f472b6", secondary: "#fecdd3" },
  interactive: { primary: "#22d3ee", secondary: "#818cf8" },
  premium: { primary: "#fbbf24", secondary: "#a78bfa" },
  utility: { primary: "#38bdf8", secondary: "#a78bfa" },
}
