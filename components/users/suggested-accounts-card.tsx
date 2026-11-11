"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, UserPlus, Users, X } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { UserBadges } from "@/components/user-badge"
import { stripCircleBioTokens } from "@/lib/circle-bio-tokens"

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
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-[linear-gradient(155deg,hsl(var(--card))_0%,hsl(var(--card))_68%,hsl(var(--primary)/0.055)_100%)] shadow-sm">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(110%_150%_at_100%_0%,hsl(var(--primary)/0.09),transparent_68%)]" />
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

      <div className="relative flex items-center justify-between gap-3 px-3.5 pb-3 pt-3.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-primary/15 bg-gradient-to-br from-primary/15 via-card to-secondary/15 text-primary shadow-[inset_0_1px_0_hsl(var(--background)/0.45)]">
            <Users className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary/80 ring-2 ring-card" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold leading-tight tracking-tight text-foreground">
              Suggested for you
            </h2>
            <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
              People your circles and activity point to
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground"
          onClick={hideCard}
          aria-label="Hide suggested accounts"
          title="Hide suggestions"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="relative border-t border-border/45">
        {suggestions.map((person) => {
          const isFollowed = followed.has(person.id)
          const bio = stripCircleBioTokens(person.bio)
          const hasCircleTie = Number(person.mutual_count || 0) > 0 || Number(person.shared_circles || 0) > 0
          const ProofIcon = hasCircleTie ? Users : UserPlus

          return (
            <div
              key={person.id}
              className="group/row relative flex items-start gap-3 border-b border-border/40 px-3.5 py-3 transition-colors last:border-b-0 hover:bg-muted/20 sm:px-4"
            >
              <Link
                href={`/profile/${person.username}`}
                className="flex min-w-0 flex-1 items-start gap-2.5"
              >
                <span className="relative mt-0.5 shrink-0 rounded-full bg-gradient-to-br from-primary/45 via-border/80 to-secondary/40 p-[1.5px] transition-transform duration-200 group-hover/row:scale-[1.04]">
                  <span className="block rounded-full bg-card p-[1.5px]">
                    <VideoAvatar
                      src={person.avatar_url || undefined}
                      videoSrc={person.video_avatar_url}
                      isPremium={Boolean(person.is_premium)}
                      alt={person.display_name || person.username}
                      fallback={(person.display_name || person.username).charAt(0).toUpperCase()}
                      size="md"
                      className="h-9 w-9"
                    />
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
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
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">@{person.username}</p>

                  {bio ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-[1.35] text-foreground/75">{bio}</p>
                  ) : null}

                  <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-primary/80">
                    <ProofIcon className="h-3 w-3 shrink-0" />
                    <span className="line-clamp-1">{person.reason || "A creator worth discovering"}</span>
                  </p>
                </div>
              </Link>

              <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={isFollowed ? "secondary" : "default"}
                  aria-pressed={isFollowed}
                  className={`h-8 min-w-[78px] rounded-full px-3 text-[11px] font-semibold transition-all duration-200 ${
                    isFollowed
                      ? "bg-muted text-muted-foreground shadow-none"
                      : "shadow-sm hover:-translate-y-px hover:bg-primary/90"
                  }`}
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
                  aria-label={`Not interested in ${person.display_name || person.username}`}
                  className="whitespace-nowrap rounded px-1 py-1 text-[10px] font-medium text-muted-foreground/65 transition-colors hover:bg-muted hover:text-foreground"
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
