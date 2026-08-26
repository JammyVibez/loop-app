"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import { Users, MessageSquare, Calendar, ArrowRight, Loader2 } from "lucide-react"

interface CircleActivity {
  id: string
  name: string
  description?: string
  avatar_url?: string
  category?: string
  new_posts: number
  new_comments: number
  upcoming_events: number
  recent_posts?: Array<{
    id: string
    content: string
    created_at: string
    author?: { username?: string; display_name?: string; avatar_url?: string } | null
  }>
  activity: number
}

/**
 * "Your Circles are active" strip on the home feed — invites the signed-in
 * user back into communities that had real activity in the last 24h.
 * Renders nothing when there is no activity (never fabricates items).
 */
export function CircleActivityStrip() {
  const { user, getAuthHeader } = useAuth()
  const [circles, setCircles] = useState<CircleActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    fetch("/api/home/circle-activity", { headers: getAuthHeader(), cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        setCircles(data?.circles || [])
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

  if (loading || !circles.length) return null

  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500">
            <Users className="h-3.5 w-3.5" />
          </span>
          Your circles are active
        </h2>
        <Link
          href="/circles"
          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-500 hover:underline"
        >
          Open circles <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {circles.map((circle) => (
          <Link
            key={circle.id}
            href={`/circles/${circle.id}`}
            className="group rounded-xl border border-border/60 bg-muted/30 p-2.5 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/5"
          >
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={circle.avatar_url} alt={circle.name} />
                <AvatarFallback className="text-xs">{circle.name?.charAt(0) || "C"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground group-hover:text-cyan-500">
                  {circle.name}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {circle.new_posts > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-medium text-foreground/80">
                      <MessageSquare className="h-3 w-3" /> {circle.new_posts} new
                    </span>
                  )}
                  {circle.new_comments > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {circle.new_comments} replies
                    </Badge>
                  )}
                  {circle.upcoming_events > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-medium text-foreground/80">
                      <Calendar className="h-3 w-3" /> {circle.upcoming_events} event
                      {circle.upcoming_events > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {circle.recent_posts?.[0] && (
              <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                “{circle.recent_posts[0].content}”
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
