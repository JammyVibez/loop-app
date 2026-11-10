"use client"

import { useCallback, useEffect, useState } from "react"
import { Phone, RefreshCw, Video } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HmsRoom } from "@/components/calls/hms-room"
import { LivekitRoom } from "@/components/calls/livekit-room"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

export interface CallSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string | null
  /** "video" shows the video icon in ringing UI; "audio" is voice-only. */
  mode?: "video" | "audio"
  title?: string
  subtitle?: string
  avatarUrl?: string
  /** Called after the call is ended (so the caller can clear state). */
  onEnded?: () => void
}

export function CallSheet({
  open,
  onOpenChange,
  sessionId,
  mode = "video",
  title = "Call",
  subtitle,
  avatarUrl,
  onEnded,
}: CallSheetProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [provider, setProvider] = useState<"100ms" | "livekit" | null>(null)
  const [roomUrl, setRoomUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  /** Bumped to re-run the token fetch after a failed join. */
  const [reloadKey, setReloadKey] = useState(0)

  const close = useCallback(() => {
    onOpenChange(false)
    setToken(null)
    setProvider(null)
    setRoomUrl(null)
    setJoined(false)
    setError(null)
  }, [onOpenChange])

  // Fetch a join token when the sheet opens (and on retry).
  useEffect(() => {
    if (!open || !sessionId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const load = async () => {
      try {
        const res = await fetch(`/api/calls/${sessionId}`, { headers: getAuthHeader() })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not join the call")
        if (cancelled) return
        setToken(data.data?.token || null)
        setProvider((data.data?.provider as "100ms" | "livekit") || "100ms")
        setRoomUrl(data.data?.url || null)
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || "Could not join the call")
        toast({ title: "Call unavailable", description: err?.message, variant: "destructive" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, sessionId, getAuthHeader, toast, reloadKey])

  const retry = useCallback(() => {
    setToken(null)
    setProvider(null)
    setRoomUrl(null)
    setError(null)
    setReloadKey((k) => k + 1)
  }, [])

  // When the user hangs up, mark the session ended (best effort).
  const endCall = useCallback(
    (fromRoom: boolean) => {
      if (sessionId) {
        void fetch(`/api/calls/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ action: "end" }),
        }).catch(() => {})
      }
      if (fromRoom) onEnded?.()
      close()
    },
    [sessionId, getAuthHeader, onEnded, close],
  )

  if (!open) return null

  const displayName = user?.display_name || user?.username || "You"
  const initial = (title || displayName).charAt(0)?.toUpperCase() || "?"

  return (
    <div className="fixed inset-0 z-[120] bg-[#07080d]">
      {token ? (
        provider === "livekit" ? (
          <LivekitRoom
            token={token}
            url={roomUrl || ""}
            userName={displayName}
            audioOnly={mode === "audio"}
            layout="stage"
            title={title}
            subtitle={subtitle}
            onJoined={() => setJoined(true)}
            onLeave={() => endCall(true)}
            onRetry={retry}
          />
        ) : (
          <HmsRoom
            token={token}
            userName={displayName}
            audioOnly={mode === "audio"}
            layout="stage"
            title={title}
            subtitle={subtitle}
            onJoined={() => setJoined(true)}
            onLeave={() => endCall(true)}
          />
        )
      ) : (
        <div className="relative flex h-full flex-col items-center justify-center gap-7 overflow-hidden px-6 text-center text-white">
          {/* Ambient aurora */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />

          {error ? (
            <>
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-500/30">
                <Phone className="h-8 w-8 rotate-[135deg] text-rose-400" />
              </div>
              <div className="relative">
                <p className="text-xl font-semibold">Call unavailable</p>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/55">{error}</p>
              </div>
              <div className="relative flex items-center gap-3">
                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/15"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </button>
                <button
                  type="button"
                  onClick={() => endCall(false)}
                  className="rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold transition hover:bg-rose-500"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                {/* Pulsing rings while ringing */}
                <span className="absolute inset-0 -m-4 animate-ping rounded-full bg-white/[0.06]" />
                <span className="absolute inset-0 -m-8 animate-pulse rounded-full bg-white/[0.04]" />
                <Avatar className="relative h-32 w-32 ring-4 ring-white/10">
                  <AvatarImage src={avatarUrl} alt={title} />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 text-5xl font-bold">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-[#0b0d14] px-3 text-[11px] font-medium text-white/70 shadow-lg">
                  {mode === "video" ? <Video className="h-3.5 w-3.5 text-sky-400" /> : <Phone className="h-3.5 w-3.5 text-emerald-400" />}
                  {mode === "video" ? "Video call" : "Voice call"}
                </span>
              </div>

              <div className="relative">
                <p className="text-2xl font-bold">{title}</p>
                <p className="mt-1 text-sm text-white/55">
                  {subtitle || (loading ? "Connecting…" : "Ringing…")}
                </p>
              </div>

              <div className="relative flex items-center gap-5">
                <span
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] backdrop-blur",
                  )}
                >
                  {loading ? (
                    <Spinner className="h-6 w-6 text-sky-400" />
                  ) : mode === "video" ? (
                    <Video className="h-7 w-7 text-white/80" />
                  ) : (
                    <Phone className="h-7 w-7 text-emerald-400" />
                  )}
                </span>
                <button
                  type="button"
                  aria-label="End call"
                  onClick={() => endCall(false)}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 active:scale-95"
                >
                  <Phone className="h-7 w-7 rotate-[135deg]" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
