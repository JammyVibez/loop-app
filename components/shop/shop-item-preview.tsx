"use client"

import { useMemo } from "react"
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
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"
import { AnimatedCardFrame } from "@/components/cosmetics/animated-card-frame"
import { type CosmeticItem, type ActiveCosmetics, resolveEffectData } from "@/lib/cosmetics"
import { useTheme3D } from "@/providers/theme-3d-provider"
import { Coins, Crown, Eye, Palette, Sparkles, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type ShopPreviewItem = {
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
}

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
  const cosmetic = useMemo(() => buildCosmeticFromItem(item), [item])
  const isTheme = isThemeItem(item)
  const isCard = !isTheme && isCardEffectItem(item)
  const primary = cosmetic?.color || "#8b5cf6"
  const secondary = cosmetic?.item_data?.colors?.secondary || primary

  if (isTheme) {
    const colors = cosmetic?.item_data?.colors || {}
    return (
      <div
        className={cn("flex h-full w-full items-center justify-center gap-2", className)}
        style={{
          background: `linear-gradient(135deg, ${colors.primary || "#8b5cf6"}22, ${colors.secondary || "#3b82f6"}22)`,
        }}
      >
        <span
          className="h-8 w-8 rounded-full border-2 border-background shadow-lg"
          style={{ background: `linear-gradient(135deg, ${colors.primary || "#8b5cf6"}, ${colors.secondary || "#3b82f6"})` }}
        />
        <Palette className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }

  if (isCard) {
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

  return (
    <div className={cn("flex h-full w-full items-center justify-center", className)}>
      <CosmeticAvatar
        src="/placeholder-user.jpg"
        alt={item.name}
        fallback="L"
        size="lg"
        cosmetics={{ frame: cosmetic, aura: cosmetic?.glow ? cosmetic : null } as ActiveCosmetics}
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
}: {
  item: ShopPreviewItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPurchase?: (item: ShopPreviewItem) => void
  owned?: boolean
}) {
  const { applyTheme } = useTheme3D()
  const isTheme = item ? isThemeItem(item) : false
  const isCard = item ? !isTheme && isCardEffectItem(item) : false
  const cosmetic = useMemo(() => (item ? buildCosmeticFromItem(item) : null), [item])
  const themePayload = useMemo(() => (item ? buildThemePayload(item) : null), [item])
  const primary = cosmetic?.color || themePayload?.colors?.primary || "#8b5cf6"
  const secondary = cosmetic?.item_data?.colors?.secondary || themePayload?.colors?.secondary || primary

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-border bg-background text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            {item.name} — Live Preview
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            This is exactly how it will look once you own and equip it. No static mockup — the real effect is running.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Badge className={RARITY_BADGE[lower(item.rarity)] || RARITY_BADGE.common}>{item.rarity}</Badge>
          {item.premium_only && (
            <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
              <Crown className="h-3 w-3 mr-1" /> Premium
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
          {isTheme ? (
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
                  <CosmeticAvatar src="/placeholder-user.jpg" alt="" fallback="L" size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold" style={{ color: themePayload?.colors?.text }}>
                      Your name
                    </p>
                    <p className="truncate text-[11px] opacity-70">@yourhandle</p>
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
                    <CosmeticAvatar src="/placeholder-user.jpg" alt="" fallback="L" size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">Creator name</p>
                      <p className="text-[10px] text-muted-foreground">just now</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-foreground">Every loop post you publish gets this {item.name} treatment — animated border, glow or shimmer included.</p>
                  <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                    <span>❤️ 128</span>
                    <span>💬 24</span>
                    <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Branch</span>
                  </div>
                </div>
              </AnimatedCardFrame>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-3">
              <CosmeticAvatar
                src="/placeholder-user.jpg"
                alt={item.name}
                fallback="L"
                size="xl"
                cosmetics={{ frame: cosmetic, aura: cosmetic?.glow ? cosmetic : null } as ActiveCosmetics}
              />
              <p className="max-w-[260px] text-center text-xs text-muted-foreground">
                {item.name} runs on your avatar everywhere — feed, profile, chat and comments. Tap your avatar to feel the micro-interaction.
              </p>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{item.description || "Own it once and it stays in your inventory forever."}</p>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="font-bold">{item.price_coins ?? item.price ?? 0}</span>
            <span className="text-xs text-muted-foreground">Loop Coins</span>
          </div>
          <div className="flex gap-2">
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
                Try it on my profile
              </Button>
            )}
            <Button
              className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
              disabled={Boolean(owned)}
              onClick={() => onPurchase?.(item)}
            >
              {owned ? "Owned ✓" : item.category === "coins" ? "Buy Now" : "Buy with Coins"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
