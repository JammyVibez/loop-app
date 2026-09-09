"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Globe,
  RotateCw,
  ShieldAlert,
  Loader2,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// In-app browser: preview a shared link without leaving Loop.
//
// Usage from anywhere (client components):
//   import { openInAppBrowser } from "@/components/in-app-browser/in-app-browser"
//   openInAppBrowser("https://example.com/article", { title: "Article" })
//
// The host (<InAppBrowserHost />) is mounted once in the root layout. Links in
// post content & URL preview cards are wired to this so tapping a link opens
// the preview sheet instead of yanking the user out of the app. From the sheet
// users can then jump to their default browser, Chrome, or copy the link.
// ─────────────────────────────────────────────────────────────────────────────

export interface InAppBrowserRequest {
  url: string
  title?: string
  requestId: number
}

type RequestListener = (req: InAppBrowserRequest) => void
const listeners = new Set<RequestListener>()
let requestCounter = 0

/** Imperative opener — call from any click handler. */
export function openInAppBrowser(url: string, opts?: { title?: string }) {
  let normalized = url.trim()
  if (!normalized) return
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`
  const req: InAppBrowserRequest = { url: normalized, title: opts?.title, requestId: ++requestCounter }
  listeners.forEach((l) => l(req))
}

/** True when a link should open inside Loop's browser sheet instead of a new tab. */
export function isPreviewableUrl(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

/**
 * Launch the OS default browser (Safari/Chrome/Firefox). On Android this uses
 * Chrome Custom Tabs (intent://) when Chrome is present, on iOS it prefers the
 * Chrome app via the googlechrome:// scheme and falls back to Safari, and on
 * desktop it just opens a new tab — no browser lets a website force an app.
 */
function openExternally(url: string) {
  const stripped = url.replace(/^https?:\/\//, "")
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  try {
    if (/android/i.test(ua)) {
      window.location.href =
        `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;` +
        `S.browser_fallback_url=${encodeURIComponent(url)};end`
      return
    }
    if (/iphone|ipad|ipod/i.test(ua)) {
      // Chrome registers the googlechrome:// scheme on iOS; if not installed,
      // the location change fails silently, so fall back to Safari shortly after.
      window.location.href = `googlechrome://${stripped}`
      window.setTimeout(() => {
        if (document.visibilityState !== "hidden") window.open(url, "_blank", "noopener,noreferrer")
      }, 350)
      return
    }
  } catch {
    /* fall through to plain open */
  }
  window.open(url, "_blank", "noopener,noreferrer")
}

