"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Code, Coins, GitFork, Star, Trophy, Wrench } from "lucide-react"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { Spinner } from "@/components/ui/skeletons"

interface LeaderboardRow {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_verified: boolean
  is_available_for_hire: boolean
  hourly_rate: number | null
  stats: {
    stars: number
    forks: number
    projects: number
    snippet_likes: number
    snippets: number
  }
  score: number
}

const MEDALS = [
  { ring: "border-amber-400/60 bg-amber-400/10 text-amber-500", label: "1st" },
  { ring: "border-slate-300/60 bg-slate-300/10 text-slate-400", label: "2nd" },
  { ring: "border-orange-400/50 bg-orange-400/10 text-orange-400", label: "3rd" },
]

function formatNumber(num: number) {
  if (num >= 1000) return (num / 1000).toFixed(1) + "K"
  return num.toString()
}

export function DeveloperLeaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/developers/leaderboard", { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to load leaderboard")
        if (!cancelled) setRows(data.leaderboard || [])
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Couldn't load leaderboard")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" /> Ranking top developers…
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <Trophy className="h-9 w-9 text-muted-foreground" />
          <p className="font-medium">The leaderboard is empty</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Publish projects and snippets to start climbing the ranks.
          </p>
        </CardContent>
      </Card>
    )
  }

  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <div className="space-y-4">
      {/* Podium */}
      <div className="grid gap-3 sm:grid-cols-3">
        {podium.map((row, i) => {
          const medal = MEDALS[i]
          return (
            <Card
              key={row.id}
              className={cn(
                "relative overflow-hidden border transition hover:-translate-y-0.5",
                i === 0
                  ? "border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-card to-transparent"
                  : "border-border/70 bg-card",
              )}
            >
              <CardContent className="flex flex-col items-center gap-2 p-5 text-center">
                <span
                  className={cn(
                    "absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold",
                    medal.ring,
                  )}
                >
                  {medal.label}
                </span>
                {i === 0 && <Trophy className="h-6 w-6 text-amber-400" />}
                <Link href={`/profile/${row.username}`} className="group">
                  <VideoAvatar
                    src={row.avatar_url}
                    videoSrc={(row as any).video_avatar_url}
                    isPremium={(row as any).is_premium}
                    fallback={(row.display_name || "D").charAt(0)}
                    size="lg"
                    className={cn("h-16 w-16 border-2 shrink-0 rounded-full", i === 0 ? "border-amber-400/60" : "border-border")}
                  />
                </Link>
                <div>
                  <p className="font-semibold leading-tight">{row.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{row.username}</p>
                </div>
                {row.is_available_for_hire && (
                  <Badge className="gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Wrench className="h-3 w-3" /> Open to work
                  </Badge>
                )}
                <p className="flex items-center gap-1 text-sm font-bold">
                  <Star className="h-4 w-4 text-yellow-500" />
                  {formatNumber(row.stats.stars)} stars
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.stats.projects} project{row.stats.projects === 1 ? "" : "s"} ·{" "}
                  {row.stats.snippets} snippet{row.stats.snippets === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Rest of the ranking */}
      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          {rest.map((row, i) => (
            <Link
              key={row.id}
              href={`/profile/${row.username}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/40"
            >
              <span className="w-8 shrink-0 text-center text-sm font-bold text-muted-foreground">
                {i + 4}
              </span>
              <VideoAvatar
                src={row.avatar_url}
                videoSrc={(row as any).video_avatar_url}
                isPremium={(row as any).is_premium}
                fallback={(row.display_name || "D").charAt(0)}
                size="md"
                className="h-10 w-10 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {row.display_name}
                  {row.is_verified && (
                    <VerifiedSeal size={14} title="Verified Creator" />
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{row.username}
                  {row.is_available_for_hire && <span className="text-emerald-500"> · open to work</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-yellow-500" />
                  {formatNumber(row.stats.stars)}
                </span>
                <span className="hidden items-center gap-1 sm:flex">
                  <GitFork className="h-3.5 w-3.5" />
                  {formatNumber(row.stats.forks)}
                </span>
                <span className="hidden items-center gap-1 sm:flex">
                  <Code className="h-3.5 w-3.5" />
                  {row.stats.projects}
                </span>
                {row.hourly_rate ? (
                  <span className="hidden items-center gap-1 md:flex">
                    <Coins className="h-3.5 w-3.5 text-yellow-500" />${row.hourly_rate}/hr
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Ranked by stars earned ×3 + snippet likes ×2 + forks + projects + snippets. Fresh every visit.
      </p>
    </div>
  )
}
