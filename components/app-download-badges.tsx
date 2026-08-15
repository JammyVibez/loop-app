"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Apple, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/store-links"

export type DevicePlatform = "ios" | "android" | "desktop"

/** Coarse OS/device detection for install prompts and store CTAs. */
export function detectPlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "desktop"
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return "ios"
  if (/Android/i.test(ua)) return "android"
  return "desktop"
}

const badgeBase =
  "relative inline-flex h-12 items-center gap-2.5 rounded-xl bg-black/90 px-3.5 text-left ring-1 ring-white/15 shadow-lg shadow-black/30 transition hover:ring-white/30"

function SoonChip() {
  return (
    <span className="absolute -right-2 -top-2 z-10 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black shadow">
      Soon
    </span>
  )
}

/** "Download on the App Store" badge. Disabled "Soon" state until the listing is live. */
export function AppStoreBadge({ className }: { className?: string }) {
  const available = Boolean(APP_STORE_URL)
  const inner = (
    <>
      <Apple className="h-7 w-7 shrink-0 fill-white text-white" />
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">Download on the</span>
        <span className="text-sm font-semibold text-white">App Store</span>
      </span>
    </>
  )

  if (!available) {
    return (
      <span
        aria-disabled="true"
        title="Coming soon to the App Store"
        className={cn(badgeBase, "cursor-not-allowed opacity-75", className)}
      >
        {inner}
        <SoonChip />
      </span>
    )
  }

  return (
    <Link href={APP_STORE_URL} target="_blank" rel="noreferrer" className={cn(badgeBase, className)}>
      {inner}
    </Link>
  )
}

/** "Get it on Google Play" badge. Disabled "Soon" state until the listing is live. */
export function PlayStoreBadge({ className }: { className?: string }) {
  const available = Boolean(PLAY_STORE_URL)
  const inner = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 via-emerald-500 to-amber-400">
        <Play className="h-3.5 w-3.5 fill-white text-white" />
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">Get it on</span>
        <span className="text-sm font-semibold text-white">Google Play</span>
      </span>
    </>
  )

  if (!available) {
    return (
      <span
        aria-disabled="true"
        title="Coming soon to Google Play"
        className={cn(badgeBase, "cursor-not-allowed opacity-75", className)}
      >
        {inner}
        <SoonChip />
      </span>
    )
  }

  return (
    <Link href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className={cn(badgeBase, className)}>
      {inner}
    </Link>
  )
}

/**
 * OS-aware store buttons: on a phone only that platform's store is shown,
 * everywhere else (desktop/tablet/unknown) both are shown.
 */
export function AppDownloadBadges({ className }: { className?: string }) {
  const [platform, setPlatform] = useState<DevicePlatform>("desktop")

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {platform !== "android" && <AppStoreBadge />}
      {platform !== "ios" && <PlayStoreBadge />}
    </div>
  )
}
