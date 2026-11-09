"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, Sparkles, UserPlus, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { UserBadges } from "@/components/user-badge"

type Suggestion = {
  id: string
  username: string
  display_name: string | null
  avatar_url?: string | null
  video_avatar_url?: string | null
  is_verified?: boolean | null
  is_team_member?: boolean | null
  is_sponsor?: boolean | null
  is_premium?: boolean | null
  is_organization?: boolean | null
  organization_badge_url?: string | null
  organization_name?: string | null
  bio?: string | null
  reason?: string
  mutual_count?: number
  shared_circles?: number
}

const MAX_STORED_IDS = 80

function readIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(-MAX_STORED_IDS) : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: Iterable<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids].slice(-MAX_STORED_IDS)))
  } catch {
    /* storage is optional */
  }
}

/**
 * An occasional, self-contained For You card. It deliberately avoids the old
 * bottom-of-feed "Who to follow" block: it is dismissible, shows a reason for
 * every account, and remembers both dismissals and accounts already shown.
 */
export function SuggestedAccountsCard({ limit = 2 }: { limit?: number }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const dismissedRef = useRef<Set<string>>(new Set())
  const seenRef = useRef<Set<string>>(new Set())
  const hiddenKeyRef = useRef("")
  const dismissedKeyRef = useRef("")
  const seenKeyRef = useRef("")

  const load = useCallback(async () => {
    if (!user?.id || hidden) {
      setLoading(false)
      return
    }

    const suffix = user.id
    const dismissedKey = `loop:suggested:dismissed:v1:${suffix}`
    const seenKey = `loop:suggested:seen:v1:${suffix}`
    const hiddenKey = `loop:suggested:hidden:v1:${suffix}`
    hiddenKeyRef.current = hiddenKey
    dismissedKeyRef.current = dismissedKey
    seenKeyRef.current = seenKey
    dismissedRef.current = new Set(readIds(dismissedKey))
    seenRef.current = new Set(readIds(seenKey))

    if (window.localStorage.getItem(hiddenKey) === "true") {
      setHidden(true)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(limit) })
      if (dismissedRef.current.size) params.set("dismissed", [...dismissedRef.current].join(","))
      if (seenRef.current.size) params.set("seen", [...seenRef.current].join(","))
      const response = await fetch(`/api/users/suggestions?${params.toString()}`, {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        setSuggestions([])
        return
      }
      if (data.disabled) {
        setHidden(true)
        setSuggestions([])
        return
      }
      const rows = (data.suggestions || []) as Suggestion[]
      setSuggestions(rows)
      for (const row of rows) seenRef.current.add(row.id)
      writeIds(seenKey, seenRef.current)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, hidden, limit, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const dismiss = (personId: string) => {
    dismissedRef.current.add(personId)
    writeIds(dismissedKeyRef.current, dismissedRef.current)
    setSuggestions((previous) => previous.filter((person) => person.id !== personId))
  }

  const hideCard = () => {
    setHidden(true)
    try {
      window.localStorage.setItem(hiddenKeyRef.current, "true")
    } catch {
      /* ignore */
    }
  }

  const follow = async (personId: string) => {
    if (!user) return
    setFollowed((previous) => new Set(previous).add(personId))
    try {
      const response = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: personId, action: "follow" }),
      })
      if (!response.ok) throw new Error("Follow failed")
      toast({ title: "Following", description: "Their new loops will show up in Following." })
    } catch {
      setFollowed((previous) => {
        const next = new Set(previous)
        next.delete(personId)
        return next
      })
      toast({ title: "Could not follow", description: "Please try again.", variant: "destructive" })
    }
  }

  if (!user || hidden || loading || suggestions.length === 0) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--card))_55%,hsl(var(--primary)/0.07)_100%)] shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold tracking-tight text-foreground">Suggested for you</h2>
            <p className="truncate text-[10px] text-muted-foreground">People your circles and activity point to</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          onClick={hideCard}
          aria-label="Hide suggested accounts"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="divide-y divide-border/50 border-t border-border/50">
        {suggestions.map((person) => {
          const isFollowed = followed.has(person.id)
          return (
            <div key={person.id} className="flex items-start gap-3 px-4 py-3">
              <Link
                href={`/profile/${person.username}`}
                className="flex min-w-0 flex-1 items-start gap-3"
              >
                <VideoAvatar
                  src={person.avatar_url || undefined}
                  videoSrc={person.video_avatar_url}
                  isPremium={Boolean(person.is_premium)}
                  alt={person.display_name || person.username}
                  fallback={(person.display_name || person.username).charAt(0).toUpperCase()}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {person.display_name || person.username}
                    </p>
                    <UserBadges
                      is_verified={Boolean(person.is_verified)}
                      is_team_member={Boolean(person.is_team_member)}
                      is_sponsor={Boolean(person.is_sponsor)}
                      is_premium={Boolean(person.is_premium)}
                      is_organization={Boolean(person.is_organization)}
                      organization_badge_url={person.organization_badge_url || undefined}
                      organization_name={person.organization_name || undefined}
                      username={person.username}
                      size="sm"
                    />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">@{person.username}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-primary/80">{person.reason}</p>
                </div>
              </Link>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={isFollowed ? "secondary" : "default"}
                  className="h-7 rounded-full px-2.5 text-[11px] font-semibold"
                  onClick={() => void follow(person.id)}
                  disabled={isFollowed}
                >
                  {isFollowed ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1 h-3 w-3" />
                      Follow
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => dismiss(person.id)}
                  className="text-[10px] text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  Not interested
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
