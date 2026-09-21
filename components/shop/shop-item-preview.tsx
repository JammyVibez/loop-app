"use client"

import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Lottie } from "@/components/ui/lottie"
import { LockedNotice } from "@/components/shop/shop-states"
import { CustomMedia, customMediaFor } from "@/components/shop/custom-media"
import { COIN, COIN_GOLD, GIFT, artForItem, itemIllustration } from "@/components/shop/shop-art"
import { COSMETIC_FONT_PRESETS, ensureCosmeticFonts, fontPresetForFamily } from "@/lib/cosmetic-fonts"
import type { ShopCatalogItem } from "@/lib/shop-catalog"
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"
import { AnimatedCardFrame } from "@/components/cosmetics/animated-card-frame"
import { type CosmeticItem, type ActiveCosmetics, resolveEffectData } from "@/lib/cosmetics"
import { useTheme3D } from "@/providers/theme-3d-provider"
import { useAuth } from "@/hooks/use-auth"
import { Coins, Crown, Eye, Gift, Heart, MessageCircle, Zap, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** The catalogue row shape, defined once in `lib/shop-catalog`. */
export type ShopPreviewItem = ShopCatalogItem

/**
 * Known legacy shop items → real cosmetic configs. This keeps every shop item
 * genuinely functional (live preview + working effect when equipped) even if
 * the database row only carries name/price metadata. Admins can override any
 * of these by setting `item_data` on the shop item.
 */
const LEGACY_EFFECTS: Record<string, Record<string, any>> = {
  "rainbow-pulse": { frame_variant: "ring_rotate", colors: { primary: "#f472b6", secondary: "#22d3ee" }, glow: true },
  "neon-pulse-ring": { frame_variant: "pulse_glow", colors: { primary: "#22d3ee", secondary: "#0ea5e9" }, glow: true },
  "diamond-crown": { frame_variant: "ring_rotate", colors: { primary: "#a5f3fc", secondary: "#e9d5ff" }, glow: true },
  "fire-flame-ring": { frame_variant: "orbit_particles", colors: { primary: "#f97316", secondary: "#ef4444" }, glow: true },
  "sparkle-trail": { frame_variant: "orbit_particles", colors: { primary: "#facc15", secondary: "#fde68a" }, glow: true },
  "floating-glow": { frame_variant: "pulse_glow", colors: { primary: "#8b5cf6" }, glow: true },
  "premium-aura": { frame_variant: "pulse_glow", colors: { primary: "#fbbf24", secondary: "#f59e0b" }, glow: true },
  "supernova-loop-glow": { card_variant: "gradient_border", colors: { primary: "#f97316", secondary: "#a855f7" }, glow: true },
  "hologram-ripple": { card_variant: "shimmer", colors: { primary: "#22d3ee", secondary: "#818cf8" }, glow: true },
  "loop-glow": { card_variant: "pulse_edge", colors: { primary: "#8b5cf6" }, glow: true },
  "post-sparkle": { card_variant: "pulse_edge", colors: { primary: "#facc15", secondary: "#fbbf24" }, glow: true },
  "tree-skin-golden": { card_variant: "gradient_border", colors: { primary: "#fbbf24", secondary: "#fde68a" }, glow: true },
  "branch-particles": { frame_variant: "orbit_particles", colors: { primary: "#34d399", secondary: "#f472b6" }, glow: true },
  "midnight-vapor": { frame_variant: "ring_rotate", colors: { primary: "#ec4899", secondary: "#06b6d4" }, glow: true },
  "emerald-aurora": { frame_variant: "pulse_glow", colors: { primary: "#059669", secondary: "#0d9488" }, glow: true },
  "obsidian-velvet": { frame_variant: "ring_rotate", colors: { primary: "#94a3b8", secondary: "#475569" }, glow: true },
  "sunset-dream": { frame_variant: "orbit_particles", colors: { primary: "#ff6b6b", secondary: "#ffa500" }, glow: true },
  "galaxy-explorer": { frame_variant: "orbit_particles", colors: { primary: "#667eea", secondary: "#764ba2" }, glow: true },
  "cyberpunk-matrix": { frame_variant: "pulse_glow", colors: { primary: "#10b981", secondary: "#064e3b" }, glow: true },
}

const LEGACY_THEMES: Record<string, Record<string, any>> = {
  "neon-cyber": {
    colors: { primary: "#00ff88", secondary: "#00ccff", accent: "#ff0080", background: "#0a0a0a", surface: "#1a1a1a", text: "#ffffff" },
    effects: { glow: true, particles: true, animations: true },
  },
  "cyberpunk-matrix": {
    colors: { primary: "#10b981", secondary: "#34d399", accent: "#00ff88", background: "#03120e", surface: "#0b2a1f", text: "#d1fae5" },
    effects: { glow: true, particles: true, animations: true },
  },
  "obsidian-velvet": {
    colors: { primary: "#94a3b8", secondary: "#cbd5e1", accent: "#f8fafc", background: "#0f172a", surface: "#1e293b", text: "#f8fafc" },
    effects: { glow: true, particles: false, animations: true },
  },
  "sunset-dream": {
    colors: { primary: "#ff6b6b", secondary: "#ffa500", accent: "#ff1744", background: "#fff3e0", surface: "#ffe0b2", text: "#bf360c" },
    effects: { glow: true, particles: false, animations: true },
  },
  "emerald-aurora": {
    colors: { primary: "#059669", secondary: "#0d9488", accent: "#34d399", background: "#022c22", surface: "#064e3b", text: "#ecfdf5" },
    effects: { glow: true, particles: true, animations: true },
  },
  "midnight-vapor": {
    colors: { primary: "#ec4899", secondary: "#06b6d4", accent: "#a855f7", background: "#0b0b1a", surface: "#18182f", text: "#fdf2f8" },
    effects: { glow: true, particles: true, animations: true },
  },
  "galaxy-explorer": {
    colors: { primary: "#667eea", secondary: "#764ba2", accent: "#f093fb", background: "#0c0c1a", surface: "#1a1a2e", text: "#eee" },
    effects: { glow: true, particles: true, animations: true },
  },
  "tree-golden": {
    colors: { primary: "#fbbf24", secondary: "#f59e0b", accent: "#ffd700", background: "#1a1206", surface: "#2a1e0c", text: "#fffbeb" },
    effects: { glow: true, particles: true, animations: true },
  },
}

function lower(s?: string) {
  return (s || "").toLowerCase()
}

function isThemeItem(item: ShopPreviewItem) {
  return lower(`${item.category} ${item.item_type}`).includes("theme") || Boolean(LEGACY_THEMES[item.id])
}

function isCardEffectItem(item: ShopPreviewItem) {
  const hay = lower(`${item.category} ${item.item_type} ${item.name}`)
  return hay.includes("card_effect") || hay.includes("post") || hay.includes("loop") || hay.includes("tree-skin")
}

function isFontItem(item: ShopPreviewItem) {
  return lower(`${item.category} ${item.item_type}`).includes("font")
}

/**
 * The CSS stack a font item renders in, resolved the same way an equipped font
 * is, so the preview cannot promise a typeface the app will not deliver.
 */
function fontStackFor(item: ShopPreviewItem): string | null {
  const data = item.item_data && typeof item.item_data === "object" ? item.item_data : {}
  const preset =
    (data.font_preset && COSMETIC_FONT_PRESETS[data.font_preset as string]) ||
    fontPresetForFamily(String(data.font_family || ""))
  if (preset?.family) return preset.family
  if (typeof data.font_family === "string" && data.font_family) return data.font_family
  return null
}

/**
 * The typeface's real name, for the font specimen: the preset's own label
 * ("Poppins") or, when the item carries a raw family stack, the family itself.
 */
function fontLabelFor(item: ShopPreviewItem): string {
  const data = item.item_data && typeof item.item_data === "object" ? item.item_data : {}
  const preset =
    (data.font_preset && COSMETIC_FONT_PRESETS[data.font_preset as string]) ||
    fontPresetForFamily(String(data.font_family || ""))
  if (preset?.family) return preset.family.split(",")[0].replace(/['"]/g, "").trim()
  const raw = String(data.font_family || "").split(",")[0].replace(/['"]/g, "").trim()
  if (raw) return raw
  // No font metadata at all — the item's name is still honest, minus the word
  // "Font" that every one of them carries.
  return item.name.replace(/\s*font\s*$/i, "").trim() || item.name
}

/**
 * What an item actually is, which is not always what its category says: nine
 * "badges" in the live catalogue are animated gifts, and a coin pack filed
 * under `coins` has nothing to wear. One decision, made once, so the shelf and
 * the dialog cannot disagree.
 */
type PreviewVariant = "coins" | "premium" | "gift" | "font" | "theme" | "card" | "avatar"

function previewVariantFor(item: ShopPreviewItem): PreviewVariant {
  const category = lower(item.category)
  const type = lower(item.item_type)
  if (category.includes("coin")) return "coins"
  if (category.includes("premium") || type.includes("subscription")) return "premium"
  if (item.item_data?.is_giftable) return "gift"
  if (type.includes("font") || category.includes("font")) return "font"
  if (isThemeItem(item)) return "theme"
  if (isCardEffectItem(item)) return "card"
  return "avatar"
}

/** Coins a pack pays out, bonus included. */
function coinAmount(item: ShopPreviewItem): number {
  const data = item.item_data && typeof item.item_data === "object" ? item.item_data : {}
  return Number(data.coins_amount || 0) + Number(data.bonus || 0)
}

function bonusAmount(item: ShopPreviewItem): number {
  return Number(item.item_data?.bonus || 0)
}

const FEATURE_LABELS: Record<string, string> = {
  ad_free: "No ads, anywhere in the app",
  exclusive_themes: "Pro-only themes, frames and fonts",
  priority_support: "Priority support",
  pro_badge: "The Pro badge on your profile",
  unlimited_uploads: "Bigger, faster uploads",
  profile_analytics: "Profile analytics",
}

function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] || feature.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
}

export function buildCosmeticFromItem(item: ShopPreviewItem): CosmeticItem | null {
  const legacy = LEGACY_EFFECTS[item.id] || {}
  const itemData = item.item_data && typeof item.item_data === "object" ? item.item_data : {}
  const previewData = item.preview_data && typeof item.preview_data === "object" ? item.preview_data : {}
  const colors = legacy.colors || previewData.colors || itemData.colors || {}
  const primary = itemData.color || colors.primary || previewData.color || "#8b5cf6"

  const cosmetic: CosmeticItem = {
    id: item.id,
    item_id: item.id,
    item_type: item.item_type || item.category,
    name: item.name,
    category: item.category,
    rarity: item.rarity || "common",
    color: primary,
    glow: Boolean(itemData.glow ?? legacy.glow ?? previewData.glow ?? true),
    particles: Boolean(itemData.particles ?? legacy.particles ?? false),
    item_data: {
      ...legacy,
      ...(previewData || {}),
      ...(itemData || {}),
      colors: { ...(legacy.colors || {}), ...(previewData.colors || {}), ...(itemData.colors || {}) },
    },
  }
  // Legacy effect keys (fire_wings, rainbow_trail, …) → real render variants
  cosmetic.item_data = resolveEffectData(cosmetic)
  cosmetic.color = cosmetic.item_data?.colors?.primary || primary
  return cosmetic
}

export function buildThemePayload(item: ShopPreviewItem) {
  const legacy = LEGACY_THEMES[item.id] || {}
  const itemData = item.item_data || {}
  const previewData = item.preview_data || {}
  const colors = { ...(legacy.colors || {}), ...(previewData.colors || {}), ...(itemData.colors || {}) }
  const effects = { ...(legacy.effects || {}), ...(previewData.effects || {}), ...(itemData.effects || {}) }
  return {
    id: item.id,
    name: item.name,
    colors: {
      primary: colors.primary || "#8b5cf6",
      secondary: colors.secondary || "#3b82f6",
      accent: colors.accent || "#f59e0b",
      background: colors.background || "#0b1220",
      surface: colors.surface || "#111827",
      text: colors.text || "#f8fafc",
    },
    effects: {
      glow: Boolean(effects.glow ?? true),
      particles: Boolean(effects.particles ?? false),
      animations: Boolean(effects.animations ?? true),
      shadows: Boolean(effects.shadows ?? true),
    },
    item_type: item.item_type,
    category: item.category,
  }
}

const RARITY_BADGE: Record<string, string> = {
  common: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  rare: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  epic: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  legendary: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
}

/** Small live preview used directly inside shop cards. */
export function ShopItemMiniPreview({ item, className }: { item: ShopPreviewItem; className?: string }) {
  // Every hook runs before any early return below — a preview that sometimes
  // calls `useMemo` and sometimes does not changes the hook count between
  // renders, which React rejects outright.
  const cosmetic = useMemo(() => buildCosmeticFromItem(item), [item])
  const itemArt = useMemo(() => itemIllustration(item), [item])
  const variant = previewVariantFor(item)
  const fontStack = fontStackFor(item)
  const primary = cosmetic?.color || "#8b5cf6"
  const secondary = cosmetic?.item_data?.colors?.secondary || primary

  // A font item is shown in its own typeface, so the font has to be loaded.
  useEffect(() => {
    if (variant !== "font") return
    ensureCosmeticFonts({ item_data: item.item_data } as CosmeticItem)
  }, [variant, item.id, item.item_data])

  // Admin-set custom media: image, GIF, or video URL.  When an admin has
  // deliberately attached art to an item, that is what the buyer sees — a
  // "24K Rose Garden" shows the rose, not a generic gift-box Lottie.
  const customMedia = customMediaFor(item as unknown as Record<string, unknown>)
  if (customMedia) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center overflow-hidden", className)}>
        <CustomMedia url={customMedia} alt={item.name} />
      </div>
    )
  }

  if (variant === "coins") {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-0.5", className)}>
        <Lottie animation={coinAmount(item) >= 10000 ? COIN_GOLD : COIN} className="h-16 w-16" />
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {coinAmount(item).toLocaleString()} coins
        </span>
        {bonusAmount(item) > 0 ? (
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            +{bonusAmount(item).toLocaleString()} bonus
          </span>
        ) : null}
      </div>
    )
  }

  if (variant === "premium") {
    const duration = String(item.item_data?.duration || "1 month")
    const features: string[] = Array.isArray(item.item_data?.features) ? item.item_data.features : []
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1 p-3", className)}>
        <Crown className="h-7 w-7 text-amber-500" />
        <span className="text-xs font-semibold text-foreground">Loop Pro · {duration}</span>
        <span className="line-clamp-2 text-center text-[10px] leading-relaxed text-muted-foreground">
          {features.length > 0
            ? features.slice(0, 2).map(featureLabel).join(" · ")
            : "Everything the shop has, minus the ads"}
        </span>
      </div>
    )
  }

  if (variant === "gift") {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-0.5", className)}>
        <Lottie animation={GIFT} className="h-14 w-14" />
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          <Gift className="h-2.5 w-2.5" />
          A gift you send
        </span>
      </div>
    )
  }

  if (variant === "font") {
    // The sample is the typeface's own name set in the typeface — a real
    // specimen rather than the words "Your name here", which told a buyer
    // nothing about the font they were looking at.
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1", className)}>
        <span className="text-4xl leading-none text-foreground" style={{ fontFamily: fontStack || undefined }}>
          Aa
        </span>
        <span
          className="max-w-[92%] truncate text-xs font-medium text-muted-foreground"
          style={{ fontFamily: fontStack || undefined }}
        >
          {fontLabelFor(item)}
        </span>
      </div>
    )
  }

  if (variant === "theme") {
    // A theme is a palette, so preview it as one: a miniature of the app in the
    // item's own colours beats two gradient circles.
    const colors = cosmetic?.item_data?.colors || {}
    const surface = colors.surface || "#111827"
    const background = colors.background || "#0b1220"
    const text = colors.text || "#f8fafc"
    const accent = colors.accent || "#f59e0b"

    return (
      <div
        className={cn("flex h-full w-full items-center justify-center p-2.5", className)}
        style={{ background }}
      >
        <div className="w-full max-w-[230px] rounded-xl p-2.5" style={{ background: surface }}>
          <div className="flex items-center gap-1.5">
            <span
              className="h-5 w-5 shrink-0 rounded-full"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            />
            <span className="h-1.5 w-10 rounded-full" style={{ background: text, opacity: 0.8 }} />
            <span className="ml-auto h-1.5 w-4 rounded-full" style={{ background: accent, opacity: 0.9 }} />
          </div>
          <div className="mt-2 space-y-1">
            <span className="block h-1.5 w-4/5 rounded-full" style={{ background: text, opacity: 0.22 }} />
            <span className="block h-1.5 w-3/5 rounded-full" style={{ background: text, opacity: 0.14 }} />
          </div>
          <div className="mt-2 flex gap-1">
            <span className="h-3.5 flex-1 rounded" style={{ background: primary }} />
            <span className="h-3.5 flex-1 rounded" style={{ background: secondary }} />
            <span className="h-3.5 flex-1 rounded" style={{ background: accent }} />
          </div>
        </div>
      </div>
    )
  }

  if (variant === "card") {
    return (
      <div className={cn("flex h-full w-full items-center justify-center p-2", className)}>
        <AnimatedCardFrame effect={cosmetic} rounded="rounded-xl" className="w-full max-w-[220px]">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
              <span className="text-[10px] font-semibold text-muted-foreground">Loop post</span>
            </div>
            <div className="mt-2 h-1.5 w-3/4 rounded-full bg-muted" />
            <div className="mt-1 h-1.5 w-1/2 rounded-full bg-muted" />
          </div>
        </AnimatedCardFrame>
      </div>
    )
  }

  // If the item name/description matches a known illustration (car, crown,
  // heart, star, diamond, rose, …), show the matching Lottie instead of the
  // generic avatar fallback.
  if (itemArt) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center gap-1 p-2", className)}>
        <Lottie animation={itemArt} className="h-16 w-16" />
        <span className="line-clamp-2 max-w-[140px] text-center text-[10px] leading-relaxed text-muted-foreground">
          {item.description || item.name}
        </span>
      </div>
    )
  }

  // Nothing matched a keyword, so draw the item's own cosmetic on an anonymous
  // avatar. This used to be a stock photo that does not exist plus the initial
  // "L", which is where the lettered circles in the inventory came from.
  return (
    <div className={cn("flex h-full w-full items-center justify-center", className)}>
      <CosmeticAvatar
        alt={item.name}
        size="lg"
        silhouette
        cosmetics={{ frame: cosmetic, aura: cosmetic } as ActiveCosmetics}
      />
    </div>
  )
}

