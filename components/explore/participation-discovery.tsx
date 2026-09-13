"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
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
} from "lucide-react"

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
 * "What can I participate in right now?" — Explore's participation
 * discovery section: active duels, open co-loops, growing circles and
 * rising creators, all from real data.
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
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: creator.id, action: "follow" }),
      })
      if (res.ok) {
        setFollowing((prev) => new Set(prev).add(creator.id))
        toast({ title: `Following @${creator.username}` })
      }
    } catch {
      /* non-blocking */
    }
  }

  if (loading) return null
  if (!data || (!data.duels.length && !data.coLoops.length && !data.circles.length && !data.creators.length)) {
    return null
  }

  const hasAny = (arr: unknown[]) => arr.length > 0

  return (
    <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/5 via-card/60 to-secondary/5 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground sm:text-lg">
            <Zap className="h-4 w-4 text-amber-400" />
            What can you participate in right now?
          </h2>
          <p className="text-xs text-muted-foreground">Live duels, open collaborations, growing communities and rising creators.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Active Duels */}
        {hasAny(data.duels) && (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Swords className="h-4 w-4 text-amber-400" /> Active Duels
              </h3>
              <Badge variant="secondary" className="text-[10px] font-bold">
                Voting live
              </Badge>
            </div>
            <div className="space-y-2">
              {data.duels.map((duel) => (
                <Link
                  key={duel.id}
                  href={`/loop/${duel.loop_id}`}
                  className="block rounded-xl border border-border/50 bg-muted/30 p-2.5 transition-all hover:border-amber-500/40 hover:bg-amber-500/5"
                >
                  <p className="line-clamp-1 text-xs font-semibold text-foreground">
                    “{duel.prompt}”
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500"
                        style={{ width: `${duel.percent_a}%` }}
                      />
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                        style={{ width: `${duel.percent_b}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                      {duel.percent_a}–{duel.percent_b}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="truncate">
                      by @{duel.creator?.username || "someone"} · {duel.total_votes} votes
                    </span>
                    <span className="font-semibold text-amber-500">Vote →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Open Co-Loops */}
        {hasAny(data.coLoops) && (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Rocket className="h-4 w-4 text-cyan-400" /> Open Co-Loops
              </h3>
              <Badge variant="secondary" className="text-[10px] font-bold">
                Created together
              </Badge>
            </div>
            <div className="space-y-2">
              {data.coLoops.map((loop) => (
                <Link
                  key={loop.id}
                  href={`/loop/${loop.id}`}
                  className="block rounded-xl border border-border/50 bg-muted/30 p-2.5 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/5"
                >
                  <p className="line-clamp-2 text-xs font-medium text-foreground">
                    {loop.content || "A collaborative loop"}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <span className="flex -space-x-1.5">
                        <Avatar className="h-4 w-4 border border-card">
                          <AvatarImage src={loop.author?.avatar_url} />
                          <AvatarFallback className="text-[8px]">
                            {loop.author?.display_name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </span>
                      {loop.co_author_count} collaborators
                    </span>
                    <span className="font-semibold text-cyan-500">View →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Growing Circles */}
        {hasAny(data.circles) && (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Users className="h-4 w-4 text-emerald-400" /> Growing Circles
              </h3>
              <Badge variant="secondary" className="text-[10px] font-bold">
                Find your people
              </Badge>
            </div>
            <div className="space-y-2">
              {data.circles.map((circle) => (
                <Link
                  key={circle.id}
                  href={`/circles/${circle.id}`}
                  className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/30 p-2.5 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5"
                >
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name} />
                    <AvatarFallback className="text-xs">{circle.name?.charAt(0) || "C"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{circle.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {circle.member_count} members{circle.category ? ` · ${circle.category}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Rising Creators */}
        {hasAny(data.creators) && (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <TrendingUp className="h-4 w-4 text-violet-400" /> Rising Creators
              </h3>
              <Badge variant="secondary" className="text-[10px] font-bold">
                Worth following
              </Badge>
            </div>
            <div className="space-y-2">
              {data.creators.map((creator) => (
                <div
                  key={creator.id}
                  className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/30 p-2.5 transition-all hover:border-violet-500/40"
                >
                  <Link href={`/profile/${creator.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage src={creator.avatar_url} alt={creator.display_name} />
                      <AvatarFallback className="text-xs">
                        {(creator.display_name || creator.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">
                        {creator.display_name || creator.username}
                        {creator.is_verified && (
                          <VerifiedSeal size={12} title="Verified Creator" className="ml-1" />
                        )}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        @{creator.username}
                        {creator.followers_count ? ` · ${creator.followers_count} followers` : ""}
                      </p>
                    </div>
                  </Link>
                  <Button
                    size="sm"
                    variant={following.has(creator.id) ? "secondary" : "outline"}
                    className="shrink-0 rounded-full text-[10px] h-7 px-2.5"
                    disabled={following.has(creator.id)}
                    onClick={() => handleFollow(creator)}
                  >
                    {following.has(creator.id) ? <Check className="h-3 w-3" /> : "Follow"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
