"use client"

import Link from "next/link"
import { ArrowRight, Coins, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Lottie } from "@/components/ui/lottie"
import { RarityChip } from "@/components/shop/shop-item-card"
import { COIN_GOLD, sparklesFor } from "@/components/shop/shop-art"

export interface CelebrationPayload {
  name: string
  rarity?: string | null
  /** Coins added, for a coin pack. */
  coins?: number
  /** `false` for a coin pack — there is nothing to equip. */
  hasInventoryEntry: boolean
}

/**
 * The moment after a purchase lands.
 *
 * The burst is the app's own sparkle animation, tinted to the item's rarity and
 * played a couple of times rather than forever, so the celebration belongs to
 * this purchase instead of becoming a permanent decoration.
 */
export function PurchaseCelebration({
  payload,
  onClose,
}: {
  payload: CelebrationPayload | null
  onClose: () => void
}) {
  const open = Boolean(payload)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-sm overflow-hidden border-border bg-card p-0 text-center">
        <div className="relative px-6 pt-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70"
            style={{
              background:
                "radial-gradient(260px 150px at 50% 0%, rgba(139,92,246,0.22), transparent 70%)",
            }}
          />
          <div className="relative flex justify-center">
            <Lottie
              animation={payload?.coins ? COIN_GOLD : sparklesFor(payload?.rarity)}
              className="h-28 w-28"
              loop={2}
              label="Purchase complete"
            />
          </div>

          <DialogTitle className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            {payload?.coins ? "Coins added" : "It's yours"}
          </DialogTitle>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {payload?.coins ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                <Coins className="h-3.5 w-3.5" />+{payload.coins.toLocaleString()}
              </span>
            ) : (
              <>
                <span className="text-sm font-medium text-foreground">{payload?.name}</span>
                {payload?.rarity ? <RarityChip rarity={payload.rarity} /> : null}
              </>
            )}
          </div>

          <p className="mx-auto mt-3 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
            {payload?.coins
              ? "Spend them anywhere in the shop — or tip a creator."
              : payload?.hasInventoryEntry
                ? "It's in your inventory now. Equip it whenever you like — and take it off again just as easily."
                : "You own it forever."}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-border p-4">
          {payload?.hasInventoryEntry ? (
            <Button asChild className="rounded-full">
              <Link href="/inventory" onClick={onClose}>
                <Package className="mr-1.5 h-4 w-4" />
                Open inventory
              </Link>
            </Button>
          ) : (
            <Button asChild className="rounded-full">
              <Link href="/wallet" onClick={onClose}>
                View wallet
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" className="rounded-full" onClick={onClose}>
            Keep browsing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
