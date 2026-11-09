"use client"

import { ArrowUpRight, Coins, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Lottie } from "@/components/ui/lottie"
import { RarityChip } from "@/components/shop/shop-item-card"
import { ShopItemMiniPreview, type ShopPreviewItem } from "@/components/shop/shop-item-preview"
import { COIN } from "@/components/shop/shop-art"
import { coinPrice } from "@/lib/shop-catalog"

export interface ShopHeroProps {
  /** `null` when signed out. */
  coins: number | null
  /** `null` while the catalogue is still loading — shows "—", not a false 0. */
  ownedCount: number | null
  availableCount: number | null
  /** Rarest items, used for the drop window. */
  featured: ShopPreviewItem[]
  onBrowseCoins: () => void
  onBrowseAll: () => void
  onPreview: (item: ShopPreviewItem) => void
}

/**
 * The storefront's front window.
 *
 * One drop gets the room, the rest become a quiet rail of alternates. No
 * marketing stats or second hero — the shop below is the destination.
 */
export function ShopHero({
  coins,
  ownedCount,
  availableCount,
  featured,
  onBrowseCoins,
  onBrowseAll,
  onPreview,
}: ShopHeroProps) {
  const [hero, ...rest] = featured

  if (!hero) {
    return (
      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.09] bg-[#0b0a10]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(560px 280px at 8% 0%, rgba(245,184,61,0.14), transparent 64%), radial-gradient(520px 300px at 96% 100%, rgba(139,92,246,0.14), transparent 62%)",
          }}
        />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">Loop Store</p>
            <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,3.2rem)] leading-[0.98] tracking-[-0.035em]">
              A shelf for the way you show up.
            </h1>
            <p className="mt-3 max-w-md text-[12px] leading-6 text-white/55">
              Themes, frames, badges and effects. Preview everything live before you spend a coin.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/[0.09] bg-black/25 p-5 text-center">
            <Lottie animation={COIN} className="mx-auto h-20 w-20" />
            <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/40">Your balance</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{coins === null ? "—" : coins.toLocaleString()}</p>
            <Button
              size="sm"
              className="mt-3 h-9 w-full rounded-full bg-amber-300 text-[10px] font-bold text-[#1a1305] hover:bg-amber-200"
              onClick={onBrowseCoins}
            >
              Get Loop Coins
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#0b0a10] text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 shop-grid-lines opacity-50" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(640px 320px at 4% -10%, rgba(245,184,61,0.18), transparent 62%), radial-gradient(560px 300px at 98% 110%, rgba(139,92,246,0.2), transparent 62%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />

      <div className="relative grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex min-w-0 flex-col justify-between gap-8 p-6 sm:p-8 lg:p-10">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
              <Sparkles className="h-3 w-3" />
              Featured drop
            </p>

            <h1 className="mt-4 max-w-xl font-serif text-[clamp(2.15rem,4vw,3.6rem)] leading-[0.96] tracking-[-0.035em]">
              {hero.name}
            </h1>

            <p className="mt-3 line-clamp-3 max-w-md text-[12px] leading-6 text-white/55">
              {hero.description || "A little something to make your Loop yours."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <RarityChip rarity={hero.rarity} />
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-amber-200">
                <Coins className="h-3.5 w-3.5" />
                {coinPrice(hero).toLocaleString()}
              </span>
              {ownedCount !== null && availableCount !== null ? (
                <span className="text-[10px] text-white/40">
                  {ownedCount.toLocaleString()} of {availableCount.toLocaleString()} collected
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => onPreview(hero)}
              className="h-10 rounded-full bg-amber-300 px-4 text-[11px] font-bold text-[#1a1305] hover:bg-amber-200"
            >
              View item
              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              onClick={onBrowseAll}
              className="h-10 rounded-full border-white/[0.12] bg-white/[0.025] px-4 text-[11px] text-foreground hover:bg-white/[0.06]"
            >
              Browse all
            </Button>
            <button
              type="button"
              onClick={onBrowseCoins}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[10.5px] font-medium text-white/45 transition-colors hover:text-white"
            >
              <Coins className="h-3.5 w-3.5 text-amber-300/80" />
              {coins === null ? "Sign in for coins" : `${coins.toLocaleString()} coins`}
            </button>
          </div>
        </div>

        <div className="relative flex min-h-[280px] items-center justify-center border-t border-white/[0.08] p-5 lg:min-h-[380px] lg:border-l lg:border-t-0 lg:p-7">
          <button
            type="button"
            onClick={() => onPreview(hero)}
            className="group relative w-full max-w-[360px] overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#09080c] text-left transition-colors hover:border-amber-300/35"
          >
            <span className="relative block aspect-square w-full overflow-hidden">
              <ShopItemMiniPreview
                item={hero}
                className="p-5 transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[9px] font-medium text-white/80 backdrop-blur-md">
                Live preview
                <ArrowUpRight className="h-2.5 w-2.5" />
              </span>
            </span>
          </button>

          {rest.length > 0 ? (
            <div className="absolute bottom-5 right-5 flex gap-1.5">
              {rest.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPreview(item)}
                  aria-label={`Preview ${item.name}`}
                  title={item.name}
                  className="h-11 w-11 overflow-hidden rounded-xl border border-white/[0.12] bg-[#09080c] transition-colors hover:border-amber-300/40"
                >
                  <ShopItemMiniPreview item={item} className="scale-[0.82]" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
