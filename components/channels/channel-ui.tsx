"use client"

import { useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, Info } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Channel screens are deliberately their own dark surface.
 *
 * The reference is an entertainment guide: near-black canvas, full-bleed
 * artwork and white pill actions. Keeping that palette local (instead of
 * inheriting the app theme) means the guide reads the same in light mode as it
 * does at midnight — exactly like a TV app should.
 */

const POSTER_HUES = [258, 202, 12, 332, 158, 36]

function hueFor(name: string): number {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360
  }
  return POSTER_HUES[hash % POSTER_HUES.length] + (hash % 18)
}

/** Deterministic artwork backdrop so a title always looks the same. */
export function posterStyle(name: string): CSSProperties {
  const hue = hueFor(name || "channel")
  return {
    backgroundImage: `radial-gradient(120% 90% at 12% 0%, hsl(${hue} 62% 26% / 0.95), transparent 62%), radial-gradient(100% 80% at 100% 100%, hsl(${(hue + 44) % 360} 58% 18% / 0.9), transparent 60%), linear-gradient(160deg, #16161c 0%, #0b0b0e 100%)`,
  }
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

export function ChannelScreen({
  title,
  backHref = "/channels",
  action,
  children,
}: {
  title: ReactNode
  backHref?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#08090a] text-white">
      <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#08090a]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
          <Link
            href={backHref}
            aria-label="Back"
            className="-ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight">{title}</h1>
          {action}
        </div>
      </div>
      {children}
    </div>
  )
}

/**
 * Artwork tile for a channel logo or novel cover.
 * Falls back to a deterministic gradient + initials when the provider image is
 * missing or blocked by its host, so a card never renders as a broken image.
 */
export function ChannelArt({
  src,
  name,
  className,
  imgClassName,
  fallbackClassName,
  rounded = "rounded-xl",
  fit = "contain",
}: {
  src?: string | null
  name: string
  className?: string
  imgClassName?: string
  fallbackClassName?: string
  rounded?: string
  fit?: "contain" | "cover"
}) {
  const [failed, setFailed] = useState(false)
  const showFallback = !src || failed

  return (
    <span
      className={cn("relative flex items-center justify-center overflow-hidden bg-white/[0.04]", rounded, className)}
      style={posterStyle(name)}
    >
      {showFallback ? (
        <span
          className={cn("text-base font-black tracking-tight text-white/70", fallbackClassName)}
          aria-hidden="true"
        >
          {initials(name)}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn(
            "relative h-full w-full",
            fit === "cover" ? "object-cover" : "object-contain p-1.5",
            imgClassName,
          )}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

/** One quiet surface for empty, error and "not connected" states. */
export function ChannelNotice({
  title,
  description,
  children,
  tone = "muted",
}: {
  title: string
  description?: ReactNode
  children?: ReactNode
  tone?: "muted" | "warning"
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        tone === "warning"
          ? "border-amber-400/25 bg-amber-400/[0.06]"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            tone === "warning" ? "bg-amber-400/15 text-amber-300" : "bg-white/[0.06] text-white/60",
          )}
        >
          <Info className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          {description ? (
            <p className="text-[13px] leading-relaxed text-white/55">{description}</p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  )
}

/** Skeleton block tuned to the guide's surfaces. */
export function ChannelSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/[0.05]", className)} />
}
