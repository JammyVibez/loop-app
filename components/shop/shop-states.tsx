"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Lock, RefreshCw } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { Lottie } from "@/components/ui/lottie"
import { EMPTY_BOX, LOCK, LOADER, SPARKLES } from "@/components/shop/shop-art"

/** A centred panel: one animated mark, a line of copy, and what to do next. */
function StatePanel({
  art,
  title,
  hint,
  action,
}: {
  art: object
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <Lottie animation={art} className="h-24 w-24" />
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {hint ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

/** The shop is fetching. */
export function ShopLoading({ label = "Opening the shop…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Lottie animation={LOADER} className="h-16 w-16" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * Placeholder cards that mirror the real grid's proportions.
 *
 * The item list used to be replaced by a bare spinner, which collapsed the
 * whole page — hero, rail and toolbar all vanished and then re-appeared a
 * beat later. Reserving the shelf means the layout settles once.
 */
export function ShopGridSkeleton({
  count = 8,
  className = "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4",
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="aspect-[5/4] w-full border-b border-border bg-muted/40" />
          <div className="flex flex-1 flex-col gap-2.5 p-3.5">
            <div className="h-3.5 w-3/5 rounded-full bg-muted" />
            <div className="h-2.5 w-full rounded-full bg-muted/70" />
            <div className="h-2.5 w-4/5 rounded-full bg-muted/70" />
            <div className="mt-auto flex items-center justify-between pt-1">
              <div className="h-4 w-14 rounded-full bg-muted" />
              <div className="h-8 w-16 rounded-full bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Nothing matched — either the shelf is bare or the filters are too narrow. */
export function ShopEmpty({
  title = "Nothing on this shelf yet",
  hint,
  action,
}: {
  title?: string
  hint?: string
  action?: ReactNode
}) {
  return <StatePanel art={EMPTY_BOX} title={title} hint={hint} action={action} />
}

/** The shop did not load. Say so plainly and offer the one useful action. */
export function ShopError({ onRetry }: { onRetry?: () => void }) {
  return (
    <StatePanel
      art={LOCK}
      title="The shop door didn't open"
      hint="Nothing was charged and nothing was lost. Try again in a moment."
      action={
        onRetry ? (
          <Button variant="outline" className="rounded-full" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Try again
          </Button>
        ) : null
      }
    />
  )
}

/** An inline Pro wall, for a single item rather than a whole page. */
export function LockedNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3">
      <Lottie animation={LOCK} className="h-9 w-9 shrink-0" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <Lock className="h-3 w-3" />
          Pro only
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {children || "This item is part of Loop Pro."}
        </p>
        <Link
          href="/premium"
          className="mt-2 inline-flex text-xs font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          See what Pro includes
        </Link>
      </div>
    </div>
  )
}

/** The celebratory mark, for the moment after a purchase lands. */
export function CelebrationMark({ className }: { className?: string }) {
  return <Lottie animation={SPARKLES} className={className || "h-28 w-28"} loop={2} label="Purchase complete" />
}