export function InAppBrowserHost() {
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<InAppBrowserRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [iframeBlocked, setIframeBlocked] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const blockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subscribe once — the opener helper notifies this (single) host.
  useEffect(() => {
    const listener: RequestListener = (req) => {
      setRequest(req)
      setLoading(true)
      setCopied(false)
      setIframeBlocked(false)
      setOpen(true)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  // Detect iframe being blocked: if onLoad doesn't fire within 6 seconds,
  // the site likely sent X-Frame-Options or CSP frame-ancestors.
  useEffect(() => {
    if (!open || !request) return
    blockTimerRef.current = setTimeout(() => {
      if (loading) {
        setIframeBlocked(true)
        setLoading(false)
      }
    }, 6000)
    return () => {
      if (blockTimerRef.current) clearTimeout(blockTimerRef.current)
    }
  }, [open, request?.url])

  const close = useCallback(() => {
    setOpen(false)
    // Let the frame stop playing/streaming audio & video after the dialog hides.
    window.setTimeout(() => setRequest(null), 300)
  }, [])

  const domain = useMemo(() => {
    if (!request) return ""
    try {
      return new URL(request.url).hostname.replace(/^www\./, "")
    } catch {
      return request.url
    }
  }, [request])

  const favicon = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : ""

  const navigate = (dir: "back" | "forward") => {
    const frame = iframeRef.current?.contentWindow
    if (!frame) return
    try {
      if (dir === "back") frame.history.back()
      else frame.history.forward()
    } catch {
      /* cross-origin frames can throw — ignore, toolbar stays usable */
    }
  }

  const reload = () => {
    const frame = iframeRef.current
    if (!frame) return
    setLoading(true)
    try {
      frame.src = frame.src
    } catch {
      /* noop */
    }
  }

  const copyLink = async () => {
    if (!request) return
    try {
      await navigator.clipboard.writeText(request.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable (non-secure context) — ignore */
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[88dvh] max-h-[88dvh] w-full max-w-5xl flex-col gap-0 overflow-hidden border-border/70 p-0 sm:rounded-2xl"
      >
        {/* Visually-hidden title for a11y (Radix requires a DialogTitle) */}
        <DialogTitle className="sr-only">
          {request?.title || (domain ? `Preview of ${domain}` : "In-app browser")}
        </DialogTitle>

        {/* Browser chrome */}
        <div className="flex flex-col gap-2 border-b border-border/70 bg-muted/20 px-3 pb-2 pt-2.5 pr-12 sm:px-4">
          {/* Top row: page identity */}
          <div className="flex items-center gap-2">
            {favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={favicon} alt="" className="h-4 w-4 shrink-0 rounded-sm" />
            ) : (
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {request?.title || domain}
            </p>
            <span className="hidden shrink-0 items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 sm:inline-flex">
              <ShieldAlert className="h-3 w-3" /> In-app preview
            </span>
          </div>

          {/* Address + actions */}
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full" onClick={() => navigate("back")} title="Back">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full" onClick={() => navigate("forward")} title="Forward">
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full" onClick={reload} title="Reload">
              <RotateCw className="h-3.5 w-3.5" />
            </Button>

            <button
              type="button"
              onClick={() => request && openExternally(request.url)}
              className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground sm:max-w-xl"
              title="Open in your browser"
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{request?.url.replace(/^https?:\/\//, "")}</span>
            </button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-full"
              onClick={() => void copyLink()}
              title="Copy link"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-full"
              onClick={() => {
                if (!request) return
                const shareData = { title: request.title || domain, url: request.url }
                if (navigator.share) {
                  navigator.share(shareData).catch(() => {}) 
                } else {
                  void copyLink()
                }
              }}
              title="Share"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </Button>

            <Button
              size="sm"
              className="h-8 shrink-0 rounded-full bg-gradient-to-r from-sky-600 to-violet-600 px-3 text-xs font-bold text-white shadow-sm hover:from-sky-500 hover:to-violet-500"
              onClick={() => request && openExternally(request.url)}
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Open in browser
            </Button>
          </div>
        </div>

        {/* Embedded page */}
        <div className="relative min-h-0 flex-1 bg-background">
          {loading && !iframeBlocked && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 text-muted-foreground backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
              <p className="text-xs">Loading {domain}…</p>
            </div>
          )}

          {/* Blocked / failed fallback */}
          {iframeBlocked && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/95 p-6 text-center backdrop-blur-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-foreground">This site can't be previewed here</p>
                <p className="max-w-sm text-xs text-muted-foreground">{domain} blocks in-app previews. Open it in your browser for the full experience.</p>
              </div>
              <div className="flex gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full border-border text-foreground"
                  onClick={() => request && openExternally(request.url)}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open in browser
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 rounded-full bg-gradient-to-r from-sky-600 to-violet-600 px-4 text-xs font-bold text-white"
                  onClick={() => { setIframeBlocked(false); setLoading(true); reload() }}
                >
                  <RotateCw className="h-3.5 w-3.5" /> Try again
                </Button>
              </div>
            </div>
          )}
          {request && (
            <iframe
              key={request.requestId}
              ref={iframeRef}
              src={request.url}
              title={request.title || domain}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads allow-modals"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => {
                if (blockTimerRef.current) clearTimeout(blockTimerRef.current)
                setLoading(false)
                setIframeBlocked(false)
              }}
            />
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground sm:px-4">
          <span className="truncate">
            {domain} may block in-app previews (login walls, video players). Tap <span className="font-semibold">Open in browser</span> for the full experience.
          </span>
          <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
            <Globe className={cn("h-3 w-3", loading && "animate-pulse")} />
            {loading ? "connecting…" : "ready"}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
