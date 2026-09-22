"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowUpRight, Check, Coins, CreditCard, Crown, Eye, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ShopItemMiniPreview, type ShopPreviewItem } from "@/components/shop/shop-item-preview"
import { coinPrice, usdPrice } from "@/lib/shop-catalog"
import { Lottie } from "@/components/ui/lottie"
import { COIN, artForItem } from "@/components/shop/shop-art"

/**
 * How each rarity looks. One table, so a card, a chip and a filter can never
 * disagree about what "epic" is.
 */
export const RARITY_STYLE: Record<
  string,
  { label: string; chip: string; edge: string; dot: string }
> = {
  common: {
    label: "Common",
    chip: "border-border bg-muted text-muted-foreground",
    edge: "from-slate-400/50",
    dot: "bg-slate-400",
  },
  rare: {
    label: "Rare",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    edge: "from-sky-400/70",
    dot: "bg-sky-400",
  },
  epic: {
    label: "Epic",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    edge: "from-violet-400/70",
    dot: "bg-violet-400",
  },
  legendary: {
    label: "Legendary",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    edge: "from-amber-400/80",
    dot: "bg-amber-400",
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
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        style.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
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
 * The preview is live — the real effect is running in the stage, not a static
 * image — and everything below it is one line of metadata and one price, so a
 * dense grid stays scannable.
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
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent", style.edge)}
      />

      <button
        type="button"
        onClick={() => onPreview(item)}
        className="relative block w-full cursor-pointer overflow-hidden border-b border-border bg-muted/30"
        aria-label={`Preview ${item.name}`}
      >
        <div className="aspect-[4/3] w-full">
          <ShopItemMiniPreview item={item} className="py-3" />
        </div>

        <span className="absolute left-2.5 top-2.5">
          <RarityChip rarity={item.rarity} />
        </span>

        {/*
          One badge in the top-right corner, never two: "Pro" and "Owned"
          used to render at identical coordinates and stack on top of each
          other. Ownership is the more useful fact, so it wins.
        */}
        {owned ? (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 backdrop-blur-sm dark:text-emerald-400">
            <Check className="h-2.5 w-2.5" />
            Owned
          </span>
        ) : item.premium_only ? (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 backdrop-blur-sm dark:text-amber-400">
            {locked ? <Lock className="h-2.5 w-2.5" /> : <Crown className="h-2.5 w-2.5" />}
            Pro
          </span>
        ) : null}

        <span className="absolute inset-x-0 bottom-0 flex justify-center pb-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur-sm">
            <Eye className="h-3 w-3" />
            See it live
          </span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
          {/* Reserved at two lines so one-line and two-line descriptions produce
              the same card height and the grid rows stay aligned. */}
          <p className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground">
            {isCoinPack ? (
              <>
                <span className="text-emerald-600 dark:text-emerald-400">${usd || coins}</span>
                <span className="text-[11px] font-normal text-muted-foreground">USD</span>
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 text-amber-500" />
                {coins.toLocaleString()}
                <span className="text-[11px] font-normal text-muted-foreground">coins</span>
              </>
            )}
          </span>

          {owned && !isCoinPack ? (
            <Button asChild size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
              <Link href="/inventory">
                Equip
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onBuy?.(item)}
              disabled={purchasing}
              className="h-8 rounded-full px-3 text-xs font-semibold"
            >
              {purchasing ? (
                <Lottie animation={itemArt} className="h-4 w-4" />
              ) : locked ? (
                <>
                  <Lock className="mr-1 h-3 w-3" />
                  Pro
                </>
              ) : (
                isCoinPack ? "Buy now" : "Buy"
              )}
            </Button>
          )}
        </div>

        {!isCoinPack && usd > 0 && !owned ? (
          <button
            type="button"
            onClick={() => onBuyWithCard?.(item)}
            disabled={purchasing}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            <CreditCard className="h-3 w-3" />
            or pay ${usd.toFixed(2)} with card
          </button>
        ) : null}
      </div>
    </article>
  )
}
