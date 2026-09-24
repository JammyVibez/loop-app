"use client"

import { ProtectedMedia } from "@/components/media-protection"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, BadgeCheck, Megaphone } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

export interface AdData {
  id: string
  sponsor_name: string
  headline: string
  description?: string | null
  media_url?: string | null
  media_type?: string | null
  link_url: string
}

interface AdCardProps {
  ad: AdData
  sessionId?: string
  className?: string
  /**
   * Admin previews render the exact same unit but must not count as an
   * impression or a click — otherwise typing a headline in the composer would
   * inflate the campaign's own stats.
   */
  preview?: boolean
}

/** "https://sponsor.example/offer?utm=…" → "sponsor.example" */
function prettyHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "AD"
  )
}

/**
 * Deterministic accent for a sponsor, so the branded fallback panel (used when
 * a creative has no image) still feels designed rather than empty. Same
 * sponsor always gets the same hue, and the pair is picked to stay legible on
 * both light and dark surfaces.
 */
const ACCENTS = [
  { from: "from-cyan-500/15", to: "to-indigo-500/15", text: "text-cyan-600 dark:text-cyan-300", ring: "ring-cyan-500/25" },
  { from: "from-emerald-500/15", to: "to-teal-500/15", text: "text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-500/25" },
  { from: "from-amber-500/15", to: "to-orange-500/15", text: "text-amber-600 dark:text-amber-300", ring: "ring-amber-500/25" },
  { from: "from-violet-500/15", to: "to-fuchsia-500/15", text: "text-violet-600 dark:text-violet-300", ring: "ring-violet-500/25" },
  { from: "from-rose-500/15", to: "to-pink-500/15", text: "text-rose-600 dark:text-rose-300", ring: "ring-rose-500/25" },
]

function accentFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
}

/**
 * Sponsored post.
 *
 * A sibling of the organic loop card rather than a glossy banner: same
 * surface/border/radius tokens, same rhythm, labelled "Sponsored" in the
 * header and by the "Ad" chip. The one thing it adds is a branded panel when
 * no creative is attached, because an ad row that collapses to a line of text
 * reads as a rendering bug.
 */
export function AdCard({ ad, sessionId, className, preview = false }: AdCardProps) {
  const { user } = useAuth()
  const trackedRef = useRef(false)
  const [clicked, setClicked] = useState(false)

  // Record one impression per ad per session — never on every re-render.
  useEffect(() => {
    if (preview || trackedRef.current) return
    trackedRef.current = true
    const sid = sessionId || `${user?.id || "guest"}:${ad.id}`
    void fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: ad.id, action: "impression", session_id: sid }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad.id, preview])

  const handleClick = () => {
    if (preview || clicked) return
    setClicked(true)
    void fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: ad.id, action: "click" }),
    }).catch(() => {})
  }

  const isVideo = ad.media_type === "video" || Boolean(ad.media_url?.match(/\.(mp4|webm|m3u8)(\?|$)/i))
  const host = prettyHost(ad.link_url)
  const accent = accentFor(ad.sponsor_name || ad.headline)
  const brand = initials(ad.sponsor_name)

  const creative = ad.media_url ? (
    isVideo ? (
      <ProtectedMedia type="video" src={ad.media_url} className="aspect-video w-full" showControls={false} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ad.media_url}
        alt=""
        loading="lazy"
        className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
    )
  ) : (
    <div
      className={cn(
        "relative flex aspect-[16/9] w-full items-end overflow-hidden bg-gradient-to-br p-4 ring-1 ring-inset",
        accent.from,
        accent.to,
        accent.ring,
      )}
    >
      {/* Faint monogram watermark keeps an image-less ad from looking empty. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-2 -top-6 select-none text-[7rem] font-black leading-none opacity-[0.07]",
          accent.text,
        )}
      >
        {brand}
      </span>
      <div className="relative">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-semibold backdrop-blur",
            accent.text,
          )}
        >
          <Megaphone className="h-3 w-3" />
          {host || ad.sponsor_name}
        </span>
      </div>
    </div>
  )

  const inner = (
    <>
      <div className="relative overflow-hidden border-y border-border bg-muted/40">{creative}</div>

      <div className="space-y-1.5 px-4 pb-4 pt-3.5">
        <h4 className="text-[15px] font-semibold leading-snug tracking-[-0.011em] text-foreground transition-colors group-hover:text-primary">
          {ad.headline}
        </h4>
        {ad.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{ad.description}</p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2.5">
          <span className="truncate text-[11px] text-muted-foreground/80">{host || ad.sponsor_name}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all group-hover:gap-1.5 group-hover:opacity-95">
            Learn more
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </>
  )

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card shadow-tiny",
        "transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-low",
        className,
      )}
    >
      {/* ── Sponsor header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold tracking-tight ring-1 ring-inset",
            accent.from,
            accent.to,
            accent.ring,
            accent.text,
          )}
          aria-hidden="true"
        >
          {brand}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold leading-tight text-foreground">
            {ad.sponsor_name}
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
          </p>
          <p className="flex items-center gap-1 truncate text-[11px] leading-tight text-muted-foreground">
            <Megaphone className="h-3 w-3 shrink-0" />
            Sponsored
            {host && <span className="truncate">· {host}</span>}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ad
        </span>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {preview ? (
        <div className="mt-3" aria-hidden="true">{inner}</div>
      ) : (
        <a
          href={ad.link_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="mt-3 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Sponsored: ${ad.headline} — ${ad.sponsor_name}`}
        >
          {inner}
        </a>
      )}
    </article>
  )
}
