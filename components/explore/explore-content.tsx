"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, TreePine, Sparkles, TrendingUp, Hash, Loader2, RefreshCw } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { normalizeLoops, type NormalizedLoop } from "@/lib/normalize-loop"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

import { GlobalEventsHub } from "@/components/events/global-events-hub"
import { GlobalEventBanner } from "@/components/events/global-event-banner"
import { Calendar } from "lucide-react"

type ExploreTab = "events" | "recent" | "deepest" | "creative" | "hashtags"

interface TrendingHashtag {
  tag: string
  usage_count?: number
  count?: number
  growth?: string | number
}

export function ExploreContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loops, setLoops] = useState<NormalizedLoop[]>([])
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<ExploreTab>("recent")
  const [interacting, setInteracting] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  const authToken = user?.access_token || user?.token || ""

  const fetchExplore = useCallback(async (tab: ExploreTab = selectedTab, silent = false) => {
    if (!silent) setLoading(true)
    try {
      if (tab === "hashtags") {
        const response = await fetch("/api/explore/trending?type=hashtags&limit=24", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Failed to load hashtags")
        const rows: TrendingHashtag[] = data.hashtags || data.data || []
        setHashtags(rows)
        setLoops([])
        return
      }

      const sort = tab === "deepest" ? "deepest" : tab === "creative" ? "creative" : "recent"
      const response = await fetch(`/api/explore/trending?type=loops&sort=${sort}&limit=24`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to load explore")
      setLoops(normalizeLoops(data.loops || data.data || []))
      setHashtags([])
    } catch (error: any) {
      console.error("Explore fetch error:", error)
      if (!silent) {
        toast({
          title: "Could not load explore",
          description: error?.message || "Please try again",
          variant: "destructive",
        })
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [authToken, selectedTab, toast])

  useEffect(() => {
    void fetchExplore(selectedTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab, authToken])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const refresh = () => void fetchExplore(selectedTab, true)

    const loopsChannel = supabase
      .channel("explore:loops")
      .on("postgres_changes", { event: "*", schema: "public", table: "loops" }, refresh)
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") setLive(true)
      })

    const interactionsChannel = supabase
      .channel("explore:loop_interactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "loop_interactions" }, refresh)
      .subscribe()

    const commentsChannel = supabase
      .channel("explore:comments")
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, refresh)
      .subscribe()

    const poll = setInterval(refresh, 20000)

    return () => {
      supabase.removeChannel(loopsChannel)
      supabase.removeChannel(interactionsChannel)
      supabase.removeChannel(commentsChannel)
      clearInterval(poll)
      setLive(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab, authToken])

  const handleInteraction = async (loopId: string, type: "like" | "save") => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Log in to like, save, gift, and branch loops.",
        variant: "destructive",
      })
      return
    }

    setInteracting(`${loopId}-${type}`)
    try {
      const response = await fetch(`/api/loops/${loopId}/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ interaction_type: type }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Interaction failed")
      }

      setLoops((prev) =>
        prev.map((loop) => {
          if (loop.id !== loopId) return loop
          const next = { ...loop, user_interactions: { ...loop.user_interactions }, stats: { ...loop.stats } }
          if (type === "like") {
            const liked = Boolean(data.is_liked ?? data.is_active)
            next.user_interactions.is_liked = liked
            next.stats.likes_count = Math.max(
              0,
              next.stats.likes_count + (liked ? 1 : -1),
            )
            if (data.stats?.likes_count != null) next.stats.likes_count = Number(data.stats.likes_count)
          }
          if (type === "save") {
            next.user_interactions.is_saved = Boolean(data.is_saved ?? data.is_active)
          }
          return next
        }),
      )
    } catch (error: any) {
      toast({
        title: "Could not update",
        description: error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setInteracting(null)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return String(num)
  }

  const renderLoops = (items: NormalizedLoop[], emptyLabel: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading loops…
        </div>
      )
    }

    if (items.length === 0) {
      return <EmptyState title={emptyLabel} icon={<Sparkles className="h-6 w-6" />} />
    }

    return (
      <div className="space-y-4">
        {items.map((loop) => (
          <LoopCard
            key={loop.id}
            loop={loop}
            interacting={interacting}
            onInteraction={handleInteraction}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <GlobalEventBanner />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-flex h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} />
          {live ? "Live updates connected" : "Refreshing every 20s"}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void fetchExplore(selectedTab)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as ExploreTab)} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1 sm:grid-cols-5">
          <TabsTrigger value="events" className="rounded-xl">
            <Calendar className="mr-1.5 h-4 w-4 text-cyan-400" />
            Global Events
          </TabsTrigger>
          <TabsTrigger value="recent" className="rounded-xl">
            <Clock className="mr-1.5 h-4 w-4" />
            Recent
          </TabsTrigger>
          <TabsTrigger value="deepest" className="rounded-xl">
            <TreePine className="mr-1.5 h-4 w-4" />
            Deepest
          </TabsTrigger>
          <TabsTrigger value="creative" className="rounded-xl">
            <Sparkles className="mr-1.5 h-4 w-4" />
            Creative
          </TabsTrigger>
          <TabsTrigger value="hashtags" className="rounded-xl">
            <Hash className="mr-1.5 h-4 w-4" />
            Hashtags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-6">
          <GlobalEventsHub />
        </TabsContent>

        <TabsContent value="recent" className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Recent Loops</h2>
            <Badge variant="secondary">Newest first</Badge>
          </div>
          {renderLoops(loops, "No recent loops yet")}
        </TabsContent>

        <TabsContent value="deepest" className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <TreePine className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-semibold">Deepest Trees</h2>
            <Badge variant="secondary">Most branches</Badge>
          </div>
          {renderLoops(loops, "No branched trees yet")}
        </TabsContent>

        <TabsContent value="creative" className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold">Most Creative</h2>
            <Badge variant="secondary">Highest engagement</Badge>
          </div>
          {renderLoops(loops, "No creative loops yet")}
        </TabsContent>

        <TabsContent value="hashtags" className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Trending Hashtags</h2>
            <Badge variant="secondary">Live</Badge>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading hashtags…
            </div>
          ) : hashtags.length === 0 ? (
            <EmptyState title="No hashtags trending yet" icon={<Hash className="h-6 w-6" />} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {hashtags.map((hashtag, index) => {
                const count = Number(hashtag.usage_count ?? hashtag.count ?? 0)
                return (
                  <Link key={hashtag.tag} href={`/hashtag/${encodeURIComponent(hashtag.tag)}`}>
                    <Card className="transition hover:bg-muted/40">
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                            <Hash className="h-5 w-5 text-primary" />
                          </div>
                          <Badge variant="secondary" className="gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {hashtag.growth ?? "hot"}
                          </Badge>
                        </div>
                        <h3 className="text-lg font-bold text-primary">#{hashtag.tag}</h3>
                        <p className="text-sm text-muted-foreground">{formatNumber(count)} loops</p>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
