"use client"

import { useCallback, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  Gift,
} from "@/components/icons/lucide-compat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/skeletons"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { GiftArtwork } from "@/components/gifting/gift-art"
import { cn } from "@/lib/utils"

export interface GiftCollectionItem {
  id: string
  name: string
  type: string
  rarity: string
  art?: string | null
  palette?: { primary: string; secondary: string; accent?: string } | null
  use_type?: string | null
  use_label?: string | null
  effect?: string | null
  cost: number
  coin_value: number
  converted_at?: string | null
  converted_coins?: number | null
  created_at: string
}

interface GiftCollectionProps {
  items: GiftCollectionItem[]
  onConverted?: (itemId: string, coins: number, newBalance?: number) => void
}

type Phase = "idle" | "confirming" | "converting" | "success"

const RARITY_STYLES: Record<string, string> = {
  common: "border-slate-400/30 bg-slate-400/10 text-slate-500",
  rare: "border-sky-400/30 bg-sky-400/10 text-sky-500",
  epic: "border-violet-400/30 bg-violet-400/10 text-violet-500",
  legendary: "border-amber-400/40 bg-amber-400/10 text-amber-600",
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" })
}

export function GiftCollection({ items, onConverted }: GiftCollectionProps) {
  const { getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const [selected, setSelected] = useState<GiftCollectionItem | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [convertedCoins, setConvertedCoins] = useState(0)

  const convertibleCount = useMemo(
    () => items.filter((item) => !item.converted_at && item.coin_value > 0).length,
    [items],
  )

  const close = useCallback(() => {
    if (phase === "converting") return
    setSelected(null)
    setPhase("idle")
    setError(null)
    setConvertedCoins(0)
  }, [phase])

  const open = useCallback((item: GiftCollectionItem) => {
    if (item.converted_at || item.coin_value <= 0) return
    setSelected(item)
    setPhase("confirming")
    setError(null)
    setConvertedCoins(0)
  }, [])

  const convert = useCallback(async () => {
    if (!selected || phase !== "confirming") return
    setPhase("converting")
    setError(null)
    try {
      const response = await fetch("/api/gifts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ gift_id: selected.id, action: "convert" }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        throw new Error(data.error || "This gift could not be converted.")
      }

      const coins = Number(data.converted_coins || selected.coin_value)
      setConvertedCoins(coins)
      setPhase("success")
      onConverted?.(selected.id, coins, Number(data.loop_coins))
      void refreshUser()
      toast({
        title: "Gift converted 🪙",
        description: `${coins.toLocaleString()} Loop Coins were added to your wallet.`,
      })
    } catch (conversionError: any) {
      setError(conversionError?.message || "This gift could not be converted. Try again.")
      setPhase("confirming")
    }
  }, [getAuthHeader, onConverted, phase, refreshUser, selected, toast])

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
        <Gift className="mx-auto h-7 w-7 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-semibold text-foreground">Your gift collection is waiting</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Accept a gift to keep it here, then convert it to coins whenever you like.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {convertibleCount > 0
            ? `${convertibleCount} gift${convertibleCount === 1 ? "" : "s"} can be converted to coins.`
            : "All convertible gifts have been handled."}
        </p>
        <Badge variant="outline" className="shrink-0 text-[10px] font-semibold">
          Keep or convert
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const converted = Boolean(item.converted_at)
          const canConvert = !converted && item.coin_value > 0
          const palette = item.palette || { primary: "#a78bfa", secondary: "#f472b6" }
          return (
            <article
              key={item.id}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-3.5 shadow-sm",
                converted && "opacity-75",
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background: `radial-gradient(circle at 8% 0%, ${palette.primary}24, transparent 48%)`,
                }}
              />
              <div className="relative flex items-start gap-3">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border/70"
                  style={{
                    background: `radial-gradient(circle at 30% 20%, ${palette.primary}45, rgba(8,10,18,0.9) 72%)`,
                  }}
                >
                  <GiftArtwork art={item.art} title={item.name} className="h-10 w-10" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{item.name}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {item.use_label || "Gift collectible"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[9px] font-bold uppercase",
                        RARITY_STYLES[String(item.rarity || "common").toLowerCase()] ||
                          RARITY_STYLES.common,
                      )}
                    >
                      {item.rarity}
                    </Badge>
                  </div>
                  {item.effect ? (
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {item.effect}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="relative mt-3 flex items-end justify-between gap-3 border-t border-border/50 pt-2.5">
                <div>
                  {converted ? (
                    <p className="text-[11px] font-bold text-muted-foreground">
                      Converted to {(item.converted_coins || item.coin_value).toLocaleString()} coins
                    </p>
                  ) : item.coin_value > 0 ? (
                    <p className="inline-flex items-center gap-1 text-[12px] font-black text-emerald-500">
                      <Coins className="h-3.5 w-3.5" />
                      {item.coin_value.toLocaleString()} coin value
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold text-amber-600">Already delivered as coins</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Received {formatDate(item.created_at)}
                  </p>
                </div>

                {canConvert ? (
                  <Button
                    size="sm"
                    onClick={() => open(item)}
                    className="h-8 rounded-full px-3 text-[11px] font-bold"
                  >
                    Convert
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                ) : converted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                    <Check className="h-3 w-3" /> Converted
                  </span>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(openNext) => (!openNext ? close() : undefined)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  {phase === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Coins className="h-5 w-5 text-amber-500" />
                  )}
                  {phase === "success" ? "Coins added" : `Convert ${selected.name}?`}
                </DialogTitle>
                <DialogDescription>
                  {phase === "success"
                    ? "Your gift is marked as converted and the coins are ready to spend or withdraw."
                    : "The gift is marked as converted and cannot be converted again. The collectible stays in your gift history as a keepsake."}
                </DialogDescription>
              </DialogHeader>

              {phase === "success" ? (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-6 text-center">
                  <p className="text-3xl font-black tracking-tight text-emerald-500">
                    +{convertedCoins.toLocaleString()}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Coins className="h-3.5 w-3.5" /> Loop Coins added to your wallet
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70"
                        style={{
                          background: `radial-gradient(circle at 30% 20%, ${
                            (selected.palette || { primary: "#a78bfa" }).primary
                          }45, rgba(8,10,18,0.9) 72%)`,
                        }}
                      >
                        <GiftArtwork art={selected.art} className="h-10 w-10" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground">{selected.name}</p>
                        <p className="text-xs text-muted-foreground">{selected.use_label}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-500">
                          +{selected.coin_value.toLocaleString()}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          coins
                        </p>
                      </div>
                    </div>
                  </div>

                  {error ? (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {error}
                    </p>
                  ) : null}
                </>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                {phase === "success" ? (
                  <Button onClick={close} className="w-full rounded-xl">
                    Done
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={close}
                      disabled={phase === "converting"}
                      className="rounded-xl"
                    >
                      Keep gift
                    </Button>
                    <Button
                      onClick={() => void convert()}
                      disabled={phase === "converting"}
                      className="rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                    >
                      {phase === "converting" ? (
                        <>
                          <Spinner className="mr-1.5 h-3.5 w-3.5" />
                          Converting…
                        </>
                      ) : (
                        <>
                          <Coins className="mr-1.5 h-3.5 w-3.5" />
                          Convert to coins
                        </>
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
