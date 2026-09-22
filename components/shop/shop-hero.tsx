"use client"

import Link from "next/link"
import { Coins, LayoutGrid, Sparkles, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Lottie } from "@/components/ui/lottie"
import { COIN } from "@/components/shop/shop-art"

export interface ShopHeroProps {
  /** `null` when signed out. */
  coins: number | null
  /** `null` while the catalogue is still loading — shows "—", not a false 0. */
  ownedCount: number | null
  availableCount: number | null
  onBrowseCoins: () => void
  onBrowseAll: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * The shop's front door: what this place is for, what you have, and the one
 * thing to do next.
 */
export function ShopHero({ coins, ownedCount, availableCount, onBrowseCoins, onBrowseAll }: ShopHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
      {/* Two soft light sources, kept far below the content's contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.65]"
        style={{
          background:
            "radial-gradient(680px 320px at 8% -10%, rgba(139,92,246,0.20), transparent 62%), radial-gradient(560px 300px at 100% 118%, rgba(34,211,238,0.14), transparent 60%)",
        }}
      />

      <div className="relative grid gap-8 p-6 sm:p-8 md:grid-cols-[1.5fr_1fr] md:items-center">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-violet-500" />
            Loop Shop
          </p>

          <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            Make your profile unmistakably yours.
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Themes that repaint the whole app, frames and auras that follow your avatar, effects your
            posts carry — buy once with Loop Coins and they stay in your inventory for good. Every item
            here previews live before you spend anything.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Button className="rounded-full" onClick={onBrowseCoins}>
              <Coins className="mr-1.5 h-4 w-4" />
              Get Loop Coins
            </Button>
            <Button variant="outline" className="rounded-full" onClick={onBrowseAll}>
              <LayoutGrid className="mr-1.5 h-4 w-4" />
              Browse everything
            </Button>
            <Link
              href="/quests"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Wallet className="h-3.5 w-3.5" />
              Earn coins free
            </Link>
          </div>

          <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-border pt-4">
            <Stat label="Your balance" value={coins === null ? "—" : coins.toLocaleString()} />
            <Stat label="Owned" value={ownedCount === null ? "—" : ownedCount.toLocaleString()} />
            <Stat label="Available" value={availableCount === null ? "—" : availableCount.toLocaleString()} />
          </dl>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="w-full max-w-[320px] rounded-2xl border border-border bg-background/70 p-4 backdrop-blur-sm">
            <Lottie animation={COIN} className="mx-auto h-32 w-32" />
            <p className="mt-1 text-center text-xs uppercase tracking-wide text-muted-foreground">
              Loop Coins
            </p>
            <p className="mt-1 text-center text-3xl font-semibold tabular-nums text-foreground">
              {coins === null ? "Sign in" : coins.toLocaleString()}
            </p>
            <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
              {coins === null
                ? "Sign in to spend and keep what you buy."
                : "Coins come from quests, tips and coin packs."}
            </p>
            {coins === null ? (
              <Button asChild size="sm" className="mt-3 w-full rounded-full">
                <Link href="/login">Sign in</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="mt-3 w-full rounded-full" onClick={onBrowseCoins}>
                Top up
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
