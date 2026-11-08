"use client"

import Link from "next/link"
import { ArrowUpRight, Coins, Layers, ShoppingBag, Sparkles, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Lottie } from "@/components/ui/lottie"
import { COIN } from "@/components/shop/shop-art"
import { ShopItemMiniPreview, type ShopPreviewItem } from "@/components/shop/shop-item-preview"
import { coinPrice } from "@/lib/shop-catalog"
import { cn } from "@/lib/utils"

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

/**
 * The storefront's front window.
 *
 * A dark stage, one oversized drop, and the two things a visitor can do next.
 * The featured item is interactive — it opens the same live preview as the
 * shelf below, so nothing here is decoration.
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
  const secondary = rest.slice(0, 2)

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0a10] text-foreground shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 shop-grid-lines opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 340px at 6% -10%, rgba(245,184,61,0.20), transparent 62%), radial-gradient(560px 320px at 96% 108%, rgba(139,92,246,0.24), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent"
      />

      <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:p-10">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/90 backdrop-blur-sm">
            <ShoppingBag className="h-3 w-3" />
            Loop Store
            <span className="text-white/25">/</span>
            Season drops
          </p>

          <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[2.6rem]">
            Looks people remember,
            <span className="block bg-gradient-to-r from-amber-200 via-amber-100 to-amber-400/80 bg-clip-text text-transparent">
              kept for good.
            </span>
          </h1>

          <p className="mt-3.5 max-w-md text-[13px] leading-6 text-white/60 sm:text-sm">
            Themes that repaint the whole app, frames and auras that follow your avatar, post effects that
            carry your name. Every item previews live before you spend a coin.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button
              className="rounded-full bg-amber-300 px-4 font-semibold text-[#1a1305] hover:bg-amber-200"
              onClick={onBrowseAll}
            >
              Browse the vault
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-white/15 bg-white/[0.03] text-foreground hover:bg-white/[0.08]"
              onClick={onBrowseCoins}
            >
              <Coins className="mr-1.5 h-4 w-4 text-amber-300" />
              Get Loop Coins
            </Button>
            <Link
              href="/quests"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-medium text-white/55 transition-colors hover:text-white"
            >
              <Wallet className="h-3.5 w-3.5" />
              Earn coins free
            </Link>
          </div>

          <dl className="mt-7 grid max-w-md grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.025] px-1 py-3">
            <div className="px-3">
              <Stat label="Your balance" value={coins === null ? "—" : coins.toLocaleString()} />
            </div>
            <div className="px-3">
              <Stat label="Collected" value={ownedCount === null ? "—" : ownedCount.toLocaleString()} />
            </div>
            <div className="px-3">
              <Stat label="In the store" value={availableCount === null ? "—" : availableCount.toLocaleString()} />
            </div>
          </dl>
        </div>

        <div className="relative min-w-0">
          {hero ? (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => onPreview(hero)}
                className="group relative block w-full overflow-hidden rounded-2xl border border-white/15 bg-[#100e16] p-2 text-left transition-colors hover:border-amber-300/40"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    background:
                      "radial-gradient(420px 200px at 80% 0%, rgba(245,184,61,0.16), transparent 70%)",
                  }}
                />
                <span className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0a0910]">
                  <ShopItemMiniPreview item={hero} className="py-4 transition-transform duration-500 group-hover:scale-[1.04]" />
                  <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#1a1305]">
                    <Sparkles className="h-2.5 w-2.5" />
                    Featured drop
                  </span>
                </span>
                <span className="relative mt-2 flex items-center justify-between gap-3 px-1 pb-1">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{hero.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-white/45">{hero.description}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-amber-200">
                    <Coins className="h-3.5 w-3.5" />
                    {coinPrice(hero).toLocaleString()}
                  </span>
                </span>
              </button>

              {secondary.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {secondary.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onPreview(item)}
                      className={cn(
                        "group flex items-center gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] p-1.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]",
                      )}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#0a0910]">
                        <ShopItemMiniPreview item={item} className="scale-90" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-semibold text-foreground">{item.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium tabular-nums text-white/45">
                          <Coins className="h-2.5 w-2.5 text-amber-300/80" />
                          {coinPrice(item).toLocaleString()}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center">
              <Lottie animation={COIN} className="mx-auto h-28 w-28" />
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">Loop Coins</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                {coins === null ? "Sign in" : coins.toLocaleString()}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
                {coins === null
                  ? "Sign in to spend and keep what you buy."
                  : "Coins come from quests, tips and coin packs."}
              </p>
              {coins === null ? (
                <Button asChild size="sm" className="mt-3 w-full rounded-full">
                  <Link href="/login">Sign in</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="mt-3 w-full rounded-full border-white/15" onClick={onBrowseCoins}>
                  <Layers className="mr-1.5 h-3.5 w-3.5" />
                  Top up
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
