"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import {
  Swords,
  Rocket,
  Users,
  TrendingUp,
  Loader2,
  ArrowRight,
  Check,
  Zap,
} from "@/components/icons/lucide-compat"

interface DiscoveryDuel {
  id: string
  loop_id: string
  prompt: string
  expires_at: string
  stake_coins: number
  total_votes: number
  percent_a: number
  percent_b: number
  creator?: { username?: string; display_name?: string; avatar_url?: string } | null
}

interface DiscoveryCoLoop {
  id: string
  content: string
  created_at: string
  co_author_count: number
  likes_count: number
  author?: { username?: string; display_name?: string; avatar_url?: string } | null
}

interface DiscoveryCircle {
  id: string
  name: string
  description?: string
  avatar_url?: string
  category?: string
  member_count: number
}

interface DiscoveryCreator {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
  bio?: string
  followers_count?: number
}

/**
 * "Jump into something" — Explore's live participation surface. Compact
 * panels keep the four ways to act visible without turning discovery into a
 * long stack of nested cards.
 */
export function ParticipationDiscovery() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<{
    duels: DiscoveryDuel[]
    coLoops: DiscoveryCoLoop[]
    circles: DiscoveryCircle[]
    creators: DiscoveryCreator[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [followLoading, setFollowLoading] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch("/api/explore/trending?type=discovery", {
      headers: user ? getAuthHeader() : {},
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((res) => {
        if (!mounted) return
        if (res?.duels || res?.coLoops || res?.circles || res?.creators) {
          setData({
            duels: res.duels || [],
            coLoops: res.coLoops || [],
            circles: res.circles || [],
            creators: res.creators || [],
          })
        } else if (res?.data) {
          setData(res.data)
        }
      })
      .catch(() => {
        if (mounted) setData(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleFollow = async (creator: DiscoveryCreator) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Log in to follow creators." })
      return
    }
    if (following.has(creator.id) || followLoading === creator.id) return
    setFollowLoading(creator.id)
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: creator.id, action: "follow" }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Could not follow this creator")
      setFollowing((prev) => new Set(prev).add(creator.id))
      toast({ title: `Following @${creator.username}` })
    } catch (error: any) {
      toast({
        title: "Could not follow",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setFollowLoading(null)
    }
  }

  if (loading) return null
  if (!data || (!data.duels.length && !data.coLoops.length && !data.circles.length && !data.creators.length)) {
    return null
  }

  const duels = data.duels.slice(0, 2)
  const coLoops = data.coLoops.slice(0, 2)
  const circles = data.circles.slice(0, 3)
  const creators = data.creators
    .filter((creator, index, all) => all.findIndex((item) => item.id === creator.id) === index)
    .slice(0, 3)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Live discovery
            </p>
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Jump into something</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vote on a call, join a collaboration, or find your people.
          </p>
        </div>
        <Badge variant="outline" className="hidden border-border/70 text-[10px] font-medium text-muted-foreground sm:inline-flex">
          <Zap className="mr-1 h-3 w-3 text-amber-500" />
          Fresh now
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Active duels */}
        {duels.length > 0 && (
          <div className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card p-3">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Swords className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-semibold text-foreground">Active duels</h3>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{duels.length}</span>
            </div>
            <div className="mt-1 divide-y divide-border/40">
              {duels.map((duel) => (
                <Link
                  key={duel.id}
                  href={`/loop/${duel.loop_id}`}
                  className="group block py-2 first:pt-1.5 last:pb-0"
                >
                  <p className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground transition-colors group-hover:text-amber-700 dark:group-hover:text-amber-300">
                    {duel.prompt}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-rose-500/80"
                        style={{ width: `${Math.max(0, Math.min(100, duel.percent_a))}%` }}
                      />
                      <div
                        className="h-full bg-cyan-500/80"
                        style={{ width: `${Math.max(0, Math.min(100, duel.percent_b))}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[9px] font-semibold tabular-nums text-muted-foreground">
                      {duel.percent_a}–{duel.percent_b}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                    <span className="truncate">@{duel.creator?.username || "creator"} · {duel.total_votes} votes</span>
                    <span className="shrink-0 font-semibold text-amber-600 dark:text-amber-400">Vote</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Open co-loops */}
        {coLoops.length > 0 && (
          <div className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card p-3">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Rocket className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-semibold text-foreground">Open co-loops</h3>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{coLoops.length}</span>
            </div>
            <div className="mt-1 divide-y divide-border/40">
              {coLoops.map((loop) => (
                <Link key={loop.id} href={`/loop/${loop.id}`} className="group block py-2 first:pt-1.5 last:pb-0">
                  <p className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground transition-colors group-hover:text-cyan-700 dark:group-hover:text-cyan-300">
                    {loop.content || "A collaborative loop"}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1">
                      <Avatar className="h-3.5 w-3.5 border border-card">
                        <AvatarImage src={loop.author?.avatar_url} />
                        <AvatarFallback className="text-[7px]">
                          {loop.author?.display_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{loop.co_author_count} collaborators</span>
                    </span>
                    <span className="shrink-0 font-semibold text-cyan-600 dark:text-cyan-400">Join</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Growing circles */}
        {circles.length > 0 && (
          <div className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card p-3">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Users className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-semibold text-foreground">Growing circles</h3>
              <Link href="/communities" className="ml-auto text-muted-foreground transition-colors hover:text-foreground" aria-label="Browse all circles">
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-1 divide-y divide-border/40">
              {circles.map((circle) => (
                <Link
                  key={circle.id}
                  href={`/communities/${circle.id}`}
                  className="group flex items-center gap-2 py-2 first:pt-1.5 last:pb-0"
                >
                  <Avatar className="h-7 w-7 border border-border/60">
                    <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name} />
                    <AvatarFallback className="text-[10px]">{circle.name?.charAt(0) || "C"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      {circle.name}
                    </p>
                    <p className="truncate text-[9px] text-muted-foreground">
                      {circle.member_count.toLocaleString()} members{circle.category ? ` · ${circle.category}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Rising creators */}
        {creators.length > 0 && (
          <div className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card p-3">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-xs font-semibold text-foreground">Rising creators</h3>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{creators.length}</span>
            </div>
            <div className="mt-1 divide-y divide-border/40">
              {creators.map((creator) => {
                const isFollowed = following.has(creator.id)
                return (
                  <div key={creator.id} className="flex items-center gap-2 py-2 first:pt-1.5 last:pb-0">
                    <Link href={`/profile/${creator.username}`} className="flex min-w-0 flex-1 items-center gap-2">
                      <Avatar className="h-7 w-7 border border-border/60">
                        <AvatarImage src={creator.avatar_url} alt={creator.display_name} />
                        <AvatarFallback className="text-[10px]">
                          {(creator.display_name || creator.username).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-[11px] font-semibold text-foreground">
                          <span className="truncate">{creator.display_name || creator.username}</span>
                          {creator.is_verified && <VerifiedSeal size={11} title="Verified Creator" />}
                        </p>
                        <p className="truncate text-[9px] text-muted-foreground">
                          @{creator.username}
                          {creator.followers_count ? ` · ${creator.followers_count} followers` : ""}
                        </p>
                      </div>
                    </Link>
                    <Button
                      size="sm"
                      variant={isFollowed ? "secondary" : "outline"}
                      className="h-6 shrink-0 rounded-full px-2 text-[9px] font-semibold"
                      disabled={isFollowed || followLoading === creator.id}
                      onClick={() => void handleFollow(creator)}
                    >
                      {followLoading === creator.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isFollowed ? (
                        <>
                          <Check className="mr-0.5 h-3 w-3" />
                          Following
                        </>
                      ) : (
                        "Follow"
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
