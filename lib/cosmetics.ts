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

/**
 * Legacy `effect` keys / item names → concrete render config. Seed-era shop
 * items describe their animation in `item_data.effect` ("fire_wings",
 * "rainbow_trail", …) instead of a frame_variant. This translates every
 * known key into the same variant + color config the renderer understands,
 * so buying an item actually produces the effect its description promises.
 */
const EFFECT_KEY_CONFIG: Record<string, Record<string, any>> = {
  // Sparkles / particles that orbit the avatar
  sparkle_trail: { frame_variant: "orbit_particles", colors: { primary: "#facc15", secondary: "#fde68a" }, glow: true },
  rainbow_trail: { frame_variant: "orbit_particles", colors: { primary: "#f472b6", secondary: "#22d3ee" }, glow: true },
  star_particles: { frame_variant: "orbit_particles", colors: { primary: "#a78bfa", secondary: "#fbbf24" }, glow: true },
  // Fire / dragon themes → flame-colored orbit
  fire_wings: { frame_variant: "orbit_particles", colors: { primary: "#f97316", secondary: "#ef4444" }, glow: true },
  fire_particles: { frame_variant: "orbit_particles", colors: { primary: "#f97316", secondary: "#fbbf24" }, glow: true },
  dragon_roar: { frame_variant: "pulse_glow", colors: { primary: "#ef4444", secondary: "#f97316" }, glow: true },
  // Lightning / neon → pulsing glow
  lightning_aura: { frame_variant: "pulse_glow", colors: { primary: "#00ffff", secondary: "#60a5fa" }, glow: true },
  neon_glow: { frame_variant: "pulse_glow", colors: { primary: "#22d3ee", secondary: "#a855f7" }, glow: true },
  matrix_rain: { frame_variant: "pulse_glow", colors: { primary: "#10b981", secondary: "#00ff88" }, glow: true },
  // Nature / water themes
  leaf_fall: { frame_variant: "orbit_particles", colors: { primary: "#4ade80", secondary: "#22c55e" }, glow: true },
  wave_motion: { frame_variant: "ring_rotate", colors: { primary: "#38bdf8", secondary: "#0284c7" }, glow: true },
  bubble_stream: { frame_variant: "orbit_particles", colors: { primary: "#7dd3fc", secondary: "#22d3ee" }, glow: true },
  // Default generic aura
  aura: { frame_variant: "pulse_glow", colors: { primary: "#8b5cf6", secondary: "#6366f1" }, glow: true },
}

/** Aura-type items (category "effect", item_type "aura_effect") glow by default. */
const AURA_TYPE_RE = /aura/

/**
 * Enrich a cosmetic's item_data with concrete variant hints derived from its
 * legacy `effect` key, its item_type, and its name. Returns the merged data.
 * Pure data — used by both the shop preview and the runtime renderer.
 */
export function resolveEffectData(item?: CosmeticItem | null): Record<string, any> {
  const data = { ...(item?.item_data || {}) }
  const type = `${item?.item_type || ""} ${item?.category || ""}`.toLowerCase()
  const name = `${item?.name || ""}`.toLowerCase()
  const hay = `${type} ${name}`

  const effectKey = String(data.effect || data.effect_key || "").toLowerCase()
  const fromKey = EFFECT_KEY_CONFIG[effectKey]
  const fromType = AURA_TYPE_RE.test(hay) ? EFFECT_KEY_CONFIG.aura : undefined

  // Match by name keywords when no explicit effect key is present
  let fromName: Record<string, any> | undefined
  if (!fromKey && !fromType) {
    if (/sparkle/.test(hay)) fromName = EFFECT_KEY_CONFIG.sparkle_trail
    else if (/rainbow/.test(hay)) fromName = EFFECT_KEY_CONFIG.rainbow_trail
    else if (/fire|flame|dragon|wing/.test(hay)) fromName = EFFECT_KEY_CONFIG.fire_wings
    else if (/lightning|electric/.test(hay)) fromName = EFFECT_KEY_CONFIG.lightning_aura
    else if (/matrix|cyber/.test(hay)) fromName = EFFECT_KEY_CONFIG.matrix_rain
    else if (/leaf|nature|forest/.test(hay)) fromName = EFFECT_KEY_CONFIG.leaf_fall
    else if (/wave|ocean|deep sea/.test(hay)) fromName = EFFECT_KEY_CONFIG.wave_motion
    else if (/bubble/.test(hay)) fromName = EFFECT_KEY_CONFIG.bubble_stream
    else if (/neon|glow/.test(hay)) fromName = EFFECT_KEY_CONFIG.neon_glow
    else if (/star/.test(hay)) fromName = EFFECT_KEY_CONFIG.star_particles
    else if (/aura/.test(hay)) fromName = EFFECT_KEY_CONFIG.aura
  }

  const source = fromKey || fromName || fromType
  if (!source) return data

  const colors = { ...(source.colors || {}), ...(data.colors || {}) }
  return {
    ...data,
    frame_variant: data.frame_variant || source.frame_variant,
    glow: data.glow ?? source.glow ?? true,
    particles: data.particles ?? source.particles ?? false,
    colors,
  }
}

/** Accessory overlays (crown / hat / glasses) render on top of the avatar. */
export type AvatarAccessory = "crown" | "hat" | "glasses" | null

export function accessoryFromItem(item?: CosmeticItem | null): AvatarAccessory {
  const data = item?.item_data || {}
  const type = `${data.accessory_type || data.accessory || ""}`.toLowerCase()
  const hay = `${item?.item_type || ""} ${item?.category || ""} ${item?.name || ""}`.toLowerCase()
  if (type.includes("crown") || /crown/.test(hay)) return "crown"
  if (type.includes("hat") || /hat|wizard/.test(hay)) return "hat"
  if (type.includes("glass") || /sunglass|glasses/.test(hay)) return "glasses"
  return null
}

/** Badge glyph: prefers an emoji icon from item_data, else first letter. */
export function badgeGlyph(item?: CosmeticItem | null): string {
  const data = item?.item_data || {}
  const icon = data.icon || data.icon_emoji || data.badge_icon
  if (typeof icon === "string" && icon.trim()) return icon.trim()
  return (item?.name || "★").charAt(0)
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
  const rawData = shop?.item_data || shop?.preview_data || row?.item_data || {}
  const item: CosmeticItem = {
    id: row?.id || shop?.id,
    item_id: row?.item_id || shop?.id,
    item_type: row?.item_type || shop?.item_type || shop?.category,
    name: shop?.name || row?.item_name || row?.name,
    category: shop?.category || row?.category,
    rarity: shop?.rarity || rawData?.rarity || "common",
    icon_url: shop?.icon_url || shop?.preview_url || rawData?.icon_url || rawData?.image_url || null,
    preview_url: shop?.preview_url || rawData?.preview_url || null,
    color: rawData?.color || rawData?.colors?.primary || rawData?.glow_color || null,
    glow: Boolean(rawData?.glow ?? rawData?.effects?.glow),
    particles: Boolean(rawData?.particles ?? rawData?.effects?.particles),
    item_data: rawData,
  }
  // Legacy `effect` keys → real render variants (fire_wings, rainbow_trail, …)
  item.item_data = resolveEffectData(item)
  item.color = item.item_data?.colors?.primary || item.color
  item.glow = Boolean(item.item_data?.glow ?? item.glow)
  return item
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