/**
 * Full-screen dialog preview — shows the item working live on a mock profile
 * before the user spends coins.
 */
export function ShopItemPreviewDialog({
  item,
  open,
  onOpenChange,
  onPurchase,
  owned,
  locked,
}: {
  item: ShopPreviewItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPurchase?: (item: ShopPreviewItem) => void
  owned?: boolean
  /** Pro-only, and the viewer is not Pro. */
  locked?: boolean
}) {
  const { applyTheme } = useTheme3D()
  // Previews are drawn on the viewer's own avatar and name wherever possible:
  // a stranger's stock photo and a placeholder name made every item look like
  // a template rather than something about to happen to your profile.
  const { user } = useAuth()
  const sampleName = user?.display_name || user?.username || "Your profile"
  const variant = item ? previewVariantFor(item) : "avatar"
  const isFont = variant === "font"
  const isTheme = variant === "theme"
  const isCard = variant === "card"
  const fontStack = item ? fontStackFor(item) : null

  useEffect(() => {
    if (item && isFont) ensureCosmeticFonts({ item_data: item.item_data } as CosmeticItem)
  }, [item, isFont])
  const cosmetic = useMemo(() => (item ? buildCosmeticFromItem(item) : null), [item])
  const themePayload = useMemo(() => (item ? buildThemePayload(item) : null), [item])
  const primary = cosmetic?.color || themePayload?.colors?.primary || "#8b5cf6"
  const secondary = cosmetic?.item_data?.colors?.secondary || themePayload?.colors?.secondary || primary

  if (!item) return null

  const customMedia = customMediaFor(item as unknown as Record<string, unknown>)
  const hasCustomMedia = Boolean(customMedia)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-border bg-card text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" />
            {item.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            The real effect, running. What you see here is what you get once it is equipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={RARITY_BADGE[lower(item.rarity)] || RARITY_BADGE.common}>{item.rarity}</Badge>
          {item.premium_only && (
            <Badge className="border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Crown className="h-3 w-3 mr-1" /> Pro
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] capitalize">{item.category}</Badge>
        </div>

        {/* Live preview stage */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 p-6">
          {/* ambient glow behind the stage */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: `radial-gradient(400px 200px at 50% 0%, ${primary}33, transparent 70%)` }}
          />
          {/* Admin-set custom media: image, GIF, video or Lottie */}
          {customMedia ? (
            <div className="relative flex h-[320px] justify-center">
              <CustomMedia url={customMedia} alt={item.name} fit="contain" className="rounded-xl" />
            </div>
          ) : null}
          {!hasCustomMedia && (variant === "coins" ? (
            <div className="relative flex flex-col items-center gap-1.5">
              <Lottie animation={coinAmount(item) >= 10000 ? COIN_GOLD : COIN} className="h-28 w-28" />
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {coinAmount(item).toLocaleString()} coins
              </p>
              {bonusAmount(item) > 0 ? (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  +{bonusAmount(item).toLocaleString()} bonus included
                </p>
              ) : null}
              <p className="mt-1 max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground">
                Coins land in your balance as soon as the card payment is confirmed.
              </p>
            </div>
          ) : variant === "premium" ? (
            <div className="relative flex flex-col items-center gap-3">
              <Crown className="h-9 w-9 text-amber-500" />
              <p className="text-sm font-semibold text-foreground">
                Loop Pro · {String(item.item_data?.duration || "1 month")}
              </p>
              <ul className="w-full max-w-[280px] space-y-1.5">
                {(Array.isArray(item.item_data?.features)
                  ? (item.item_data.features as string[])
                  : ["ad_free", "exclusive_themes", "priority_support"]
                ).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Zap className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
                    {featureLabel(feature)}
                  </li>
                ))}
              </ul>
            </div>
          ) : variant === "gift" ? (
            <div className="relative flex flex-col items-center gap-3">
              <Lottie animation={GIFT} className="h-28 w-28" />
              <p className="max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground">
                An animated gift. Send it from someone&rsquo;s profile and it plays for them when they
                open it.
              </p>
            </div>
          ) : isFont ? (
            <div className="relative flex flex-col items-center gap-3 py-2">
              <span
                className="text-center text-4xl leading-tight text-foreground"
                style={{ fontFamily: fontStack || undefined }}
              >
                {item.name}
              </span>
              <span
                className="text-center text-lg text-muted-foreground"
                style={{ fontFamily: fontStack || undefined }}
              >
                {sampleName}, everywhere your name appears
              </span>
            </div>
          ) : isTheme ? (
            <div className="relative flex justify-center">
              <div
                className="w-full max-w-[280px] rounded-2xl border p-4 shadow-xl"
                style={{
                  background: themePayload?.colors?.background || "#0b1220",
                  color: themePayload?.colors?.text || "#f8fafc",
                  borderColor: `${primary}44`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <CosmeticAvatar src={user?.avatar_url} alt="" size="md" silhouette />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold" style={{ color: themePayload?.colors?.text }}>
                      {sampleName}
                    </p>
                    <p className="truncate text-[11px] opacity-70">@{user?.username || "you"}</p>
                  </div>
                  <span className="ml-auto h-2 w-2 rounded-full" style={{ background: primary, boxShadow: `0 0 8px ${primary}` }} />
                </div>
                <div className="mt-3 rounded-xl p-3" style={{ background: themePayload?.colors?.surface || "#111827" }}>
                  <p className="text-xs" style={{ color: themePayload?.colors?.text }}>
                    Your profile takes on the {item.name} palette — primary, accents, glow and particles apply across the app.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <span className="h-5 flex-1 rounded-md" style={{ background: primary }} />
                    <span className="h-5 flex-1 rounded-md" style={{ background: secondary }} />
                    <span className="h-5 flex-1 rounded-md" style={{ background: themePayload?.colors?.accent || "#f59e0b" }} />
                  </div>
                </div>
              </div>
            </div>
          ) : isCard ? (
            <div className="relative flex justify-center">
              <AnimatedCardFrame effect={cosmetic} rounded="rounded-2xl" className="w-full max-w-[300px]">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
                  <div className="flex items-center gap-2">
                    <CosmeticAvatar src={user?.avatar_url} alt="" size="sm" silhouette />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{sampleName}</p>
                      <p className="text-[10px] text-muted-foreground">just now</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-foreground">Every loop post you publish gets this {item.name} treatment — animated border, glow or shimmer included.</p>
                  <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3 fill-rose-500 text-rose-500" /> 128</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> 24</span>
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Branch</span>
                  </div>
                </div>
              </AnimatedCardFrame>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-3">
              <CosmeticAvatar
                src={user?.avatar_url}
                alt={item.name}
                size="xl"
                silhouette
                cosmetics={{ frame: cosmetic, aura: cosmetic } as ActiveCosmetics}
              />
              <p className="max-w-[260px] text-center text-xs text-muted-foreground">
                {item.name} runs on your avatar everywhere — feed, profile, chat and comments. Tap your avatar to feel the micro-interaction.
              </p>
            </div>
          ))}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {item.description || "Own it once and it stays in your inventory forever."}
        </p>

        {locked ? (
          <LockedNotice>
            Buy it any time once you are on Pro — or pick something with a coin price and own it outright.
          </LockedNotice>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            {item.category === "coins" ? (
              <Lottie animation={COIN} className="h-5 w-5" />
            ) : (
              <Coins className="h-4 w-4 text-amber-500" />
            )}
            <span className="font-semibold tabular-nums">
              {item.category === "coins"
                ? `$${Number(item.price_usd || item.price || 0).toFixed(2)}`
                : Number(item.price_coins ?? item.price ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.category === "coins" ? "USD" : "Loop Coins"}
            </span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {isTheme && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  applyTheme(themePayload)
                  onOpenChange(false)
                }}
              >
                <Wand2 className="mr-1.5 h-4 w-4" />
                Try it on
              </Button>
            )}
            <Button
              className="rounded-full"
              disabled={Boolean(owned)}
              onClick={() => onPurchase?.(item)}
            >
              {owned ? "Owned" : item.category === "coins" ? "Buy now" : "Buy with Coins"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
