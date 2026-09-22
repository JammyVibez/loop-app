"use client"

/**
 * Profile frames — the live browser.
 *
 * Frames used to live behind a button in Settings, which meant the one place
 * that sells cosmetics did not sell frames. This panel is the single
 * implementation of the whole frames experience (fetch, acquire, equip) and is
 * rendered straight into the shop's "Profile frames" shelf; the dialog wrapper
 * in `pfp-frames-browser.tsx` reuses it so there is only one behaviour to keep
 * correct.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Crown, Frame, Lock, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Spinner } from "@/components/ui/skeletons"
import { cn } from "@/lib/utils"

export interface PfpFrame {
  id: string | number
  name: string
  description: string | null
  image_url: string
  is_premium: boolean
  price_coins: number
  sort_order: number
  owned?: boolean
  equipped?: boolean
}

/** The sentinel row the legacy UI used for "no frame". */
function isNoneFrame(frame: PfpFrame) {
  return frame.name.trim().toLowerCase() === "none"
}

/* ── Frame art ───────────────────────────────────────────────────────── */

/** Hand-tuned rings for the frames that shipped with names. */
const NAMED_GRADIENTS: Record<string, [string[], string]> = {
  golden: [["#ffd700", "#ffaa00", "#ffd700"], "#ffd700"],
  "neon glow": [["#00ff88", "#00ccff", "#ff00ff"], "#00ff88"],
  "pixel art": [["#ff6b6b", "#4ecdc4", "#45b7d1"], "#4ecdc4"],
  galaxy: [["#667eea", "#764ba2", "#6b8dd6"], "#667eea"],
  fire: [["#ff4500", "#ff8c00", "#ffd700"], "#ff4500"],
  diamond: [["#b9f2ff", "#e0f7fa", "#80deea"], "#b9f2ff"],
  rainbow: [["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"], "#ff0000"],
  galactic: [["#0f0c29", "#302b63", "#24243e"], "#7c3aed"],
  cyber: [["#00f0ff", "#0080ff", "#00f0ff"], "#00f0ff"],
  frost: [["#e3f2fd", "#bbdefb", "#90caf9"], "#90caf9"],
  dragon: [["#8b0000", "#ff4500", "#8b0000"], "#ff4500"],
}

/**
 * A ring for every other frame name too, derived from the name itself, so a
 * newly added frame is never an invisible tile with a broken image icon.
 */
function gradientFor(name: string): [string[], string] {
  const known = NAMED_GRADIENTS[name.trim().toLowerCase()]
  if (known) return known

  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360
  const hue = hash
  const stops = [hue, (hue + 42) % 360, (hue + 84) % 360].map((h) => hsl(h, 82, 64))
  return [stops, hsl(hue, 88, 58)]
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h} ${s}% ${l}%)`
}

/** A gradient ring drawn as an SVG so it scales cleanly at any tile size. */
function FrameRing({ name, id, size, className }: { name: string; id: string | number; size: number; className?: string }) {
  const [stops, glow] = gradientFor(name)
  const gradientId = `pfp-grad-${id}`
  const glowId = `pfp-glow-${id}`
  const stroke = Math.max(2.5, size * 0.075)
  const radius = size / 2

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          {stops.map((color, index) => (
            <stop key={index} offset={`${(index / (stops.length - 1)) * 100}%`} stopColor={color} />
          ))}
        </linearGradient>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation={size * 0.035} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle
        cx={radius}
        cy={radius}
        r={radius - stroke / 2}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        filter={`url(#${glowId})`}
        opacity={0.92}
      />
    </svg>
  )
}

