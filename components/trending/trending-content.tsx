"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserBadges } from "@/components/user-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { TrendingUp, Hash, Users, GitBranch, RefreshCw } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { useAuth } from "@/hooks/use-auth"
import { stripCircleBioTokens } from "@/lib/circle-bio-tokens"

interface TrendingHashtag {
  tag: string
  usage_count: number
  count: number
}

interface TrendingUser {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
  is_premium?: boolean
  is_organization?: boolean
  organization_badge_url?: string
  organization_name?: string
  bio?: string
  followers_count?: number
  loops_count?: number
}

const TIMEFRAMES = [
  { id: "1h", label: "Last Hour", days: 1 },
  { id: "24h", label: "24 Hours", days: 1 },
  { id: "7d", label: "7 Days", days: 7 },
  { id: "30d", label: "30 Days", days: 30 },
]

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
  if (num >= 1000) return (num / 1000).toFixed(1) + "K"
  return String(num)
}

export function TrendingContent() {
  const { getAuthHeader } = useAuth()
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h")
  const [activeTab, setActiveTab] = useState("hashtags")

  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([])
  const [loops, setLoops] = useState<any[]>([])
  const [users, setUsers] = useState<TrendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const days = TIMEFRAMES.find((t) => t.id === selectedTimeframe)?.days || 7
    try {
      const [hashtagsRes, loopsRes, usersRes] = await Promise.all([
        fetch(`/api/explore/trending?type=hashtags&days=${days}&limit=12`),
        fetch(`/api/explore/trending?type=loops&sort=creative&limit=8`, { headers: { ...getAuthHeader() } }),
        fetch(`/api/explore/trending?type=users&limit=9`),
      ])

      const failures: string[] = []
      if (hashtagsRes.ok) {
        const data = await hashtagsRes.json()
        setHashtags(data.data || data.hashtags || [])
      } else failures.push("hashtags")
      if (loopsRes.ok) {
        const data = await loopsRes.json()
        setLoops(data.data || data.loops || [])
      } else failures.push("Loops")
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.data || [])
      } else failures.push("creators")
      if (failures.length) setError(`Couldn’t load ${failures.join(", ")}. Try again.`)
      else setLastUpdated(new Date())
    } catch (err) {
      console.error("Failed to load trending data:", err)
      setError("Couldn't load trending right now. Try again in a moment.")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, selectedTimeframe])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      {/* Timeframe Selector */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Trending</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">What people are into</h1>
          {lastUpdated ? <p className="mt-1 text-[11px] text-muted-foreground">Updated {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p> : null}
        </div>
        <Tabs value={selectedTimeframe} onValueChange={setSelectedTimeframe} className="w-auto">
          <TabsList className="w-full sm:w-auto">
            {TIMEFRAMES.map((tf) => (
              <TabsTrigger key={tf.id} value={tf.id}>
                {tf.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-muted-foreground">
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="hashtags" className="flex items-center space-x-2">
            <Hash className="w-4 h-4" />
            <span>Hashtags</span>
          </TabsTrigger>
          <TabsTrigger value="loops" className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4" />
            <span>Loops</span>
          </TabsTrigger>
          <TabsTrigger value="creators" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Creators</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hashtags" className="mt-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading trending hashtags…</div>
          ) : hashtags.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No trending hashtags yet. Be the first to start one!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hashtags.map((hashtag, index) => (
                <Link key={hashtag.tag} href={`/hashtag/${encodeURIComponent(hashtag.tag)}`}>
                  <Card className="h-full cursor-pointer rounded-2xl border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                          <Hash className="w-5 h-5 text-primary" />
                        </div>
                        <Badge variant="secondary" className="bg-success-surface text-success">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Live
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold text-foreground">#{hashtag.tag}</h3>
                      <p className="text-sm text-muted-foreground">{formatNumber(hashtag.usage_count || hashtag.count)} loops</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="loops" className="mt-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading trending loops…</div>
          ) : loops.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No trending loops yet.{" "}
              <Link href="/create" className="font-medium text-primary underline">
                Create the first one
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {loops.map((loop, index) => (
                <div key={loop.id} className="relative">
                  <div className="absolute left-2 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-primary/20 bg-background text-xs font-semibold text-primary shadow-sm sm:left-2">
                    #{index + 1}
                  </div>
                  <div className="ml-0 pl-10">
                    <LoopCard loop={loop} />
                    {loop.hashtags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {loop.hashtags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="border-primary/25 text-primary">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="creators" className="mt-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading trending creators…</div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No creators to show yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((user, index) => (
                <Link key={user.id} href={`/profile/${user.username}`}>
                  <Card className="h-full rounded-2xl border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                          <VideoAvatar src={user.avatar_url} className="w-12 h-12" fallback={(user.display_name || user.username).charAt(0).toUpperCase()} />
                        </div>
                        {(user.followers_count || 0) > 0 && (
                          <Badge variant="secondary" className="bg-warning-surface text-warning">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Trending
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold">{user.display_name || user.username}</h3>
                          <UserBadges
                            is_verified={user.is_verified}
                            is_premium={user.is_premium}
                            is_organization={user.is_organization}
                            organization_badge_url={user.organization_badge_url}
                            organization_name={user.organization_name}
                            username={user.username}
                            size="sm"
                          />
                        </div>
                        <p className="text-muted-foreground text-sm">@{user.username}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="font-bold text-lg">{formatNumber(user.followers_count || 0)}</div>
                          <div className="text-sm text-muted-foreground">Followers</div>
                        </div>
                        <div>
                          <div className="font-bold text-lg">{formatNumber(user.loops_count || 0)}</div>
                          <div className="text-sm text-muted-foreground">Loops</div>
                        </div>
                      </div>

                      {user.bio && (
                        <div className="rounded-lg bg-muted/70 p-3">
                          <p className="line-clamp-2 text-sm font-medium text-foreground">
                            {stripCircleBioTokens(user.bio)}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
