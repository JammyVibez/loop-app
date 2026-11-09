"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Check, Coins, Gift, Info, Lock, RotateCcw, Sparkles, Star } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/skeletons"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { GiftArtwork } from "@/components/gifting/gift-art"
import type { GiftSendEvent } from "@/components/gifting/gift-celebration"
import {
  GIFT_PANEL_TABS,
  GIFT_TYPE_PALETTE,
  giftTypeForTab,
  type GiftTabId,
} from "@/lib/gifts/catalog"
import { cn } from "@/lib/utils"
import { ActionFeedback, type ActionPhase } from "@/components/ui/action-feedback"

export interface PanelGift {
  id: string
  canonical_id?: string | null
  name: string
  description: string
  type: string
  tab?: string
  cost: number
  rarity: string
  duration?: string | null
  duration_ms?: number | null
  art?: string | null
  celebration?: string | null
  palette?: { primary: string; secondary: string; accent?: string } | null
  effects?: any
  is_canonical?: boolean
  icon_url?: string | null
}

export interface GiftPanelContext {
  type: "post" | "reel" | "profile" | "comment" | "branch" | "stream"
  id: string
  title?: string
  circle_id?: string
}

interface GiftPanelProps {
  recipient: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    video_avatar_url?: string | null
    is_premium?: boolean
  }
  context?: GiftPanelContext
  /** Fires the instant Send is pressed, before the network call. */
  onGiftQueued?: (event: GiftSendEvent) => void
  /** Fires after the server confirms the gift. */
  onGiftSent?: (gift: {
    id: string
    name: string
    cost: number
    type: string
    rarity: string
    art?: string | null
    durationMs?: number | null
    palette?: { primary: string; secondary: string; accent?: string } | null
  }) => void
  className?: string
  /** Hide the recipient/balance header when the host already shows it. */
  hideHeader?: boolean
  /**
   * `dark` keeps the panel legible on the always-dark live-room surface even
   * when the app itself is in a light theme. Default follows the app theme.
   */
  tone?: "default" | "dark"
}

// Token values matching the app's dark theme, scoped to the panel so the same
// markup works over a light modal and a black live room.
const DARK_SURFACE = {
  "--background": "210 11% 4%",
  "--card": "210 6% 6%",
  "--popover": "210 6% 6%",
  "--card-foreground": "180 7% 97%",
  "--foreground": "180 7% 97%",
  "--muted": "210 6% 10%",
  "--muted-foreground": "220 5% 62%",
  "--accent": "220 6% 14%",
  "--accent-foreground": "0 0% 98%",
  "--border": "220 6% 16%",
  "--input": "220 6% 16%",
} as CSSProperties

const RARITY_STYLES: Record<
  string,
  { chip: string; ring: string; glow: string; label: string }
> = {
  common: {
    chip: "border-slate-400/40 bg-slate-400/10 text-foreground",
    ring: "ring-slate-400/25",
    glow: "from-slate-400/20",
    label: "Common",
  },
  rare: {
    chip: "border-sky-400/40 bg-sky-400/10 text-foreground",
    ring: "ring-sky-400/40",
    glow: "from-sky-400/25",
    label: "Rare",
  },
  epic: {
    chip: "border-violet-400/40 bg-violet-400/10 text-foreground",
    ring: "ring-violet-400/45",
    glow: "from-violet-400/30",
    label: "Epic",
  },
  legendary: {
    chip: "border-amber-400/50 bg-amber-400/10 text-foreground",
    ring: "ring-amber-400/50",
    glow: "from-amber-400/35",
    label: "Legendary",
  },
}

function rarityStyle(rarity?: string) {
  return RARITY_STYLES[String(rarity || "common").toLowerCase()] || RARITY_STYLES.common
}

function tabForGift(gift: PanelGift): GiftTabId {
  if (gift.tab && GIFT_PANEL_TABS.some((tab) => tab.id === gift.tab)) return gift.tab as GiftTabId
  return giftTypeForTab(gift.type)
}

