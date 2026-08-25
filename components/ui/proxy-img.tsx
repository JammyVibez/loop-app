"use client"

import { useState } from "react"

interface ProxyImgProps {
  src?: string | null
  alt?: string
  className?: string
  style?: React.CSSProperties
  draggable?: boolean
  loading?: "lazy" | "eager"
  /** Fallback content when image fails or is missing */
  fallback?: React.ReactNode
  /** When true, proxy is skipped (for local assets like /icons/*) */
  noProxy?: boolean
  onLoad?: () => void
}

function proxyUrl(url: string): string {
  if (!url) return url
  // Don't proxy local assets, data URIs, or internal API routes
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:") || url.includes("/api/")) {
    return url
  }
  // For absolute URLs, check if the pathname is an internal API route
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith("/api/")) return url
  } catch { /* not a valid URL, proxy it */ }
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

/**
 * Image component that routes external URLs through /api/image-proxy
 * to prevent "image unavailable" errors from CORS, hotlinking, or broken URLs.
 * Falls back to initials/placeholder on load error.
 */
export function ProxyImg({
  src,
  alt = "",
  className = "",
  style,
  draggable = false,
  loading = "lazy",
  fallback,
  noProxy = false,
  onLoad,
}: ProxyImgProps) {
  const [imgFailed, setImgFailed] = useState(false)

  const isExternal = src && !src.startsWith("/") && !src.startsWith("data:") && !src.startsWith("blob:")
  const proxiedSrc = src && !noProxy ? proxyUrl(src) : src || ""

  if (!src || imgFailed) {
    if (fallback) {
      return <>{fallback}</>
    }
    // Default fallback: initials circle
    const initial = (alt || "U").charAt(0).toUpperCase()
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold ${className}`}
        style={style}
      >
        <span>{initial}</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxiedSrc}
      alt={alt}
      className={className}
      style={style}
      draggable={draggable}
      loading={loading}
      onError={() => setImgFailed(true)}
      onLoad={onLoad}
    />
  )
}
