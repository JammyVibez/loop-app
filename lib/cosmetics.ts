import type { CSSProperties } from "react"

export type CosmeticItem = {
  id?: string
  item_id?: string
  item_type?: string
  name?: string
  category?: string
  rarity?: string
  icon_url?: string | null
  preview_url?: string | null
  color?: string | null
  glow?: boolean
  particles?: boolean
  item_data?: Record<string, any>
  shop_item?: any
}

export type ActiveCosmetics = {
  badge?: CosmeticItem | null
  frame?: CosmeticItem | null
  aura?: CosmeticItem | null
  effect?: CosmeticItem | null
  /** Custom display-name font, admin-managed via the cosmetics catalog. */
  font?: CosmeticItem | null
  /** Post/loop card border-and-glow effect, admin-managed via the cosmetics catalog. */
  cardEffect?: CosmeticItem | null
  /** Equipped sound/notification tone — plays on like / new message etc. */
  sound?: CosmeticItem | null
}

export type AvatarFrameVariant = "none" | "ring_rotate" | "orbit_particles" | "pulse_glow" | "tilt_3d"
export type CardEffectVariant = "none" | "gradient_border" | "shimmer" | "pulse_edge"
export type PfpInteractionVariant = "none" | "burst" | "bounce" | "pulse"

export type CosmeticVariants = {
  frame?: AvatarFrameVariant
  card?: CardEffectVariant
  pfp?: PfpInteractionVariant
}

/**
 * Resolve the animated variant a cosmetic declares in its item_data.
 * Admin-created catalog items just set e.g. `frame_variant: "ring_rotate"`
 * in item_data — no redeploy needed for new variants.
 */
export function cosmeticVariants(item?: CosmeticItem | null): CosmeticVariants {
  const data = item?.item_data || {}
  const frame: AvatarFrameVariant =
    data.frame_variant === "ring_rotate" ||
    data.frame_variant === "orbit_particles" ||
    data.frame_variant === "pulse_glow" ||
    data.frame_variant === "tilt_3d"
      ? data.frame_variant
      : "none"
  const card: CardEffectVariant =
    data.card_variant === "gradient_border" ||
    data.card_variant === "shimmer" ||
    data.card_variant === "pulse_edge"
      ? data.card_variant
      : "none"
  const pfp: PfpInteractionVariant =
    data.pfp_interaction === "burst" ||
    data.pfp_interaction === "bounce" ||
    data.pfp_interaction === "pulse"
      ? data.pfp_interaction
      : "none"
  return { frame, card, pfp }
}

/** Gradient pair derived from a cosmetic's color config. */
export function cosmeticGradient(item?: CosmeticItem | null, fallback = "#8b5cf6"): string {
  const data = item?.item_data || {}
  const c = data.colors || {}
  const primary = c.primary || item?.color || data.color || data.glow_color || fallback
  const secondary = c.secondary || data.secondary_color || primary
  return `linear-gradient(135deg, ${primary}, ${secondary})`
}

/** True when the OS requests reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
}

function shopFromRow(row: any) {
  return Array.isArray(row?.shop_item) ? row.shop_item[0] : row?.shop_item || row
}

function normalizeCosmetic(row: any): CosmeticItem {
  const shop = shopFromRow(row)
  const data = shop?.item_data || shop?.preview_data || row?.item_data || {}
  return {
    id: row?.id || shop?.id,
    item_id: row?.item_id || shop?.id,
    item_type: row?.item_type || shop?.item_type || shop?.category,
    name: shop?.name || row?.item_name || row?.name,
    category: shop?.category || row?.category,
    rarity: shop?.rarity || data?.rarity || "common",
    icon_url: shop?.icon_url || shop?.preview_url || data?.icon_url || data?.image_url || null,
    preview_url: shop?.preview_url || data?.preview_url || null,
    color: data?.color || data?.colors?.primary || data?.glow_color || null,
    glow: Boolean(data?.glow ?? data?.effects?.glow),
    particles: Boolean(data?.particles ?? data?.effects?.particles),
    item_data: data,
  }
}

function classify(item: CosmeticItem): keyof ActiveCosmetics | null {
  const type = `${item.item_type || ""} ${item.category || ""}`.toLowerCase()
  if (type.includes("badge")) return "badge"
  if (type.includes("frame") || type.includes("avatar_frame") || type.includes("avatar_effect")) return "frame"
  if (type.includes("font")) return "font"
  if (type.includes("sound") || type.includes("notification") || type.includes("chime") || type.includes("bell")) return "sound"
  if (type.includes("card_effect") || type.includes("post_card") || type.includes("post_effect") || type.includes("post")) return "cardEffect"
  // Tree skins render as a golden/custom card effect on the author's loops.
  if (type.includes("tree") || type.includes("branch")) return "cardEffect"
  if (type.includes("aura")) return "aura"
  // Everything else visible — animations, particles, stickers, profile
  // styling/design, banners — lands in the "effect" slot, which the avatar
  // renderer turns into a live glow/frame/interaction.
  if (
    type.includes("effect") ||
    type.includes("animation") ||
    type.includes("particle") ||
    type.includes("sticker") ||
    type.includes("banner") ||
    type.includes("design") ||
    type.includes("styling")
  ) {
    return "effect"
  }
  return null
}

/** Inline style for a display name equipped with a Pro font cosmetic. */
export function fontStyle(font?: CosmeticItem | null): CSSProperties | undefined {
  const family = font?.item_data?.font_family
  return family ? { fontFamily: family } : undefined
}

/** Inline style for a loop card equipped with a Pro card-effect cosmetic. */
export function cardEffectStyle(effect?: CosmeticItem | null): CSSProperties | undefined {
  if (!effect) return undefined
  const color = effect.color || "var(--theme-primary, #8b5cf6)"
  return effect.glow
    ? { boxShadow: `0 0 0 1px ${color}55, 0 0 24px ${color}33`, borderColor: `${color}55` }
    : { borderColor: `${color}55` }
}

/** Build cosmetics snapshot from active inventory rows */
export function cosmeticsFromInventory(rows: any[] | null | undefined): ActiveCosmetics {
  const result: ActiveCosmetics = {}
  for (const row of rows || []) {
    const item = normalizeCosmetic(row)
    const slot = classify(item)
    if (slot && !result[slot]) result[slot] = item
  }
  return result
}

export function rarityRingClass(rarity?: string) {
  switch ((rarity || "common").toLowerCase()) {
    case "legendary":
      return "ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]"
    case "epic":
      return "ring-2 ring-fuchsia-400 shadow-[0_0_14px_rgba(232,121,249,0.45)]"
    case "rare":
      return "ring-2 ring-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.4)]"
    default:
      return "ring-2 ring-border"
  }
}
