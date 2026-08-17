"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Pencil, Trash2, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MomentCardMoment {
  id: string
  user_id: string
  media_url?: string | null
  media_type?: string | null
  content?: string | null
  created_at?: string | null
  expires_at?: string | null
}

export interface MomentCardAuthor {
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  is_verified?: boolean | null
  is_premium?: boolean | null
}

interface MomentCardProps {
  moment: MomentCardMoment
  author?: MomentCardAuthor | null
  isMine?: boolean
  /** Total lifetime in hours (24 or 48). Defaults to 24. */
  durationHours?: number
  onEdit?: (content: string) => void
  onDelete?: () => void
  className?: string
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "Expired"
  const totalMinutes = Math.max(1, Math.floor(msLeft / 60000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|$)/i.test(url)
}

/**
 * MomentCard — the ephemeral story-style card for 24–48h Moments.
 *
 * Deliberately NOT a Loop card: dashed "fading" borders, a ticking countdown
 * with a shrinking life bar, and an amber/rose "now-or-never" palette so a
 * moment reads as temporary at a glance.
 */
export function MomentCard({
  moment,
  author,
  isMine = false,
  durationHours = 24,
  onEdit,
  onDelete,
  className,
}: MomentCardProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const expiresAt = useMemo(() => (moment.expires_at ? new Date(moment.expires_at).getTime() : null), [moment.expires_at])
  const createdAt = useMemo(
    () => (moment.created_at ? new Date(moment.created_at).getTime() : null),
    [moment.created_at],
  )
  const lifeMs = durationHours * 60 * 60 * 1000
  const elapsedMs = createdAt ? Math.max(0, now - createdAt) : 0
  const remainingMs = expiresAt ? Math.max(0, expiresAt - now) : Math.max(0, lifeMs - elapsedMs)
  const lifeLeft = lifeMs > 0 ? Math.max(0, Math.min(1, remainingMs / lifeMs)) : 0
  const expired = remainingMs <= 0

  const displayName = author?.display_name || author?.username || "User"
  const mediaUrl = moment.media_url || ""
  const isVideo = isVideoUrl(mediaUrl) || moment.media_type === "video"

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border border-dashed border-amber-500/30 bg-card/60 shadow-[0_8px_30px_rgba(251,191,36,0.06)]",
        "transition-all duration-300 hover:border-amber-500/50 hover:shadow-[0_8px_36px_rgba(251,191,36,0.12)]",
        expired && "opacity-60",
        className,
      )}
    >
      {/* Fading corner accent — the "disappearing" motif */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-amber-500/15 to-transparent blur-2xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

      {/* Header */}
      <header className="flex items-center gap-2.5 px-3.5 py-3">
        <span className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
          <span className="block rounded-full bg-background p-[2px]">
            <Avatar className="h-9 w-9">
              <AvatarImage src={author?.avatar_url || undefined} />
              <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold leading-tight">
            <span className="truncate">{displayName}</span>
            {author?.is_verified && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-400 text-[10px] font-bold text-white">
                ✓
              </span>
            )}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Zap className="h-3 w-3 text-amber-500" />
            Moment · {formatCountdown(remainingMs)} left
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 rounded-full border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400",
            expired && "border-red-500/40 text-red-500",
          )}
        >
          {expired ? "Expired" : `${durationHours}h`}
        </Badge>
      </header>

      {/* Life bar — shrinks in real time */}
      <div className="h-1 w-full bg-muted">
        <div
          className={cn(
            "h-full transition-[width] duration-1000 ease-linear",
            expired
              ? "bg-red-500"
              : lifeLeft < 0.25
                ? "bg-gradient-to-r from-rose-500 to-red-500"
                : "bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500",
          )}
          style={{ width: `${Math.max(0, lifeLeft * 100)}%` }}
        />
      </div>

      {/* Media */}
      {mediaUrl && (
        <div className="relative mx-3.5 mt-3.5 overflow-hidden rounded-2xl border border-amber-500/20 bg-black">
          {isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={mediaUrl}
              className="max-h-[55vh] w-full object-contain"
              controls
              autoPlay
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt="Moment"
              className="max-h-[55vh] w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          )}
          <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-amber-300 backdrop-blur">
            <Zap className="h-3 w-3" />
            Disappears soon
          </span>
        </div>
      )}

      {/* Content */}
      {moment.content && (
        <div className="px-4 py-3">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{moment.content}</p>
        </div>
      )}

      {/* Footer */}
      <footer className="flex items-center justify-between gap-2 border-t border-dashed border-border/70 bg-muted/30 px-3.5 py-2.5">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          {expired ? "This moment has vanished" : "Gone forever in " + formatCountdown(remainingMs)}
        </p>
        {isMine && (
          <div className="flex shrink-0 gap-1.5">
            {onEdit && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onEdit(moment.content || "")}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </footer>
    </article>
  )
}

/** Small inline loading/empty states used around moments. */
export function MomentLoading() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading moment…
    </div>
  )
}

export function MomentGone() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <span className="text-4xl">⏳</span>
      <h1 className="text-lg font-bold">Moment gone</h1>
      <p className="text-sm text-muted-foreground">This moment expired or was deleted. That&apos;s the point — moments are ephemeral.</p>
    </div>
  )
}
