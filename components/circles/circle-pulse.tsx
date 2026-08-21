"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  MessageSquare,
  Calendar,
  Users,
  Trophy,
  Loader2,
  ArrowRight,
} from "lucide-react"

interface PulseCircle {
  id: string
  name: string
  description?: string
  avatar_url?: string
  category?: string
  member_count: number
  new_posts: number
  new_comments: number
  upcoming_events: Array<{ id: string; title: string; starts_at: string }>
  activity: number
  milestone?: {
    reached: number
    next: number | null
    progress: number
  } | null
}

/**
 * "Things are happening here" — a live pulse strip for the signed-in user's
 * circles on /circles. Shows real 24h activity (posts, replies, events) and
 * member milestones. Renders nothing when there is no activity.
 */
export function CirclePulse() {
  const { user, getAuthHeader } = useAuth()
  const [circles, setCircles] = useState<PulseCircle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    fetch("/api/circles/pulse", { headers: getAuthHeader(), cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setCircles(data?.circles || [])
      })
      .catch(() => {
        if (mounted) setCircles([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (loading || !user || !circles.length) return null

  const totalActivity = circles.reduce((sum, c) => sum + c.activity, 0)

  return (
    <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-card/60 to-purple-950/20 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground sm:text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
            </span>
            Things are happening in your circles
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalActivity} new posts &amp; replies across {circles.length} circle
            {circles.length > 1 ? "s" : ""} in the last 24 hours
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {circles.slice(0, 6).map((circle) => (
          <Link
            key={circle.id}
            href={`/circles/${circle.id}`}
            className="group rounded-2xl border border-border/60 bg-card/80 p-3 transition-all hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-950/20"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name} />
                <AvatarFallback className="text-sm">{circle.name?.charAt(0) || "C"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground group-hover:text-cyan-500">
                  {circle.name}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {circle.member_count} member
                  {circle.member_count !== 1 ? "s" : ""}
                  {circle.category ? ` · ${circle.category}` : ""}
                </p>
              </div>
              {circle.activity > 0 && (
                <Badge className="bg-cyan-500/15 text-cyan-500 text-[10px] font-bold border border-cyan-500/30">
                  {circle.activity} new
                </Badge>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {circle.new_posts > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 font-semibold text-foreground/80">
                  <MessageSquare className="h-3 w-3 text-cyan-400" /> {circle.new_posts} posts
                </span>
              )}
              {circle.new_comments > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 font-semibold text-foreground/80">
                  <MessageSquare className="h-3 w-3 text-purple-400" /> {circle.new_comments} replies
                </span>
              )}
              {circle.upcoming_events.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 font-semibold text-foreground/80">
                  <Calendar className="h-3 w-3 text-amber-400" /> {circle.upcoming_events.length} event
                  {circle.upcoming_events.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {circle.milestone?.reached && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[10px] font-semibold">
                  <span className="flex items-center gap-1 text-amber-500">
                    <Trophy className="h-3 w-3" /> Milestone: {circle.milestone.reached} members
                  </span>
                  {circle.milestone.next && (
                    <span className="text-muted-foreground">
                      {circle.member_count}/{circle.milestone.next}
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-500"
                    style={{ width: `${circle.milestone.progress}%` }}
                  />
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>

      <Link
        href="/circles?tab=my-circles"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-500 hover:underline"
      >
        View all my communities <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  )
}
