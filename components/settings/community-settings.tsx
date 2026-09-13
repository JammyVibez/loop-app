"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { Crown, Shield, Users, Settings, ArrowUpRight } from "lucide-react"

interface CommunityRow {
  id: string | number
  name: string
  avatar_url?: string | null
  member_count?: number
  user_role?: string
  membership_status?: string | null
  is_private?: boolean
}

export function CommunitySettings() {
  const { user, getAuthHeader } = useAuth()
  const [communities, setCommunities] = useState<CommunityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/circles?joined=true&limit=50", { headers: { ...getAuthHeader() } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load your communities")
      setCommunities(data.circles || [])
    } catch (e: any) {
      setError(e.message || "Failed to load your communities")
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeader])

  useEffect(() => {
    load()
  }, [load])

  if (!user) {
    return <p className="text-muted-foreground">Sign in to manage your community preferences.</p>
  }

  const roleBadge = (role?: string) => {
    if (role === "owner")
      return (
        <Badge className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Crown className="h-2.5 w-2.5" /> Owner
        </Badge>
      )
    if (role === "admin")
      return (
        <Badge className="gap-1 border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <Crown className="h-2.5 w-2.5" /> Admin
        </Badge>
      )
    if (role === "moderator")
      return (
        <Badge className="gap-1 border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Shield className="h-2.5 w-2.5" /> Moderator
        </Badge>
      )
    return null
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your communities</CardTitle>
          <CardDescription>
            Communities you've joined, with your role. Owners and admins can manage their community from its page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : communities.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">You haven't joined any communities yet.</p>
              <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
                <Link href="/communities">
                  <Users className="mr-1.5 h-3.5 w-3.5" /> Discover communities
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {communities.map((c) => (
                <Link
                  key={String(c.id)}
                  href={`/communities/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition hover:bg-muted/40"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={c.avatar_url || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs text-white">
                      {c.name?.charAt(0)?.toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      {roleBadge(c.user_role)}
                      {c.is_private && (
                        <Badge variant="outline" className="text-[9px]">
                          Private
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {typeof c.member_count === "number" ? `${c.member_count.toLocaleString()} members` : "Community"}
                    </p>
                  </div>
                  {(c.user_role === "owner" || c.user_role === "admin") && (
                    <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Community preferences</CardTitle>
          <CardDescription>Quick toggles that shape your community experience across Loop.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
            <div>
              <p className="text-sm font-medium">Community invites</p>
              <p className="text-xs text-muted-foreground">Allow members to invite you to their communities</p>
            </div>
            <Badge variant="secondary">Managed in Alerts</Badge>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
            <div>
              <p className="text-sm font-medium">Mentions in communities</p>
              <p className="text-xs text-muted-foreground">Get notified when someone @mentions you in a post or chat</p>
            </div>
            <Badge variant="secondary">Managed in Alerts</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Moderation tools for each community live inside that community's Admin Panel (crown icon on the community page).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
