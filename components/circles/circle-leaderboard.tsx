"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  Trophy,
  Crown,
  Flame,
  Target,
  MessageSquare,
  Calendar,
  Zap,
  Star,
  Award,
  TrendingUp,
  Medal,
} from "lucide-react"

interface LeaderboardProps {
  circleId: string
  members: any[]
}

interface MemberStat {
  user_id: string
  posts_count: number
  reactions_received: number
  reactions_given: number
  comments_made: number
  events_attended: number
  messages_sent: number
  current_streak: number
  longest_streak: number
  total_contribution_score: number
  earned_badges: string[]
  profile?: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    video_avatar_url?: string
    is_premium?: boolean
    is_verified?: boolean
  }
}

interface BadgeData {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  requirement_type: string
  requirement_value: number
  rarity: string
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  rare: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  epic: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  legendary: "bg-amber-500/15 text-amber-300 border-amber-500/30",
}

const STAT_ICONS: Record<string, any> = {
  posts_count: MessageSquare,
  events_attended: Calendar,
  current_streak: Flame,
  total_contribution_score: Zap,
  reactions_received: Star,
}

function formatScore(score: number) {
  if (score >= 1000) return `${(score / 1000).toFixed(1)}K`
  return String(score)
}

export function CircleLeaderboard({ circleId, members }: LeaderboardProps) {
  const [stats, setStats] = useState<MemberStat[]>([])
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"leaderboard" | "badges">("leaderboard")
  const [sortBy, setSortBy] = useState<string>("total_contribution_score")
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, badgesRes] = await Promise.all([
          fetch(`/api/circles/${circleId}/stats`, { headers: getAuthHeader() }).catch(() => ({ ok: false, json: () => ({ stats: [] }) })),
          fetch(`/api/circles/${circleId}/badges?user_id=${user?.id || ""}`, { headers: getAuthHeader() }).catch(() => ({ ok: false, json: () => ({ badges: [] }) })),
        ])

        const statsData = await statsRes.json()
        const badgesData = await badgesRes.json()

        // Enrich stats with profile data from members prop
        const profileMap = new Map(members.map((m: any) => [m.user_id || m.id, m]))
        const enrichedStats = (statsData.stats || []).map((s: MemberStat) => ({
          ...s,
          profile: s.profile || profileMap.get(s.user_id)?.profile || profileMap.get(s.user_id),
        }))

        setStats(enrichedStats)
        setBadges(badgesData.badges || [])
      } catch (err) {
        console.error("Failed to load leaderboard:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [circleId, getAuthHeader, members, user?.id])

  const sortedStats = [...stats].sort((a: any, b: any) => (b[sortBy] || 0) - (a[sortBy] || 0))

  const getRankBadge = (index: number) => {
    if (index === 0) return { icon: "🥇", class: "bg-amber-500/15 text-amber-300" }
    if (index === 1) return { icon: "🥈", class: "bg-slate-400/15 text-slate-300" }
    if (index === 2) return { icon: "🥉", class: "bg-orange-500/15 text-orange-300" }
    return { icon: `#${index + 1}`, class: "bg-muted text-muted-foreground" }
  }

  if (loading) {
    return (
      <Card className="border-border bg-card rounded-3xl">
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 h-4 bg-muted rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center gap-2 bg-muted/60 rounded-2xl p-1">
        <Button
          size="sm"
          variant={view === "leaderboard" ? "default" : "ghost"}
          onClick={() => setView("leaderboard")}
          className={`flex-1 rounded-xl text-xs font-bold ${view === "leaderboard" ? "bg-cyan-500 text-black" : ""}`}
        >
          <Trophy className="h-3.5 w-3.5 mr-1.5" /> Leaderboard
        </Button>
        <Button
          size="sm"
          variant={view === "badges" ? "default" : "ghost"}
          onClick={() => setView("badges")}
          className={`flex-1 rounded-xl text-xs font-bold ${view === "badges" ? "bg-cyan-500 text-black" : ""}`}
        >
          <Award className="h-3.5 w-3.5 mr-1.5" /> Badges ({badges.length})
        </Button>
      </div>

      {view === "leaderboard" ? (
        <>
          {/* Sort Options */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { key: "total_contribution_score", label: "Overall", icon: Zap },
              { key: "posts_count", label: "Posts", icon: MessageSquare },
              { key: "events_attended", label: "Events", icon: Calendar },
              { key: "current_streak", label: "Streak", icon: Flame },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-[10px] font-bold transition-all ${
                  sortBy === key
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>

          {/* Top 3 Highlight */}
          {sortedStats.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 0, 2].map((rank) => {
                const stat = sortedStats[rank]
                if (!stat) return null
                const profile = stat.profile
                const isTop = rank === 0
                return (
                  <Card
                    key={stat.user_id}
                    className={`text-center rounded-2xl border ${
                      isTop ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
                    } ${isTop ? "scale-105 shadow-lg shadow-amber-950/20" : ""}`}
                  >
                    <CardContent className={`p-4 ${isTop ? "pt-5" : ""}`}>
                      <div className="text-2xl mb-1">{rank === 0 ? "🥇" : rank === 1 ? "🥈" : "🥉"}</div>
                      <Link href={`/profile/${profile?.username || ""}`}>
                        <VideoAvatar
                          src={profile?.avatar_url}
                          videoSrc={profile?.video_avatar_url}
                          className={`mx-auto border-2 ${isTop ? "h-14 w-14 border-amber-400" : "h-11 w-11 border-border"}`}
                          fallback={profile?.display_name?.charAt(0) || "?"}
                        />
                      </Link>
                      <p className="text-xs font-bold mt-2 truncate">{profile?.display_name || "Member"}</p>
                      <p className="text-[10px] text-muted-foreground">{formatScore((stat as any)[sortBy] || 0)} pts</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Full List */}
          <div className="space-y-1">
            {sortedStats.map((stat, index) => {
              const profile = stat.profile
              const rank = getRankBadge(index)
              return (
                <div
                  key={stat.user_id}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${
                    index < 3 ? "bg-muted/40" : "hover:bg-muted/30"
                  }`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${rank.class}`}>
                    {rank.icon}
                  </div>
                  <Link href={`/profile/${profile?.username || ""}`} className="flex items-center gap-2 min-w-0 flex-1">
                    <VideoAvatar
                      src={profile?.avatar_url}
                      videoSrc={profile?.video_avatar_url}
                      className="h-8 w-8"
                      fallback={profile?.display_name?.charAt(0) || "?"}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold truncate">{profile?.display_name || "Member"}</span>
                        {profile?.is_verified && <Badge className="h-3.5 px-1 bg-blue-500/15 text-blue-400 border-0 text-[8px]">✓</Badge>}
                        {profile?.is_premium && <Crown className="h-3 w-3 text-amber-400" />}
                      </div>
                      {stat.current_streak > 0 && (
                        <span className="text-[10px] text-orange-400 font-semibold flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5" /> {stat.current_streak}d streak
                        </span>
                      )}
                    </div>
                  </Link>
                  <span className="text-xs font-black text-cyan-400 shrink-0">{formatScore((stat as any)[sortBy] || 0)}</span>
                </div>
              )
            })}
          </div>

          {sortedStats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="text-xs font-bold">No stats yet — be the first contributor!</p>
            </div>
          )}
        </>
      ) : (
        /* Badges View */
        <div className="space-y-3">
          {badges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="text-xs font-bold">No badges created yet</p>
              <p className="text-[10px] mt-1">Circle owners can create achievement badges.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {badges.map((badge) => {
                const isEarned = (stats.find((s) => s.user_id === user?.id)?.earned_badges || []).includes(badge.name)
                return (
                  <Card
                    key={badge.id}
                    className={`rounded-2xl border transition-all ${
                      isEarned
                        ? "border-amber-500/40 bg-amber-500/5 shadow-lg shadow-amber-950/20"
                        : "border-border bg-card opacity-70"
                    }`}
                  >
                    <CardContent className="p-4 text-center space-y-2">
                      <div className="text-3xl">{badge.icon}</div>
                      <p className="text-xs font-bold">{badge.name}</p>
                      {badge.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{badge.description}</p>
                      )}
                      <Badge className={`text-[9px] border ${RARITY_COLORS[badge.rarity] || RARITY_COLORS.common}`}>
                        {badge.rarity}
                      </Badge>
                      {isEarned && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px]">
                          ✓ Earned
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
