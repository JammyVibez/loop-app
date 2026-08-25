"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { cn } from "@/lib/utils"
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Loader2,
  Clock,
  Video,
} from "lucide-react"

interface CallLogEntry {
  id: string
  creator_id: string
  conversation_id: string | null
  is_video: boolean
  status: string
  created_at: string
  started_at: string | null
  ended_at: string | null
  is_outgoing: boolean
  duration_seconds: number
  other_user?: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
  } | null
  conversation?: {
    id: string
    is_group: boolean
    name?: string
  } | null
}

interface CallLogsProps {
  /** Called when user taps to call back — opens the conversation */
  onCallBack?: (conversationId: string) => void
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "Missed"
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function formatCallTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const callDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - callDate.getTime()) / 86400000)

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  if (diffDays === 0) return `Today ${time}`
  if (diffDays === 1) return `Yesterday ${time}`
  if (diffDays < 7) {
    return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`
  }
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`
}

function CallStatusIcon({ call }: { call: CallLogEntry }) {
  const isMissed = call.status === "ended" && !call.started_at && !call.is_outgoing
  const isAnswered = call.status === "ended" && call.started_at

  if (isMissed) {
    return <PhoneMissed className="h-4 w-4 text-red-500" />
  }
  if (call.is_video) {
    return <Video className="h-4 w-4 text-violet-500" />
  }
  if (call.is_outgoing) {
    return <PhoneOutgoing className="h-4 w-4 text-emerald-500" />
  }
  if (isAnswered) {
    return <PhoneIncoming className="h-4 w-4 text-emerald-500" />
  }
  return <Phone className="h-4 w-4 text-muted-foreground" />
}

export function CallLogs({ onCallBack }: CallLogsProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [calls, setCalls] = useState<CallLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [startingCall, setStartingCall] = useState<string | null>(null)

  const fetchCalls = useCallback(
    async (offset = 0) => {
      if (!user) return
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      try {
        const res = await fetch(`/api/calls/logs?limit=20&offset=${offset}`, {
          headers: getAuthHeader(),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load call logs")

        const newCalls = data.data?.calls || []
        if (offset === 0) {
          setCalls(newCalls)
        } else {
          setCalls((prev) => [...prev, ...newCalls])
        }
        setHasMore(Boolean(data.data?.has_more))
      } catch (error: any) {
        toast({
          title: "Could not load call logs",
          description: error.message,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, getAuthHeader, toast],
  )

  useEffect(() => {
    void fetchCalls()
  }, [fetchCalls])

  const handleCallBack = async (call: CallLogEntry) => {
    if (!user || !call.conversation_id) return
    if (onCallBack) {
      onCallBack(call.conversation_id)
      return
    }
    // Fallback: navigate to the conversation
    window.location.href = `/messages?c=${call.conversation_id}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Phone className="h-5 w-5" />
        </div>
        <p className="font-medium text-foreground">No call history</p>
        <p className="max-w-[220px] text-xs">
          When you voice or video call someone, it will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {calls.map((call) => {
        const isMissed = call.status === "ended" && !call.started_at && !call.is_outgoing
        const name = call.other_user?.display_name || call.other_user?.username || "Unknown"
        const username = call.other_user?.username
        const avatarUrl = call.other_user?.avatar_url

        return (
          <div
            key={call.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
              isMissed && "bg-red-500/5",
            )}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <VideoAvatar
                src={avatarUrl}
                alt={name}
                fallback={name}
                size="md"
              />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    isMissed ? "text-red-500" : "text-foreground",
                  )}
                >
                  {name}
                </p>
                {username && (
                  <Link
                    href={`/profile/${username}`}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    @{username}
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CallStatusIcon call={call} />
                <span>{formatCallTime(call.created_at)}</span>
                {call.duration_seconds > 0 && (
                  <>
                    <span>·</span>
                    <span>{formatDuration(call.duration_seconds)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Call back button */}
            {call.conversation_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500"
                title={`Call ${name} back`}
                onClick={() => void handleCallBack(call)}
              >
                {call.is_video ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )
      })}

      {hasMore && (
        <div className="flex justify-center py-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => void fetchCalls(calls.length)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
