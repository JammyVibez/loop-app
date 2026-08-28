"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import {
  Zap,
  UserPlus,
  UserMinus,
  Calendar,
  MessageSquare,
  Trophy,
  Star,
  Hash,
  Video,
  ArrowRight,
  Sparkles,
} from "lucide-react"

interface ActivityFeedProps {
  circleId: string
}

interface ActivityItem {
  id: string
  activity_type: string
  target_type?: string
  target_id?: string
  metadata?: any
  created_at: string
  actor: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_premium?: boolean
    is_verified?: boolean
    level?: number
  }
}

const ACTIVITY_ICONS: Record<string, any> = {
  post_created: Hash,
  member_joined: UserPlus,
  member_left: UserMinus,
  event_created: Calendar,
  event_rsvp: Calendar,
  badge_earned: Trophy,
  message_sent: MessageSquare,
  room_created: Star,
  milestone_reached: Sparkles,
  coloop_started: Video,
}

const ACTIVITY_COLORS: Record<string, string> = {
  post_created: "bg-cyan-500/10 text-cyan-400",
  member_joined: "bg-emerald-500/10 text-emerald-400",
  member_left: "bg-rose-500/10 text-rose-400",
  event_created: "bg-violet-500/10 text-violet-400",
  event_rsvp: "bg-violet-500/10 text-violet-400",
  badge_earned: "bg-amber-500/10 text-amber-400",
  message_sent: "bg-blue-500/10 text-blue-400",
  room_created: "bg-indigo-500/10 text-indigo-400",
  milestone_reached: "bg-pink-500/10 text-pink-400",
  coloop_started: "bg-orange-500/10 text-orange-400",
}

const ACTIVITY_LABELS: Record<string, string> = {
  post_created: "created a post",
  member_joined: "joined the circle",
  member_left: "left the circle",
  event_created: "created an event",
  event_rsvp: "RSVP'd to an event",
  badge_earned: "earned a badge",
  message_sent: "sent a message",
  room_created: "created a room",
  milestone_reached: "reached a milestone",
  coloop_started: "started a Co-Loop session",
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffH < 24) return `${diffH}h ago`
  if (diffD < 7) return `${diffD}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function groupByTimePeriod(items: ActivityItem[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const thisWeek = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: ActivityItem[] }[] = []
  let currentGroup: ActivityItem[] = []

  const todayItems = items.filter((i) => new Date(i.created_at) >= today)
  const yesterdayItems = items.filter((i) => new Date(i.created_at) >= yesterday && new Date(i.created_at) < today)
  const thisWeekItems = items.filter((i) => new Date(i.created_at) >= thisWeek && new Date(i.created_at) < yesterday)
  const olderItems = items.filter((i) => new Date(i.created_at) < thisWeek)

  if (todayItems.length) groups.push({ label: "Today", items: todayItems })
  if (yesterdayItems.length) groups.push({ label: "Yesterday", items: yesterdayItems })
  if (thisWeekItems.length) groups.push({ label: "This Week", items: thisWeekItems })
  if (olderItems.length) groups.push({ label: "Earlier", items: olderItems })

  return groups
}

export function CircleActivityFeed({ circleId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const { getAuthHeader } = useAuth()

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(`/api/circles/${circleId}/activity?limit=30`, {
          headers: getAuthHeader(),
        })
        const data = await res.json()
        if (data.success) setActivities(data.activities || [])
      } catch (err) {
        console.error("Failed to load activity:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchActivities()
  }, [circleId, getAuthHeader])

  if (loading) {
    return (
      <Card className="border-border bg-card rounded-3xl">
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-48 rounded bg-muted" />
                <div className="h-2 w-24 rounded bg-muted/60" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="border-border bg-card rounded-3xl">
        <CardContent className="p-10 text-center space-y-3">
          <Zap className="mx-auto h-10 w-10 text-cyan-400 opacity-50" />
          <p className="text-sm font-bold text-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground">Posts, joins, events, and milestones will show up here.</p>
        </CardContent>
      </Card>
    )
  }

  const groups = groupByTimePeriod(activities)

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">{group.label}</h3>
          <div className="relative space-y-1">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

            {group.items.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.activity_type] || Zap
              const colorClass = ACTIVITY_COLORS[activity.activity_type] || "bg-muted text-muted-foreground"
              const label = ACTIVITY_LABELS[activity.activity_type] || activity.activity_type

              return (
                <div
                  key={activity.id}
                  className="relative flex items-start gap-3 py-3 px-4 rounded-2xl hover:bg-muted/40 transition-colors group"
                >
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass} ring-4 ring-card`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <VideoAvatar
                        src={activity.actor.avatar_url}
                        className="h-6 w-6"
                        fallback={activity.actor.display_name?.charAt(0) || "?"}
                        fallbackClassName="text-[10px]"
                      />
                      <Link
                        href={`/profile/${activity.actor.username}`}
                        className="text-sm font-bold text-foreground hover:text-cyan-400 transition-colors truncate"
                      >
                        {activity.actor.display_name || activity.actor.username}
                      </Link>
                      {activity.actor.is_verified && (
                        <Badge className="h-4 px-1 bg-blue-500/15 text-blue-400 border-0 text-[9px]">✓</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>

                    {/* Metadata preview */}
                    {activity.metadata?.title && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">&ldquo;{activity.metadata.title}&rdquo;</p>
                    )}
                    {activity.metadata?.badge_name && (
                      <Badge className="mt-1 bg-amber-500/10 text-amber-400 border-0 text-[10px]">
                        {activity.metadata.badge_icon || "⭐"} {activity.metadata.badge_name}
                      </Badge>
                    )}
                  </div>

                  <span className="text-[10px] text-muted-foreground shrink-0 mt-1">
                    {formatTimeAgo(activity.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
