"use client"

import Link from "next/link"
import { MessageCircle, ArrowLeft, Coins } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { Lottie } from "@/components/ui/lottie"
import { COIN, GIFT, LOCK } from "@/components/shop/shop-art"

interface UnderConstructionProps {
  message?: string
  subtitle?: string
}

/**
 * The shop with its shutters down.
 *
 * Deliberately not a dead end: coin packs, quests and support stay reachable
 * while the shelves are being restocked.
 */
export function ShopUnderConstruction({
  message = "We're restocking the shelves",
  subtitle = "New themes, frames and effects are going in. Your coins are untouched, and anything you already own still works today.",
}: UnderConstructionProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{
            background: "radial-gradient(220px 160px at 50% 30%, rgba(139,92,246,0.20), transparent 70%)",
          }}
        />
        <Lottie animation={LOCK} className="h-40 w-40" label="The shop is closed for now" />
      </div>

      <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{message}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

      <div className="mt-8 grid w-full grid-cols-3 gap-3 border-y border-border py-5">
        {[
          { art: COIN, label: "Coins safe" },
          { art: GIFT, label: "Quests open" },
          { art: LOCK, label: "Owned items work" },
        ].map((cell) => (
          <div key={cell.label} className="flex flex-col items-center gap-1.5">
            <Lottie animation={cell.art} className="h-10 w-10" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {cell.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/home">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Loop
          </Link>
        </Button>
        <Button asChild className="rounded-full">
          <Link href="/quests">
            <Coins className="mr-1.5 h-4 w-4" />
            Earn coins meanwhile
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full">
          <a href="mailto:support@loopapp.me" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            Support
          </a>
        </Button>
      </div>
    </div>
  )
}
