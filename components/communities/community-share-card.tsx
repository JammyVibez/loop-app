"use client"

import { useCallback, useEffect, useState, type MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Check, Loader2, Lock, Users } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"

type Summary = {
  community: {
    id: number | string
    name: string
    handle: string | null
    description: string | null
    avatar_url: string | null
    cover_url: string | null
    accent_color: string | null
    category: string | null
    is_private: boolean
  }
  member_count: number | null
  is_member: boolean
  is_pending: boolean
}

// Feed rows can render the same community several times; keep one fetch per
// minute instead of one per card.
const summaryCache = new Map<string, { data: Summary; at: number }>()
const CACHE_TTL = 60_000

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

/**
 * Rich community card rendered inside a feed post (token `[[cc:<id>]]`).
 *
 * Deliberately built from phrasing elements (span/button/link) because
 * RichContent renders post text inside a paragraph.
 */
export function CommunityShareCard({ communityId, className }: { communityId: string; className?: string }) {
  const router = useRouter()
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<Summary | null>(null)
  const [failed, setFailed] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false
    const cached = summaryCache.get(communityId)
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setData(cached.data)
      return
    }
    fetch(`/api/communities/${communityId}/summary`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        if (json?.community) {
          summaryCache.set(communityId, { data: json, at: Date.now() })
          setData(json)
        } else {
          setFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [communityId])

  const stop = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const join = useCallback(
    async (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (!user) {
        router.push(`/auth?returnTo=/communities/${communityId}`)
        return
      }
      setJoining(true)
      try {
        const res = await fetch(`/api/circles/${communityId}/join`, {
          method: "POST",
          headers: { ...getAuthHeader() },
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Could not join")

        const pending = json.status === "pending"
        setData((current) =>
          current
            ? {
                ...current,
                is_member: pending ? current.is_member : true,
                is_pending: pending,
                member_count: !pending && current.member_count !== null ? current.member_count + 1 : current.member_count,
              }
            : current,
        )
        toast({
          title: pending ? "Request sent" : "Welcome in",
          description: pending ? "A moderator will review your request." : `You joined ${data?.community.name || "this community"}.`,
        })
      } catch (err: any) {
        toast({ title: "Could not join", description: err.message, variant: "destructive" })
      } finally {
        setJoining(false)
      }
    },
    [communityId, data?.community.name, getAuthHeader, router, toast, user],
  )

  if (failed) {
    return (
      <span className={cn("my-2 block text-xs text-muted-foreground", className)}>
        This community is unavailable.{" "}
        <Link href={`/communities/${communityId}`} className="font-semibold text-primary hover:underline" onClick={stop}>
          View
        </Link>
      </span>
    )
  }

  if (!data) {
    return (
      <span className={cn("my-2 flex h-32 w-full max-w-md animate-pulse rounded-2xl border border-border bg-muted/60", className)} />
    )
  }

  const { community, member_count, is_member, is_pending } = data
  const href = `/communities/${community.id}`
  const accent = community.accent_color || undefined

  return (
    <span
      className={cn(
        "my-2 block w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg shadow-black/20 transition-colors hover:border-border",
        className,
      )}
      onClick={stop}
    >
      <span className="relative block h-24 overflow-hidden bg-gradient-to-br from-primary/25 via-muted to-background">
        {community.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={community.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span
            className="absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(circle at 80% 60%, rgba(168,85,247,0.28), transparent 60%)",
            }}
          />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
          <Users className="h-2.5 w-2.5" /> Community
        </span>
      </span>

      <span className="relative block px-4 pb-3.5">
        <Avatar className="-mt-7 h-14 w-14 rounded-2xl border-2 border-card bg-card shadow-md">
          <AvatarImage src={community.avatar_url || undefined} alt={community.name} />
          <AvatarFallback className="rounded-2xl text-sm font-black">{initials(community.name)}</AvatarFallback>
        </Avatar>

        <span className="mt-2 flex items-center gap-1.5">
          <span className="truncate text-[15px] font-black tracking-tight text-foreground">{community.name}</span>
          {community.is_private && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </span>

        <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
          {community.handle ? `c/${community.handle}` : `c/${community.id}`}
          {community.category ? ` · ${community.category}` : ""}
        </span>

        {community.description && (
          <span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-foreground/75">{community.description}</span>
        )}

        <span className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
          {member_count !== null ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {member_count.toLocaleString()} members
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> Private
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
          </span>
        </span>

        <span className="mt-3 flex items-stretch gap-2">
          <Button asChild size="sm" className="h-8 flex-1 rounded-full text-xs font-semibold" style={accent ? { backgroundColor: accent } : undefined}>
            <Link href={href} onClick={stop}>
              View
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={is_member ? "secondary" : "outline"}
            onClick={join}
            disabled={joining || is_member || is_pending}
            className="h-8 flex-1 rounded-full text-xs font-semibold"
          >
            {joining ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : is_member ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" /> Joined
              </>
            ) : is_pending ? (
              "Requested"
            ) : (
              "Join"
            )}
          </Button>
        </span>
      </span>
    </span>
  )
}
