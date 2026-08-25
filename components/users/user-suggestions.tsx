"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, Users, RefreshCw } from "lucide-react"
import { UserBadges } from "@/components/user-badge"

interface Suggestion {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  video_avatar_url?: string | null
  is_verified?: boolean
  is_team_member?: boolean
  is_sponsor?: boolean
  is_premium?: boolean
  is_organization?: boolean
  organization_badge_url?: string
  organization_name?: string
  bio?: string
  reason?: string
  shared_interests?: number
}

export function UserSuggestions({
  title = "Who to follow",
  limit = 6,
  compact = false,
}: {
  title?: string
  limit?: number
  compact?: boolean
}) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<Record<string, boolean>>({})

  const load = async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`/api/users/suggestions?limit=${limit}`, {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await response.json()
      if (response.ok) setSuggestions(data.suggestions || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleFollow = async (targetId: string) => {
    if (!user) return
    setFollowing((prev) => ({ ...prev, [targetId]: true }))
    try {
      const response = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: targetId, action: "follow" }),
      })
      if (!response.ok) throw new Error("Follow failed")
      setSuggestions((prev) => prev.filter((item) => item.id !== targetId))
      toast({ title: "Following", description: "Creator added to your feed." })
    } catch {
      setFollowing((prev) => ({ ...prev, [targetId]: false }))
      toast({ title: "Could not follow", variant: "destructive" })
    }
  }

  if (!user) return null

  return (
    <section className={compact ? "space-y-3" : "rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur"}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" />
          {title}
        </h3>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void load()} aria-label="Refresh suggestions">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No new suggestions right now. Check back soon.</p>
      ) : (
        <div className="space-y-3">
          {suggestions.map((person) => (
            <div key={person.id} className="flex items-center justify-between gap-3">
              <Link href={`/profile/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <VideoAvatar
                  src={person.avatar_url}
                  videoSrc={person.video_avatar_url}
                  alt={person.display_name}
                  fallback={person.display_name?.charAt(0) || "?"}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">{person.display_name}</p>
                    <UserBadges
                      is_verified={person.is_verified}
                      is_team_member={person.is_team_member}
                      is_sponsor={person.is_sponsor}
                      is_organization={person.is_organization}
                      organization_badge_url={person.organization_badge_url}
                      organization_name={person.organization_name}
                      username={person.username}
                      size="sm"
                    />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
                  {!compact && person.reason && (
                    <p className="truncate text-[11px] text-muted-foreground/80">{person.reason}</p>
                  )}
                </div>
              </Link>
              <Button
                size="sm"
                className="shrink-0 rounded-full"
                disabled={following[person.id]}
                onClick={() => handleFollow(person.id)}
              >
                <UserPlus className="mr-1 h-3.5 w-3.5" />
                {following[person.id] ? "..." : "Follow"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
