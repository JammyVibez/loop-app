"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Phone, Video } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HmsRoom } from "@/components/calls/hms-room"
import { cn } from "@/lib/utils"

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  const close = useCallback(() => {
    onOpenChange(false)
    setToken(null)
    setJoined(false)
    setError(null)
  }, [onOpenChange])

  // Fetch a join token when the sheet opens.
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
  }, [open, sessionId, getAuthHeader, toast])

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

  return (
    <div className="fixed inset-0 z-[120] bg-black">
      {token ? (
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
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 px-6 text-center text-white">
          {error ? (
            <>
              <p className="text-lg font-semibold">Call unavailable</p>
              <p className="max-w-sm text-sm text-white/60">{error}</p>
              <button
                type="button"
                onClick={() => endCall(false)}
                className="rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold hover:bg-rose-500"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <Avatar className="h-28 w-28 ring-4 ring-white/10">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-4xl font-bold">
                  {title?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-2xl font-bold">{title}</p>
                <p className="mt-1 text-sm text-white/60">{subtitle || (loading ? "Connecting…" : "Ringing…")}</p>
              </div>
              {loading && <Loader2 className="h-8 w-8 animate-spin text-rose-500" />}
              <div className="flex items-center gap-6">
                <span
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full",
                    mode === "video" ? "bg-white/10" : "bg-emerald-500/90",
                  )}
                >
                  {mode === "video" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
                </span>
                <button
                  type="button"
                  aria-label="End call"
                  onClick={() => endCall(false)}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 transition hover:bg-rose-500"
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
