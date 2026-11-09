"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowUpRight, Check, Coins, CreditCard, Crown, Lock, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ShopItemMiniPreview, type ShopPreviewItem } from "@/components/shop/shop-item-preview"
import { coinPrice, usdPrice } from "@/lib/shop-catalog"
import { Lottie } from "@/components/ui/lottie"
import { artForItem } from "@/components/shop/shop-art"

/**
 * How each rarity looks. One table, so a card, a chip and a filter can never
 * disagree about what "epic" is.
 */
export const RARITY_STYLE: Record<
  string,
  { label: string; chip: string; edge: string; dot: string; glow: string }
> = {
  common: {
    label: "Common",
    chip: "border-white/15 bg-white/[0.04] text-white/65",
    edge: "from-slate-300/40",
    dot: "bg-slate-300",
    glow: "rgba(148,163,184,0.16)",
  },
  rare: {
    label: "Rare",
    chip: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    edge: "from-sky-300/60",
    dot: "bg-sky-300",
    glow: "rgba(56,189,248,0.22)",
  },
  epic: {
    label: "Epic",
    chip: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    edge: "from-violet-300/60",
    dot: "bg-violet-300",
    glow: "rgba(167,139,250,0.26)",
  },
  legendary: {
    label: "Legendary",
    chip: "border-amber-300/35 bg-amber-300/10 text-amber-200",
    edge: "from-amber-300/70",
    dot: "bg-amber-300",
    glow: "rgba(251,191,36,0.28)",
  },
}

export function rarityStyle(rarity?: string | null) {
  return RARITY_STYLE[(rarity || "").toLowerCase()] || RARITY_STYLE.common
}

/** A small rarity pill. */
export function RarityChip({ rarity, className }: { rarity?: string | null; className?: string }) {
  const style = rarityStyle(rarity)
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur-sm",
        style.chip,
        className,
      )}
    >
      <span className={cn("h-1 w-1 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}

export interface ShopItemCardProps {
  item: ShopPreviewItem
  owned?: boolean
  purchasing?: boolean
  /** Pro-only and the viewer is not Pro — buy is refused upstream, so say so here. */
  locked?: boolean
  /** Width overrides, for the spotlight row. */
  className?: string
  onPreview: (item: ShopPreviewItem) => void
  onBuy?: (item: ShopPreviewItem) => void
  onBuyWithCard?: (item: ShopPreviewItem) => void
}

/**
 * One item on the shelf.
 *
 * The art is a live stage, not a thumbnail — the real effect runs inside it.
 * Everything under it is a name, one line, and a price, so a dense grid stays
 * scannable while the cover does the selling.
 */
export function ShopItemCard({
  item,
  owned = false,
  purchasing = false,
  locked = false,
  className,
  onPreview,
  onBuy,
  onBuyWithCard,
}: ShopItemCardProps) {
  const style = rarityStyle(item.rarity)
  const isCoinPack = item.category === "coins"
  const itemArt = useMemo(() => artForItem(item), [item])
  const coins = coinPrice(item)
  const usd = usdPrice(item)

  return (
    <article
      className={cn(
        "shop-item-card group relative flex flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#0d0c11] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)]",
        className,
      )}
    >
      <span aria-hidden className={cn("absolute inset-x-8 top-0 z-20 h-px bg-gradient-to-r to-transparent", style.edge)} />

      <button
        type="button"
        onClick={() => onPreview(item)}
        className="relative block w-full cursor-pointer overflow-hidden border-b border-white/[0.07] bg-[#0a0910] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300/70"
        aria-label={`Preview ${item.name}`}
      >
        <div className="relative aspect-square w-full overflow-hidden">
          <span
            aria-hidden
            className="shop-card-glow pointer-events-none absolute inset-0 z-0"
            style={{
              background: `radial-gradient(120% 90% at 50% 0%, ${style.glow}, transparent 68%)`,
            }}
          />
          <ShopItemMiniPreview
            item={item}
            className="relative z-10 p-4 transition-transform duration-500 ease-out group-hover:scale-[1.035]"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-black/35 to-transparent" />
          <span className="absolute left-2.5 top-2.5 z-20">
            <RarityChip rarity={item.rarity} />
          </span>
        </div>

        {/* One badge in the top-right corner, never two: ownership is the more
            useful fact than "Pro", so it wins. */}
        {owned ? (
          <span className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full border border-emerald-300/35 bg-emerald-400/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-200 backdrop-blur-sm">
            <Check className="h-2.5 w-2.5" />
            Owned
          </span>
        ) : item.premium_only ? (
          <span className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-200 backdrop-blur-sm">
            {locked ? <Lock className="h-2.5 w-2.5" /> : <Crown className="h-2.5 w-2.5" />}
            Pro
          </span>
        ) : null}

      </button>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-medium tracking-[-0.01em] text-foreground sm:text-[13.5px]">{item.name}</h3>
          <p className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-muted-foreground/75">
            {item.description || "A little something to make your Loop yours."}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/[0.06] pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold tabular-nums text-foreground">
            {isCoinPack ? (
              <>
                <span className="text-emerald-300">${usd || coins}</span>
                <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">USD</span>
              </>
            ) : (
              <>
                <Coins className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span className="truncate">{coins.toLocaleString()}</span>
              </>
            )}
          </span>

          <div className="flex shrink-0 flex-col items-end gap-0.5">
            {owned && !isCoinPack ? (
              <Button asChild size="sm" variant="outline" className="h-9 rounded-full border-white/15 px-3.5 text-[10px]">
                <Link href="/inventory">
                  Equip
                  <ArrowUpRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onBuy?.(item)}
                disabled={purchasing}
                className="h-9 rounded-full bg-gradient-to-r from-amber-200 to-amber-300 px-3.5 text-[10px] font-bold text-[#1a1305] shadow-[0_8px_22px_-12px_rgba(245,185,66,0.65)] transition hover:from-amber-100 hover:to-amber-200 disabled:opacity-60"
              >
                {purchasing ? (
                  <Lottie animation={itemArt} className="h-4 w-4" />
                ) : locked ? (
                  <>
                    <Lock className="mr-1 h-3 w-3" />
                    Pro
                  </>
                ) : (
                  <>
                    <ShoppingBag className="mr-1 h-3 w-3" />
                    {isCoinPack ? "Buy now" : "Buy"}
                  </>
                )}
              </Button>
            )}

            {!isCoinPack && usd > 0 && !owned ? (
              <button
                type="button"
                onClick={() => onBuyWithCard?.(item)}
                disabled={purchasing}
                className="inline-flex items-center gap-1 text-[8.5px] leading-3 text-muted-foreground/55 transition-colors hover:text-foreground"
              >
                <CreditCard className="h-2.5 w-2.5" />
                ${usd.toFixed(2)} card
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
