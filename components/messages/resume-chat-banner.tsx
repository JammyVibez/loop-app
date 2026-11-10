"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, History, X } from "@/components/icons/lucide-compat"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { readChatResumePoint, writeChatResumePoint, type ChatResumePoint } from "@/lib/message-resume"

/**
 * "Continue where you left off" for the inbox.
 *
 * MessagesWorkspace records the last conversation you opened (see
 * lib/message-resume); this is where it comes back. It only offers a chat that
 * still exists in your inbox, so a deleted conversation can't resurrect a dead
 * link — and it flags how much has landed since you left.
 */
export function ResumeChatBanner({ className }: { className?: string }) {
  const { user, getAuthHeader } = useAuth()
  const router = useRouter()
  const [point, setPoint] = useState<ChatResumePoint | null>(null)
  const [stillExists, setStillExists] = useState(false)
  const [newCount, setNewCount] = useState(0)

  // Read the stored point once the account is known.
  useEffect(() => {
    setPoint(readChatResumePoint(user?.id))
  }, [user?.id])

  // Verify it's still a real conversation, and how much arrived since.
  useEffect(() => {
    const id = point?.id
    if (!id || !user) {
      setStillExists(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/conversations", { headers: getAuthHeader() })
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        const list: any[] = data.conversations || data.data || []
        const match = list.find((c) => String(c.id) === String(id))
        if (cancelled) return
        if (!match) {
          // Gone (deleted / cleared) — stop offering it.
          setStillExists(false)
          writeChatResumePoint(user.id, null)
          setPoint(null)
          return
        }
        setStillExists(true)
        const lastAt = match.last_message?.created_at
        const leftAt = point?.at ? new Date(point.at).getTime() : 0
        setNewCount(
          lastAt && new Date(lastAt).getTime() > leftAt
            ? Number(match.unread_count || 0) || 1
            : Number(match.unread_count || 0),
        )
      } catch {
        /* the banner is a nicety; a failed lookup just hides it */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [point?.id, point?.at, user, getAuthHeader])

  if (!point || !stillExists) return null

  const dismiss = () => {
    writeChatResumePoint(user?.id, null)
    setPoint(null)
  }

  const open = () => {
    router.push(`/messages?c=${encodeURIComponent(point.id)}`)
  }

  return (
    <div className={cn("mx-auto w-full max-w-6xl px-3 pt-3 lg:px-4 lg:pt-4", className)}>
      <div className="flex items-center gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2.5">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 sm:flex dark:text-violet-300">
          <History className="h-4 w-4" />
        </span>

        <button type="button" onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <VideoAvatar
            src={point.avatarUrl || undefined}
            videoSrc={point.videoAvatarUrl || undefined}
            alt={point.name}
            fallback={(point.name || "?").charAt(0).toUpperCase()}
            size="sm"
            className="h-8 w-8 shrink-0 rounded-full"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                Continue where you left off
              </span>
              {newCount > 0 && (
                <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {newCount}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-sm text-foreground">
              <span className="font-semibold">{point.name}</span>
              {point.preview ? <span className="text-muted-foreground"> · {point.preview}</span> : null}
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-violet-600 sm:flex dark:text-violet-300">
            Resume
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>

        <button
          type="button"
          aria-label="Dismiss continue-where-you-left-off"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