/** The ring (or uploaded art) over a neutral avatar disc. */
function FrameDisc({ frame, size }: { frame: PfpFrame; size: number }) {
  return (
    <span className="relative block" style={{ width: size, height: size }}>
      <span className="absolute inset-[8%] flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-muted to-muted/40">
        <UserRound className="h-1/3 w-1/3 text-muted-foreground/70" aria-hidden />
      </span>
      <FrameRing name={frame.name} id={frame.id} size={size} />
      {frame.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frame.image_url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
    </span>
  )
}

/* ── Data ────────────────────────────────────────────────────────────── */

interface FramesState {
  frames: PfpFrame[]
  coins: number
  loading: boolean
  error: string | null
  acquiring: string | number | null
  equipping: string | number | null
  reload: () => Promise<void>
  acquire: (frame: PfpFrame) => Promise<void>
  equip: (frame: PfpFrame) => Promise<void>
  unequip: (frame: PfpFrame) => Promise<void>
}

/** Fetch + mutate the frames catalogue. Shared by the shelf and the dialog. */
export function usePfpFrames(enabled = true): FramesState {
  const { toast } = useToast()
  const { getAuthHeader, refreshUser } = useAuth()
  const [frames, setFrames] = useState<PfpFrame[]>([])
  const [coins, setCoins] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acquiring, setAcquiring] = useState<string | number | null>(null)
  const [equipping, setEquipping] = useState<string | number | null>(null)

  const reload = useCallback(async () => {
    const headers = getAuthHeader()
    if (!headers.Authorization) {
      setLoading(false)
      setError("Sign in to collect frames.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/user/pfp-frames", { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load frames")
      setFrames(Array.isArray(data.frames) ? data.frames : [])
      setCoins(Number(data.coins) || 0)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load frames")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    if (!enabled) return
    void reload()
  }, [enabled, reload])

  const act = useCallback(
    async (frame: PfpFrame, action: "acquire" | "equip" | "unequip") => {
      const headers = getAuthHeader()
      if (!headers.Authorization) return
      const res = await fetch("/api/user/pfp-frames", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ frame_id: frame.id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "That didn't go through")
      return data
    },
    [getAuthHeader],
  )

  const acquire = useCallback(
    async (frame: PfpFrame) => {
      setAcquiring(frame.id)
      try {
        await act(frame, "acquire")
        toast({ title: "Frame acquired", description: `${frame.name} is yours.` })
        await refreshUser?.()
        await reload()
      } catch (cause) {
        toast({
          title: "Couldn't get this frame",
          description: cause instanceof Error ? cause.message : "Try again in a moment.",
          variant: "destructive",
        })
      } finally {
        setAcquiring(null)
      }
    },
    [act, reload, refreshUser, toast],
  )

  const equip = useCallback(
    async (frame: PfpFrame) => {
      setEquipping(frame.id)
      try {
        await act(frame, "equip")
        toast({ title: "Frame equipped" })
        await reload()
      } catch (cause) {
        toast({
          title: "Couldn't equip frame",
          description: cause instanceof Error ? cause.message : "Try again in a moment.",
          variant: "destructive",
        })
      } finally {
        setEquipping(null)
      }
    },
    [act, reload, toast],
  )

  const unequip = useCallback(
    async (frame: PfpFrame) => {
      setEquipping(frame.id)
      try {
        await act(frame, "unequip")
        toast({ title: "Frame removed" })
        await reload()
      } catch (cause) {
        toast({
          title: "Couldn't remove frame",
          description: cause instanceof Error ? cause.message : "Try again in a moment.",
          variant: "destructive",
        })
      } finally {
        setEquipping(null)
      }
    },
    [act, reload, toast],
  )

  return { frames, coins, loading, error, acquiring, equipping, reload, acquire, equip, unequip }
}

/* ── Panel ───────────────────────────────────────────────────────────── */

export interface ProfileFramesPanelProps {
  className?: string
  /** Tighter chrome for the dialog wrapper. */
  compact?: boolean
  /** Only frames the viewer already owns — the inventory's view. */
  ownedOnly?: boolean
  avatarUrl?: string | null
  onFrameEquipped?: (frameId: string | number | null) => void
}

export function ProfileFramesPanel({
  className,
  compact = false,
  ownedOnly = false,
  avatarUrl,
  onFrameEquipped,
}: ProfileFramesPanelProps) {
  const { frames, coins, loading, error, acquiring, equipping, reload, acquire, equip, unequip } = usePfpFrames()
  const [selectedId, setSelectedId] = useState<string | number | "none" | null>(null)

  // Real frames only — the legacy "None" row is expressed by the None tile —
  // and, in the inventory, only the ones this viewer actually owns.
  const available = useMemo(
    () => frames.filter((frame) => !isNoneFrame(frame) && (!ownedOnly || frame.owned)),
    [frames, ownedOnly],
  )
  const equipped = useMemo(() => available.find((frame) => frame.equipped) || null, [available])

  const selected = useMemo(() => {
    if (selectedId === "none") return null
    if (selectedId === null) return equipped || available[0] || null
    return available.find((frame) => frame.id === selectedId) || null
  }, [selectedId, available, equipped])

  const selectingNone = selectedId === "none"

  const tile = (frame: PfpFrame) => {
    const active = selected?.id === frame.id && !selectingNone
    return (
      <button
        key={frame.id}
        type="button"
        onClick={() => setSelectedId(frame.id)}
        aria-pressed={active}
        className={cn(
          "group relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors",
          active
            ? "border-violet-500/60 bg-violet-500/10"
            : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/40",
        )}
      >
        <FrameDisc frame={frame} size={compact ? 56 : 64} />

        {frame.equipped ? (
          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500">
            <Check className="h-2.5 w-2.5 text-white" aria-hidden />
          </span>
        ) : frame.is_premium && !frame.owned ? (
          <span className="absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500">
            <Crown className="h-2.5 w-2.5 text-white" aria-hidden />
          </span>
        ) : null}

        <span className="line-clamp-1 w-full text-[11px] font-medium text-foreground">{frame.name}</span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {frame.equipped ? "Equipped" : frame.owned ? "Owned" : frame.price_coins > 0 ? `${frame.price_coins.toLocaleString()} coins` : "Free"}
        </span>
      </button>
    )
  }

  if (loading) {
    return (
      <div className={cn("grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6", className)} aria-busy>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <span className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <span className="h-2.5 w-14 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    const signedOut = error.toLowerCase().includes("sign in")
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-6 text-center", className)}>
        <Lock className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">{error}</p>
        {signedOut ? (
          <Link
            href="/auth?returnTo=%2Fshop"
            className="mt-3 inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Sign in
          </Link>
        ) : (
          <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => void reload()}>
            Try again
          </Button>
        )}
      </div>
    )
  }

  if (available.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-8 text-center", className)}>
        <Frame className="mx-auto h-5 w-5 text-violet-500" aria-hidden />
        <p className="mt-2 text-sm font-semibold text-foreground">
          {ownedOnly ? "You don't own a frame yet" : "No frames on the rack yet"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {ownedOnly
            ? "Frames you collect live here, ready to equip on your avatar."
            : "Frames are added here as they are released. Everything else in the shop is ready to wear in the meantime."}
        </p>
        {ownedOnly ? (
          <Link
            href="/shop?category=frames"
            className="mt-3 inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Browse frames in the shop
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Stage: the selected frame on a real avatar, plus the one action. */}
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0">
            <div className="h-full w-full overflow-hidden rounded-full bg-muted">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                  L
                </span>
              )}
            </div>
            {selected ? <FrameRing name={selected.name} id={`stage-${selected.id}`} size={96} /> : null}
            {selected?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.image_url}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            ) : null}
          </div>

          <div className="min-w-0 sm:hidden">
            <p className="truncate text-sm font-semibold text-foreground">{selected ? selected.name : "No frame"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selected ? framePriceLabel(selected) : "Your avatar, unadorned."}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="hidden sm:block">
            <p className="truncate text-sm font-semibold text-foreground">{selected ? selected.name : "No frame"}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {selected?.description || (selected ? framePriceLabel(selected) : "Your avatar, unadorned.")}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-500">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              {coins.toLocaleString()} coins
            </span>

            {selectingNone || !selected ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={!equipped || equipping !== null}
                onClick={() => {
                  if (!equipped) return
                  void unequip(equipped).then(() => onFrameEquipped?.(null))
                }}
              >
                {equipping !== null ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : null}
                Remove frame
              </Button>
            ) : selected.equipped ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={equipping !== null}
                onClick={() => void unequip(selected).then(() => onFrameEquipped?.(null))}
              >
                {equipping === selected.id ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                Unequip
              </Button>
            ) : selected.owned ? (
              <Button
                size="sm"
                className="rounded-full"
                disabled={equipping !== null}
                onClick={() => void equip(selected).then(() => onFrameEquipped?.(selected.id))}
              >
                {equipping === selected.id ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : null}
                Equip frame
              </Button>
            ) : (
              <Button
                size="sm"
                className="rounded-full"
                disabled={acquiring !== null || coins < selected.price_coins}
                onClick={() => void acquire(selected).then(() => onFrameEquipped?.(selected.id))}
              >
                {acquiring === selected.id ? (
                  <Spinner className="mr-1.5 h-3.5 w-3.5" />
                ) : selected.price_coins > 0 ? (
                  <Crown className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Frame className="mr-1.5 h-3.5 w-3.5" />
                )}
                {selected.price_coins > 0 ? `Get for ${selected.price_coins.toLocaleString()}` : "Get free"}
              </Button>
            )}
          </div>

          {selected && !selected.owned && coins < selected.price_coins ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              You need {(selected.price_coins - coins).toLocaleString()} more coins — quests pay out daily.
            </p>
          ) : null}
        </div>
      </div>

      {/* The rack */}
      <div className={cn("grid gap-3", compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6")}>
        <button
          type="button"
          onClick={() => setSelectedId("none")}
          aria-pressed={selectingNone}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors",
            selectingNone
              ? "border-violet-500/60 bg-violet-500/10"
              : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/40",
          )}
        >
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border">
            <UserRound className="h-6 w-6 text-muted-foreground/60" aria-hidden />
          </span>
          <span className="text-[11px] font-medium text-foreground">No frame</span>
          <span className="text-[10px] font-medium text-muted-foreground">{equipped ? "Wear nothing" : "Active"}</span>
        </button>

        {available.map(tile)}
      </div>
    </div>
  )
}

function framePriceLabel(frame: PfpFrame) {
  if (frame.owned) return frame.equipped ? "Equipped on your profile." : "In your collection."
  if (frame.price_coins > 0) return `${frame.price_coins.toLocaleString()} coins, yours for good.`
  return "Free to collect."
}
