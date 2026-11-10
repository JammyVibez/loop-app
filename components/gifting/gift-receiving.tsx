"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useReducedMotion } from "motion/react"
import {
  Check,
  CheckCircle2,
  Coins,
  Gift,
  Heart,
  MessageCircle,
  Send,
  Star,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/skeletons"
import { GiftArtwork } from "@/components/gifting/gift-art"
import { useAuth } from "@/hooks/use-auth"
import { useRealtime } from "@/hooks/use-realtime"
import {
  giftSenderLabel,
  mergeReceivingGifts,
  normalizeReceivingGift,
  type ReceivingGift,
} from "@/lib/gifts/receiving"
import { GIFT_TYPE_PALETTE, giftTypeForTab } from "@/lib/gifts/catalog"
import { cn } from "@/lib/utils"

type ActionPhase = "idle" | "accepting" | "declining" | "accepted" | "declined"

const PETALS = [
  { left: "12%", delay: "0s", duration: "5.8s", size: 5, color: "#f9a8d4" },
  { left: "24%", delay: "1.4s", duration: "7.2s", size: 3, color: "#fde68a" },
  { left: "38%", delay: "0.7s", duration: "6.4s", size: 4, color: "#c4b5fd" },
  { left: "55%", delay: "2.1s", duration: "6.9s", size: 3, color: "#f9a8d4" },
  { left: "68%", delay: "0.4s", duration: "7.6s", size: 5, color: "#fde68a" },
  { left: "82%", delay: "1.8s", duration: "5.9s", size: 3, color: "#c4b5fd" },
  { left: "91%", delay: "2.7s", duration: "7.1s", size: 4, color: "#f9a8d4" },
]

export function GiftReceivingSystem() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { isConnected, subscribe, unsubscribe } = useRealtime()
  const reduceMotion = useReducedMotion()

  const [queue, setQueue] = useState<ReceivingGift[]>([])
  const [phase, setPhase] = useState<ActionPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [replyOpen, setReplyOpen] = useState(false)
  const [reply, setReply] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [thankedIds, setThankedIds] = useState<Set<string>>(new Set())
  const dismissedRef = useRef<Set<string>>(new Set())
  const syncRef = useRef(0)
  const actionRef = useRef(false)
  const replyRef = useRef(false)
  const current = queue[0] || null

  const addGifts = useCallback(
    (incoming: Array<ReceivingGift | null | undefined>) => {
      setQueue((previous) =>
        mergeReceivingGifts(previous, incoming, dismissedRef.current),
      )
    },
    [],
  )

  const shiftCurrent = useCallback((id: string) => {
    setQueue((previous) =>
      previous[0]?.id === id
        ? previous.slice(1)
        : previous.filter((gift) => gift.id !== id),
    )
    setReply("")
    setReplyOpen(false)
    setError(null)
    setPhase("idle")
    actionRef.current = false
    replyRef.current = false
  }, [])

  const loadPending = useCallback(async () => {
    if (!user) return
    const run = ++syncRef.current
    try {
      const response = await fetch("/api/gifts/manage?status=sent", {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      if (!response.ok) return
      const data = await response.json().catch(() => ({}))
      if (run !== syncRef.current) return
      const rows = data.gifts || data.data?.gifts || []
      const gifts = (Array.isArray(rows) ? rows : [])
        .map((row) => normalizeReceivingGift(row, user.id))
        .filter((gift): gift is ReceivingGift => Boolean(gift))
      addGifts(gifts)
    } catch {
      /* realtime still delivers; the next reconnect retries */
    }
  }, [addGifts, getAuthHeader, user])

  useEffect(() => {
    setQueue([])
    setPhase("idle")
    setError(null)
    setReplyOpen(false)
    setReply("")
    setThankedIds(new Set())
    dismissedRef.current = new Set()
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    void loadPending()

    // Realtime can be suspended in the background or miss a broadcast during
    // a network handoff. A slow reconciliation plus a resume check recovers
    // those gifts without competing with the live event.
    const poll = window.setInterval(() => void loadPending(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadPending()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(poll)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [loadPending, user])

  useEffect(() => {
    if (!isConnected || !user) return
    void loadPending()
    const handler = (raw: any) => {
      const gift = normalizeReceivingGift(raw?.payload || raw, user.id)
      if (!gift) return
      addGifts([gift])
    }
    subscribe("gift_received", handler)
    return () => unsubscribe("gift_received")
  }, [addGifts, isConnected, loadPending, subscribe, unsubscribe, user])

  // A short success beat keeps the overlay on screen while the action lands,
  // then the next gift in the same queue takes over. Only one is ever mounted.
  useEffect(() => {
    if (phase !== "accepted" && phase !== "declined") return
    if (!current) return
    const id = current.id
    const timer = window.setTimeout(() => shiftCurrent(id), 1250)
    return () => window.clearTimeout(timer)
  }, [current, phase, shiftCurrent])

  const runAction = useCallback(
    async (action: "accept" | "decline") => {
      if (!current || phase !== "idle" || actionRef.current) return
      actionRef.current = true
      setPhase(action === "accept" ? "accepting" : "declining")
      setError(null)
      try {
        const response = await fetch("/api/gifts/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ gift_id: current.id, action }),
        })
        const data = await response.json().catch(() => ({}))
        if (response.status === 409) {
          // Another tab or device already handled it. Move on rather than
          // showing a stale gift forever.
          actionRef.current = false
          shiftCurrent(current.id)
          return
        }
        if (!response.ok || !data.success) {
          throw new Error(data.error || "That gift could not be handled.")
        }
        actionRef.current = false
        if (action === "accept") {
          setPhase("accepted")
          void refreshUser()
        } else {
          setPhase("declined")
        }
      } catch (actionError: any) {
        actionRef.current = false
        setError(actionError?.message || "That gift could not be handled. Try again.")
        setPhase("idle")
      }
    },
    [current, getAuthHeader, phase, refreshUser, shiftCurrent],
  )

  const sendReply = useCallback(async () => {
    if (!current || !reply.trim() || sendingReply || replyRef.current) return
    replyRef.current = true
    setSendingReply(true)
    setError(null)
    try {
      const response = await fetch("/api/gifts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          gift_id: current.id,
          action: "thank",
          message: reply.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Your thank-you could not be sent.")
      }
      setThankedIds((previous) => new Set(previous).add(current.id))
      setReply("")
      setReplyOpen(false)
    } catch (replyError: any) {
      setError(replyError?.message || "Your thank-you could not be sent.")
    } finally {
      replyRef.current = false
      setSendingReply(false)
    }
  }, [current, getAuthHeader, reply, sendingReply])

  const dismiss = useCallback(() => {
    if (!current || actionRef.current || phase === "accepting" || phase === "declining") return
    dismissedRef.current.add(current.id)
    shiftCurrent(current.id)
  }, [current, phase, shiftCurrent])

  const palette = useMemo<{ primary: string; secondary: string; accent?: string }>(() => {
    if (current?.palette) return current.palette
    return GIFT_TYPE_PALETTE[giftTypeForTab(current?.type)]
  }, [current])

  if (!current) return null

  const senderName = giftSenderLabel(current)
  const senderHandle =
    !current.anonymous && current.sender?.username
      ? `@${current.sender.username}`
      : null
  const senderInitial = senderName.slice(0, 1).toUpperCase()
  const thanked = thankedIds.has(current.id)
  const settled = phase === "accepted" || phase === "declined"

  return (
    <Dialog open onOpenChange={(open) => (!open ? dismiss() : undefined)}>
      <DialogContent
        scrollable={false}
        className="fixed inset-0 z-[100] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden border-0 bg-[#07050b] p-0 shadow-none sm:rounded-none [&>[data-radix-dialog-close]]:text-white/70"
        style={{
          left: 0,
          top: 0,
          transform: "none",
          width: "100vw",
          maxWidth: "none",
          height: "100dvh",
        }}
      >
        <DialogTitle className="sr-only">
          Gift from {senderName}: {current.name}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Accept, decline, or send a thank-you for this gift. {queue.length} gift
          {queue.length === 1 ? "" : "s"} waiting.
        </DialogDescription>

        <div className="gift-receive-shell relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#07050b] text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 78% 52% at 50% 30%, ${palette.primary}34, transparent 70%), radial-gradient(ellipse 65% 45% at 50% 55%, ${palette.secondary}22, transparent 74%), linear-gradient(180deg, #07050b 0%, #0d0813 55%, #07050b 100%)`,
            }}
          />
          <div aria-hidden className="gift-receive-grain pointer-events-none absolute inset-0 opacity-[0.055]" />

          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[-16%] flex justify-center">
            <div
              className="gift-receive-orb h-[520px] w-[520px] rounded-full blur-3xl sm:h-[620px] sm:w-[620px]"
              style={{
                background: `conic-gradient(from 90deg, ${palette.primary}40, ${palette.secondary}2e, ${palette.accent || palette.primary}24, ${palette.primary}40)`,
              }}
            />
          </div>

          {!reduceMotion
            ? PETALS.map((petal, index) => (
                <span
                  key={index}
                  aria-hidden
                  className="gift-receive-petal pointer-events-none absolute bottom-[-8%] rounded-full"
                  style={
                    {
                      left: petal.left,
                      width: petal.size,
                      height: petal.size,
                      background: petal.color,
                      "--receive-delay": petal.delay,
                      "--receive-duration": petal.duration,
                    } as CSSProperties
                  }
                />
              ))
            : null}

          <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] pr-16">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 shadow-[0_0_30px_-8px_rgba(255,255,255,0.55)] backdrop-blur">
                <Gift className="h-4 w-4" style={{ color: palette.accent || palette.primary }} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  Gift inbox
                </p>
                <p className="truncate text-sm font-black tracking-tight text-white">
                  {queue.length > 1
                    ? `You received ${queue.length} gifts`
                    : "A gift for you"}
                </p>
              </div>
            </div>

            {queue.length > 1 ? (
              <div className="mr-1 flex items-center gap-1" aria-label={`${queue.length} gifts waiting`}>
                {queue.slice(0, 5).map((gift, index) => (
                  <span
                    key={gift.id}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      index === 0 ? "w-5 bg-white/85" : "w-1.5 bg-white/25",
                    )}
                  />
                ))}
                {queue.length > 5 ? (
                  <span className="ml-0.5 text-[10px] font-bold text-white/45">
                    +{queue.length - 5}
                  </span>
                ) : null}
              </div>
            ) : null}
          </header>

          <main className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 [-webkit-overflow-scrolling:touch]">
            <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center pb-5 pt-1 text-center">
              <div className="gift-receive-sender flex max-w-full items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 backdrop-blur-xl">
                {current.anonymous || !current.sender ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Heart className="h-3.5 w-3.5 text-rose-300" />
                  </span>
                ) : (
                  <Avatar className="h-7 w-7 ring-1 ring-white/20">
                    <AvatarImage src={current.sender.avatar_url || undefined} alt="" />
                    <AvatarFallback className="bg-white/10 text-[10px] font-bold text-white">
                      {senderInitial}
                    </AvatarFallback>
                  </Avatar>
                )}
                <p className="min-w-0 truncate text-[12px] font-semibold text-white/75">
                  <span className="text-white">{senderName}</span>
                  {senderHandle ? <span className="text-white/45"> · {senderHandle}</span> : null}
                  <span className="text-white/55"> sent you a gift</span>
                </p>
              </div>

              <div className="relative mt-5 flex h-[210px] w-[210px] items-center justify-center sm:h-[250px] sm:w-[250px]">
                <span
                  aria-hidden
                  className="gift-receive-halo absolute inset-[-10%] rounded-full blur-2xl"
                  style={{
                    background: `radial-gradient(circle, ${palette.accent || palette.primary}5c, ${palette.primary}26 46%, transparent 70%)`,
                  }}
                />
                <span
                  aria-hidden
                  className="gift-receive-ring absolute inset-[4%] rounded-full border"
                  style={{ borderColor: `${palette.accent || "#fff"}52` }}
                />
                <span
                  aria-hidden
                  className="gift-receive-ring gift-receive-ring-late absolute inset-[-3%] rounded-full border"
                  style={{ borderColor: `${palette.primary}40` }}
                />
                <span
                  aria-hidden
                  className="gift-receive-rays absolute inset-[-24%] rounded-full opacity-60"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 0deg, ${palette.accent || "#fff"}24 16deg, transparent 32deg, transparent 90deg, ${palette.primary}1f 112deg, transparent 138deg, transparent 210deg, ${palette.secondary}20 236deg, transparent 260deg, transparent 330deg, ${palette.accent || "#fff"}18 348deg, transparent 360deg)`,
                  }}
                />
                <span
                  aria-hidden
                  className="gift-receive-pedestal absolute bottom-[6%] h-[16%] w-[68%] rounded-[50%] blur-xl"
                  style={{ background: `${palette.primary}52` }}
                />

                <GiftArtwork
                  key={current.id}
                  art={current.art}
                  title={current.name}
                  className="gift-receive-art relative z-10 h-[78%] w-[78%] drop-shadow-[0_30px_55px_rgba(0,0,0,0.7)]"
                />

                <span className="gift-receive-spark absolute left-[8%] top-[18%] h-1.5 w-1.5 rounded-full bg-white" />
                <span className="gift-receive-spark gift-receive-spark-2 absolute right-[10%] top-[32%] h-1 w-1 rounded-full bg-white" />
                <span className="gift-receive-spark gift-receive-spark-3 absolute bottom-[20%] left-[19%] h-1.5 w-1.5 rounded-full bg-white" />
              </div>

              <div className="gift-receive-copy relative mt-2 w-full">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
                  {current.anonymous ? "Someone special" : "A gift, just for you"}
                </p>
                <h2
                  className="mt-1.5 text-[30px] font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-[34px]"
                  style={{
                    textShadow: `0 0 44px ${palette.primary}55`,
                  }}
                >
                  {current.name}
                </h2>

                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold capitalize text-white/70 backdrop-blur">
                    <Star className="mr-1 inline h-3 w-3" style={{ color: palette.accent || palette.primary }} />
                    {current.rarity}
                  </span>
                  {current.cost ? (
                    <span className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold text-white/70 backdrop-blur">
                      <Coins className="mr-1 inline h-3 w-3 text-amber-300" />
                      {current.cost.toLocaleString()} coins
                    </span>
                  ) : null}
                  {current.useLabel ? (
                    <span className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold text-white/70 backdrop-blur">
                      {current.useLabel}
                    </span>
                  ) : null}
                  {current.coinValue && current.coinValue > 0 ? (
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-100/80 backdrop-blur">
                      Convert later for {current.coinValue.toLocaleString()} coins
                    </span>
                  ) : null}
                  {current.anonymous ? (
                    <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-2.5 py-1 text-[10px] font-bold text-rose-200/80">
                      Anonymous
                    </span>
                  ) : null}
                </div>

                {current.effect ? (
                  <p className="mx-auto mt-3 max-w-sm text-[11px] leading-relaxed text-white/55">
                    {current.effect}
                  </p>
                ) : null}

                {current.message ? (
                  <blockquote className="gift-receive-message mx-auto mt-4 max-w-sm rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-[13px] italic leading-relaxed text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
                    “{current.message}”
                  </blockquote>
                ) : (
                  <p className="mx-auto mt-4 max-w-xs text-[12px] leading-relaxed text-white/40">
                    {current.anonymous
                      ? "They chose to keep their name a secret. The thought still counts."
                      : "No note this time — the gift says enough."}
                  </p>
                )}
              </div>
            </div>
          </main>

          <footer className="relative z-20 shrink-0 px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-[26px] border border-white/12 bg-black/55 p-3.5 shadow-[0_-24px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
              <div
                aria-hidden
                className="absolute inset-x-10 top-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${palette.accent || palette.primary}, transparent)`,
                }}
              />

              {settled ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="gift-receive-success flex min-h-[104px] flex-col items-center justify-center py-2 text-center"
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border",
                      phase === "accepted"
                        ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                        : "border-white/15 bg-white/10 text-white/75",
                    )}
                  >
                    {phase === "accepted" ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Heart className="h-5 w-5" />
                    )}
                  </span>
                  <p className="mt-2 text-sm font-black text-white">
                    {phase === "accepted" ? "It's yours" : "Gift returned"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    {phase === "accepted"
                      ? current.coinValue && current.coinValue > 0
                        ? `Added to your account. Convert it for ${current.coinValue.toLocaleString()} coins anytime in Wallet.`
                        : "Added to your account. Enjoy it."
                      : "The sender has been refunded."}
                  </p>
                </div>
              ) : (
                <>
                  {error ? (
                    <p
                      role="alert"
                      className="mb-2.5 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-snug text-rose-100"
                    >
                      {error}
                    </p>
                  ) : null}

                  {thanked ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mb-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold text-emerald-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Thank-you sent
                    </div>
                  ) : null}

                  {replyOpen ? (
                    <div className="space-y-2">
                      <Textarea
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder={`Say thanks to ${senderName}…`}
                        rows={2}
                        maxLength={280}
                        autoFocus
                        className="min-h-[62px] resize-none rounded-xl border-white/15 bg-white/[0.07] text-[12px] text-white placeholder:text-white/35 focus-visible:ring-white/30"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault()
                            void sendReply()
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          className="h-9 flex-1 rounded-xl text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
                          onClick={() => {
                            setReplyOpen(false)
                            setReply("")
                            setError(null)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="h-9 flex-[1.4] rounded-xl bg-white text-[11px] font-black text-black hover:bg-white/90"
                          onClick={() => void sendReply()}
                          disabled={sendingReply || !reply.trim()}
                        >
                          {sendingReply ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Send thank-you
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-stretch gap-2">
                        <Button
                          variant="outline"
                          className="h-12 flex-1 rounded-2xl border-white/15 bg-white/[0.04] text-[12px] font-bold text-white/60 hover:border-white/25 hover:bg-white/10 hover:text-white"
                          onClick={() => void runAction("decline")}
                          disabled={phase !== "idle"}
                        >
                          {phase === "declining" ? <Spinner className="h-4 w-4" /> : null}
                          Decline
                        </Button>
                        <Button
                          className="h-12 flex-[1.55] rounded-2xl border border-white/15 text-[13px] font-black text-black shadow-[0_16px_45px_-16px_rgba(255,255,255,0.7)] hover:brightness-105"
                          style={{
                            background: `linear-gradient(135deg, #ffffff, ${palette.accent || "#fde68a"})`,
                          }}
                          onClick={() => void runAction("accept")}
                          disabled={phase !== "idle"}
                        >
                          {phase === "accepting" ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Gift className="h-4 w-4" />
                          )}
                          Accept gift
                        </Button>
                      </div>

                      <div className="mt-2 flex items-center justify-center">
                        {current.anonymous ? (
                          <p className="flex items-center gap-1.5 text-[10px] font-medium text-white/35">
                            <MessageCircle className="h-3 w-3" />
                            You can still accept or decline an anonymous gift.
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReplyOpen(true)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-white/55 transition hover:bg-white/10 hover:text-white"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            {thanked ? "Send another thank-you" : "Say thank-you"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {queue.length > 1 ? (
                <p className="mt-2 text-center text-[10px] font-medium text-white/30">
                  {queue.length - 1} more gift{queue.length - 1 === 1 ? "" : "s"} waiting
                </p>
              ) : null}
            </div>
          </footer>
        </div>

        <style jsx global>{`
          @keyframes gift-receive-shell-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes gift-receive-orb-in {
            0% { opacity: 0; transform: scale(0.72); }
            55% { opacity: 0.9; }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes gift-receive-art-bloom {
            0% { opacity: 0; transform: scale(0.58) rotate(-7deg); filter: blur(14px); }
            55% { opacity: 1; transform: scale(1.055) rotate(1.5deg); filter: blur(0); }
            100% { opacity: 1; transform: scale(1) rotate(0deg); }
          }
          @keyframes gift-receive-float {
            0%, 100% { transform: translateY(0) rotate(-1.2deg); }
            50% { transform: translateY(-12px) rotate(1.2deg); }
          }
          @keyframes gift-receive-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes gift-receive-ring-pulse {
            0% { transform: scale(0.72); opacity: 0.8; }
            100% { transform: scale(1.52); opacity: 0; }
          }
          @keyframes gift-receive-halo {
            0%, 100% { opacity: 0.6; transform: scale(0.94); }
            50% { opacity: 1; transform: scale(1.06); }
          }
          @keyframes gift-receive-copy-in {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes gift-receive-card-in {
            0% { opacity: 0; transform: translateY(30px) scale(0.97); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes gift-receive-success-in {
            0% { opacity: 0; transform: scale(0.9); }
            60% { transform: scale(1.04); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes gift-receive-spark {
            0% { opacity: 0; transform: translateY(8px) scale(0.5); }
            35% { opacity: 0.9; }
            100% { opacity: 0; transform: translateY(-28px) scale(1.2); }
          }
          @keyframes gift-receive-petal {
            0% { opacity: 0; transform: translate3d(0, 0, 0) rotate(0deg); }
            18% { opacity: 0.7; }
            100% { opacity: 0; transform: translate3d(18px, -108vh, 0) rotate(160deg); }
          }
          .gift-receive-shell { animation: gift-receive-shell-in 380ms ease-out both; }
          .gift-receive-orb { animation: gift-receive-orb-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .gift-receive-art { animation: gift-receive-art-bloom 900ms 80ms cubic-bezier(0.16, 1, 0.3, 1) both, gift-receive-float 4.2s 1s ease-in-out infinite; }
          .gift-receive-halo { animation: gift-receive-halo 4.6s ease-in-out infinite; }
          .gift-receive-rays { animation: gift-receive-spin 22s linear infinite; }
          .gift-receive-ring { animation: gift-receive-ring-pulse 3s ease-out infinite; }
          .gift-receive-ring-late { animation-delay: 1.5s; }
          .gift-receive-sender { animation: gift-receive-copy-in 520ms 180ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .gift-receive-copy { animation: gift-receive-copy-in 620ms 300ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .gift-receive-message { animation: gift-receive-copy-in 620ms 440ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          footer > div { animation: gift-receive-card-in 700ms 520ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .gift-receive-success { animation: gift-receive-success-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .gift-receive-spark { animation: gift-receive-spark 2.4s ease-out infinite; }
          .gift-receive-spark-2 { animation-delay: 0.7s; }
          .gift-receive-spark-3 { animation-delay: 1.4s; }
          .gift-receive-petal {
            animation: gift-receive-petal var(--receive-duration, 6s) linear var(--receive-delay, 0s) infinite;
          }
          .gift-receive-grain {
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.8'/%3E%3C/svg%3E");
          }

          @media (prefers-reduced-motion: reduce) {
            .gift-receive-shell,
            .gift-receive-orb,
            .gift-receive-art,
            .gift-receive-halo,
            .gift-receive-rays,
            .gift-receive-ring,
            .gift-receive-sender,
            .gift-receive-copy,
            .gift-receive-message,
            footer > div,
            .gift-receive-success,
            .gift-receive-spark,
            .gift-receive-petal {
              animation: none !important;
            }
          }
          html.loop-reduced-motion .gift-receive-shell,
          html.loop-reduced-motion .gift-receive-orb,
          html.loop-reduced-motion .gift-receive-art,
          html.loop-reduced-motion .gift-receive-halo,
          html.loop-reduced-motion .gift-receive-rays,
          html.loop-reduced-motion .gift-receive-ring,
          html.loop-reduced-motion .gift-receive-sender,
          html.loop-reduced-motion .gift-receive-copy,
          html.loop-reduced-motion .gift-receive-message,
          html.loop-reduced-motion footer > div,
          html.loop-reduced-motion .gift-receive-success,
          html.loop-reduced-motion .gift-receive-spark,
          html.loop-reduced-motion .gift-receive-petal {
            animation: none !important;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