export function GiftPanel({
  recipient,
  context,
  onGiftQueued,
  onGiftSent,
  className,
  hideHeader = false,
  tone = "default",
}: GiftPanelProps) {
  const { toast } = useToast()
  const { user, getAuthHeader, refreshUser } = useAuth()

  const [gifts, setGifts] = useState<PanelGift[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<GiftTabId>("badge")
  const [selected, setSelected] = useState<PanelGift | null>(null)
  const [message, setMessage] = useState("")
  const [anonymous, setAnonymous] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendPhase, setSendPhase] = useState<ActionPhase>("idle")
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastAttempt, setLastAttempt] = useState<{
    gift: PanelGift
    message: string
    anonymous: boolean
  } | null>(null)
  const [balance, setBalance] = useState(Number(user?.loop_coins || 0))
  // A gift is money: block a same-frame double send before `sending` renders.
  const sendingRef = useRef(false)

  useEffect(() => {
    setBalance(Number(user?.loop_coins || 0))
  }, [user?.loop_coins])

  const loadGifts = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/gifts", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load the gift catalog.")
      const list = (data.data?.gifts || data.gifts || []) as PanelGift[]
      setGifts(list)
      setSelected((prev) => {
        if (prev && list.some((gift) => gift.id === prev.id)) {
          return list.find((gift) => gift.id === prev.id) || prev
        }
        return list.find((gift) => tabForGift(gift) === "badge") || list[0] || null
      })
    } catch (error: any) {
      setLoadError(error?.message || "Could not load the gift catalog.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGifts()
  }, [loadGifts])

  const grouped = useMemo(() => {
    const map = new Map<GiftTabId, PanelGift[]>()
    for (const gift of gifts) {
      const key = tabForGift(gift)
      map.set(key, [...(map.get(key) || []), gift])
    }
    return map
  }, [gifts])

  const visible = grouped.get(tab) || []

  const sendGift = useCallback(
    async (gift: PanelGift, options?: { message?: string; anonymous?: boolean }) => {
      const giftMessage = (options?.message ?? message).trim()
      const isAnon = options?.anonymous ?? anonymous

      if (!user) {
        toast({
          title: "Sign in to gift",
          description: "You need a Loop account to send gifts.",
          variant: "destructive",
        })
        return
      }
      if (balance < gift.cost) {
        toast({
          title: "Not enough coins",
          description: `You need ${(gift.cost - balance).toLocaleString()} more coins for ${gift.name}.`,
          variant: "destructive",
          action: (
            <ToastAction altText="Open wallet" onClick={() => window.open("/wallet", "_self")}>
              Top up
            </ToastAction>
          ),
        })
        return
      }

      const key = `gift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      if (sendingRef.current) return
      sendingRef.current = true

      // Optimistic: balance and animation start now; the server reconciles.
      setBalance((prev) => prev - gift.cost)
      setSendError(null)
      setSendPhase("working")
      setLastAttempt({ gift, message: giftMessage, anonymous: isAnon })
      setSending(true)
      onGiftQueued?.({
        key,
        giftId: gift.id,
        canonicalId: gift.canonical_id || null,
        name: gift.name,
        cost: gift.cost,
        type: gift.type,
        rarity: gift.rarity,
        art: gift.art,
        celebration: gift.celebration,
        durationMs: gift.duration_ms,
        palette: gift.palette,
        sound: (gift.effects && gift.effects.sound) || null,
        sender: {
          display_name: user.display_name,
          username: user.username,
          avatar_url: user.avatar_url,
        },
        message: giftMessage || null,
        anonymous: isAnon,
        optimistic: true,
      })

      try {
        const response = await fetch("/api/gifts/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({
            recipient_id: recipient.id,
            gift_item_id: gift.id,
            message: giftMessage,
            is_anonymous: isAnon,
            context,
            effects: gift.effects,
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.success) {
          throw new Error(data.error || "The gift could not be sent.")
        }

        if (typeof data.new_balance === "number") setBalance(Number(data.new_balance))
        setSendPhase("success")
        window.setTimeout(() => setSendPhase("idle"), 1200)
        setMessage("")
        setAnonymous(false)

        toast({
          title: "Gifted successfully 🎁",
          description: `${gift.name} sent to ${recipient.display_name}.${
            data.delivery_warning ? " The collectible will finish delivering shortly." : ""
          }`,
        })

        onGiftSent?.({
          id: data.gift_id || gift.id,
          name: gift.name,
          cost: gift.cost,
          type: gift.type,
          rarity: gift.rarity,
          art: gift.art,
          durationMs: gift.duration_ms,
          palette: gift.palette,
        })

        void refreshUser()
      } catch (error: any) {
        setBalance((prev) => prev + gift.cost)
        setSendPhase("error")
        setSendError(error?.message || "Something went wrong. Your coins are still yours.")
        toast({
          title: "Gift not sent",
          description: error?.message || "Something went wrong. Your coins are still yours.",
          variant: "destructive",
          action: (
            <ToastAction
              altText="Retry gift"
              onClick={() => void sendGift(gift, { message: giftMessage, anonymous: isAnon })}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </ToastAction>
          ),
        })
      } finally {
        sendingRef.current = false
        setSending(false)
      }
    },
    [
      anonymous,
      balance,
      context,
      getAuthHeader,
      message,
      onGiftQueued,
      onGiftSent,
      recipient.display_name,
      recipient.id,
      refreshUser,
      toast,
      user,
    ],
  )

  const selectedRarity = rarityStyle(selected?.rarity)
  const canAfford = selected ? balance >= selected.cost : false

  return (
    <div
      style={tone === "dark" ? DARK_SURFACE : undefined}
      className={cn("flex h-full min-h-0 flex-col bg-card text-card-foreground", className)}
    >
      {!hideHeader ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={recipient.avatar_url} alt="" />
            <AvatarFallback>{recipient.display_name?.charAt(0) || "L"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{recipient.display_name}</p>
            <p className="truncate text-[11px] text-muted-foreground">@{recipient.username}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Balance
            </p>
            <p className="inline-flex items-center gap-1 text-sm font-black text-warning">
              <Coins className="h-3.5 w-3.5" />
              {balance.toLocaleString()}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GIFT_PANEL_TABS.map((item) => {
          const count = grouped.get(item.id)?.length || 0
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id)
                const firstGift = grouped.get(item.id)?.[0]
                if (firstGift) setSelected(firstGift)
              }}
              aria-pressed={active}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
                active
                  ? "border-primary/30 bg-primary/15 text-foreground shadow-[0_0_20px_-8px_hsl(var(--primary)/0.55)]"
                  : "border-transparent bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-3">
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Spinner className="h-4 w-4" />
            Loading gifts…
          </div>
        ) : loadError ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <Info className="h-5 w-5 text-amber-500" />
            <p className="text-xs text-muted-foreground">{loadError}</p>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => void loadGifts()}>
              Try again
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center">
            {tab === "premium" ? (
              <>
                <Lock className="h-5 w-5 text-muted-foreground/70" />
                <p className="text-sm font-semibold text-foreground/80">Premium gifts are being curated</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Exclusive member-only drops will appear here. Badge and animation gifts are ready now.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-1 rounded-full"
                  onClick={() => setTab("badge")}
                >
                  Browse badge gifts
                </Button>
              </>
            ) : (
              <>
                <Gift className="h-5 w-5 text-muted-foreground/70" />
                <p className="text-xs text-muted-foreground">No gifts in this tab yet.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visible.map((gift) => {
              const active = selected?.id === gift.id
              const affordable = balance >= gift.cost
              const rarity = rarityStyle(gift.rarity)
              const palette =
                gift.palette ||
                GIFT_TYPE_PALETTE[giftTypeForTab(gift.type) as keyof typeof GIFT_TYPE_PALETTE]
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => setSelected(gift)}
                  aria-pressed={active}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-2xl border p-2.5 text-left transition duration-200",
                    active
                      ? "border-primary/40 bg-accent shadow-[0_12px_40px_-18px_hsl(var(--primary)/0.5)]"
                      : "border-border bg-muted/40 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent",
                    !affordable && "opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60",
                      rarity.glow,
                    )}
                  />
                  <div className="relative mb-1.5 flex items-start justify-between">
                    <span
                      className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-border shadow-inner"
                      style={{
                        background: `radial-gradient(circle at 30% 20%, ${palette.primary}40, rgba(8,10,18,0.9) 72%)`,
                      }}
                    >
                      <GiftArtwork art={gift.art} title={gift.name} className="h-12 w-12 transition duration-300 group-hover:scale-110" />
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                        rarity.chip,
                      )}
                    >
                      <Star className="h-2.5 w-2.5" />
                      {rarity.label}
                    </span>
                  </div>

                  <p className="relative truncate text-[12px] font-bold text-foreground">{gift.name}</p>
                  <p className="relative mt-0.5 line-clamp-2 min-h-[28px] text-[10px] leading-snug text-muted-foreground">
                    {gift.description}
                  </p>

                  <div className="relative mt-1.5 flex items-center justify-between gap-1 border-t border-border pt-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                      <Sparkles className="h-2.5 w-2.5" />
                      {gift.duration || (gift.duration_ms ? `${Math.round(gift.duration_ms / 1000)}s` : "live")}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-warning">
                      <Coins className="h-3 w-3" />
                      {gift.cost.toLocaleString()}
                    </span>
                  </div>

                  {active ? (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected ? (
        <div className="shrink-0 border-t border-border bg-muted/40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-2.5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${
                  (selected.palette || GIFT_TYPE_PALETTE[giftTypeForTab(selected.type) as keyof typeof GIFT_TYPE_PALETTE]).primary
                }40, rgba(8,10,18,0.9) 72%)`,
              }}
            >
              <GiftArtwork art={selected.art} className="h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-foreground">{selected.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {selected.cost.toLocaleString()} coins · {selected.duration || "live effect"}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase",
                selectedRarity.chip,
              )}
            >
              {selectedRarity.label}
            </span>
          </div>

          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add a personal message (optional)"
            rows={2}
            maxLength={500}
            className="mb-2 min-h-[58px] resize-none rounded-xl border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
          />

          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(event) => setAnonymous(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-input bg-background accent-violet-500"
              />
              Send anonymously
            </label>
            <span className="text-[10px] text-muted-foreground">
              After:{" "}
              <span className={cn("font-bold", canAfford ? "text-foreground/80" : "text-destructive")}>
                {(balance - selected.cost).toLocaleString()}
              </span>
            </span>
          </div>

          {sendPhase !== "idle" ? (
            <div className="mb-2">
              <ActionFeedback
                phase={sendPhase}
                label={`Sending ${selected.name}`}
                successLabel={`${selected.name} sent`}
                error={sendError || undefined}
                onRetry={
                  lastAttempt
                    ? () =>
                        void sendGift(lastAttempt.gift, {
                          message: lastAttempt.message,
                          anonymous: lastAttempt.anonymous,
                        })
                    : undefined
                }
              />
            </div>
          ) : null}

          <Button
            onClick={() => void sendGift(selected)}
            disabled={sending || !user}
            className="mt-2 h-11 w-full rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 text-sm font-black text-white shadow-[0_14px_34px_-14px_rgba(217,70,239,0.85)] transition hover:brightness-110 disabled:opacity-60"
          >
            {sending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Sending…
              </>
            ) : (
              <>
                <Gift className="mr-2 h-4 w-4" />
                Send {selected.name} · {selected.cost.toLocaleString()}
              </>
            )}
          </Button>
          {!user ? (
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Sign in to send gifts and join the leaderboard.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
