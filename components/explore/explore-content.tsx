"use client"

import { useCallback, useEffect, useState, type ComponentType } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Clock,
  GitBranch,
  TreePine,
  Zap,
  TrendingUp,
  Hash,
  RefreshCw,
  Users,
  Compass,
  Calendar,
} from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { normalizeLoops, type NormalizedLoop } from "@/lib/normalize-loop"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"

import { GlobalEventsHub } from "@/components/events/global-events-hub"
import { GlobalEventBanner } from "@/components/events/global-event-banner"
import { ParticipationDiscovery } from "@/components/explore/participation-discovery"
import { ExploreSearchAutocomplete } from "@/components/explore/explore-search-autocomplete"
import { Spinner } from "@/components/ui/skeletons"
import { ExploreSearchResults } from "@/components/explore/explore-search-results"
import { DiscoveryPreferencesPanel } from "@/components/explore/discovery-preferences-panel"

export type ExploreTab = "events" | "recent" | "personalized" | "following" | "community" | "deepest" | "creative" | "hashtags"

interface TrendingHashtag {
  tag: string
  usage_count?: number
  count?: number
  growth?: string | number
}

interface CollaborativeChain {
  id: string
  title: string
  description: string
  prompt: string
  kind: string
  creator_display_name: string
  creator_username: string
  contribution_count: number
  participant_count: number
  updated_at: string
}

function FeedHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-foreground/70">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

export function ExploreContent({ initialTab = "recent" }: { initialTab?: ExploreTab }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loops, setLoops] = useState<NormalizedLoop[]>([])
  const [chains, setChains] = useState<CollaborativeChain[]>([])
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<ExploreTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState("")
  const [interacting, setInteracting] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const authToken = user?.access_token || user?.token || ""

  const fetchExplore = useCallback(async (
    tab: ExploreTab = selectedTab,
    silent = false,
    offset = 0,
    append = false,
    preserveOffset = false,
  ) => {
    if (tab === "events") {
      if (!silent) setLoading(false)
      return
    }
    if (!silent && !append) setLoading(true)
    if (append && !silent) setLoadingMore(true)
    try {
      if (tab === "hashtags") {
        const response = await fetch("/api/explore/trending?type=hashtags&limit=24", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Failed to load hashtags")
        const rows: TrendingHashtag[] = data.hashtags || data.data || []
        setHashtags(rows)
        setLoops([])
        setChains([])
        setHasMore(false)
        setNextOffset(0)
        return
      }

      if (tab === "deepest") {
        const params = new URLSearchParams({ limit: "24", sort: "contributions" })
        const response = await fetch(`/api/v1/chains?${params.toString()}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          cache: "no-store",
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || data.error || "Failed to discover Chains")
        setChains(Array.isArray(data.chains) ? data.chains : [])
        setLoops([])
        setHashtags([])
        setHasMore(false)
        setNextOffset(0)
        return
      }

      const sort = tab === "creative" ? "creative"
        : tab === "personalized" ? "personalized"
          : tab === "following" ? "following"
            : tab === "community" ? "community"
              : "recent"
      const response = await fetch(`/api/explore/trending?type=loops&sort=${sort}&limit=24&offset=${offset}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to load explore")
      const incoming = normalizeLoops(data.loops || data.data || [])
      setLoops((previous) => {
        if (!append) return incoming
        const merged = new Map(previous.map((loop) => [loop.id, loop]))
        for (const loop of incoming) merged.set(loop.id, loop)
        return [...merged.values()]
      })
      setHasMore(data.pagination?.has_more === true)
      if (!preserveOffset) {
        setNextOffset(Number.isFinite(data.pagination?.next_offset)
          ? Number(data.pagination.next_offset)
          : offset + incoming.length)
      }
      setChains([])
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
      if (!silent && !append) setLoading(false)
      if (append && !silent) setLoadingMore(false)
    }
  }, [authToken, selectedTab, toast])

  useEffect(() => {
    void fetchExplore(selectedTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab, authToken])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const refresh = () => void fetchExplore(selectedTab, true, 0, true, true)

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

  const renderLoadMore = () => hasMore ? (
    <div className="flex justify-center pt-2">
      <Button
        variant="outline"
        size="sm"
        className="min-w-36 rounded-full text-xs"
        disabled={loadingMore || loading}
        onClick={() => void fetchExplore(selectedTab, false, nextOffset, true)}
      >
        {loadingMore ? <Spinner className="mr-2 h-3.5 w-3.5" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
        {loadingMore ? "Loading…" : "Load more"}
      </Button>
    </div>
  ) : null

  const renderLoops = (items: NormalizedLoop[], emptyLabel: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-14 text-sm text-muted-foreground">
          <Spinner className="mr-2 h-5 w-5" />
          Loading loops…
        </div>
      )
    }

    if (items.length === 0) {
      return <EmptyState title={emptyLabel} icon={<Zap className="h-6 w-6" />} />
    }

    return (
      <div className="space-y-2.5">
        {items.map((loop) => (
          <div key={loop.id} className="space-y-1.5">
            {loop.discovery_reason && (
              <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
                <Compass className="h-3 w-3 shrink-0 text-primary" />
                <span>{loop.discovery_reason}</span>
              </div>
            )}
            <LoopCard
              loop={loop}
              interacting={interacting}
              onInteraction={handleInteraction}
            />
          </div>
        ))}
      </div>
    )
  }

  const liveIndicator = (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} />
        {live ? "Live" : "Auto-refresh"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-full px-2 text-[10px] text-muted-foreground"
        onClick={() => void fetchExplore(selectedTab)}
      >
        <RefreshCw className="mr-1 h-3 w-3" />
        Refresh
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Search hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="relative grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] sm:items-center sm:gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              One search
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Find your next loop
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              People, ideas, circles, chains and collections.
            </p>
          </div>
          <ExploreSearchAutocomplete onSearch={setSearchQuery} />
        </div>
      </section>

      {searchQuery.trim() ? (
        <ExploreSearchResults query={searchQuery} onClear={() => setSearchQuery("")} />
      ) : (
        <>
          <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as ExploreTab)} className="w-full">
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-full border border-border/70 bg-muted/30 p-1">
              <TabsTrigger value="events" className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Calendar className="h-3.5 w-3.5" />
                Global Events
              </TabsTrigger>
              <TabsTrigger value="recent" className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Clock className="h-3.5 w-3.5" />
                Recent
              </TabsTrigger>
              {user && (
                <TabsTrigger value="personalized" className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Compass className="h-3.5 w-3.5" />
                  For you
                </TabsTrigger>
              )}
              {user && (
                <TabsTrigger value="following" className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Users className="h-3.5 w-3.5" />
                  Following
                </TabsTrigger>
              )}
              <TabsTrigger value="community" className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Users className="h-3.5 w-3.5" />
                From Circles
              </TabsTrigger>
              <TabsTrigger value="deepest" className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <TreePine className="h-3.5 w-3.5" />
                Chains
              </TabsTrigger>
              <TabsTrigger value="creative" className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Zap className="h-3.5 w-3.5" />
                Creative
              </TabsTrigger>
              <TabsTrigger value="hashtags" className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Hash className="h-3.5 w-3.5" />
                Hashtags
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="mt-4">
              <GlobalEventsHub />
            </TabsContent>

            <TabsContent value="recent" className="mt-4 space-y-5">
              <ParticipationDiscovery />
              <GlobalEventBanner />
              <section className="space-y-3">
                <FeedHeading
                  icon={Clock}
                  title="Recent loops"
                  description="The newest public work, moment by moment."
                  action={liveIndicator}
                />
                {renderLoops(loops, "No recent loops yet")}
                {renderLoadMore()}
              </section>
            </TabsContent>

            {user && (
              <TabsContent value="personalized" className="mt-4 space-y-4">
                <DiscoveryPreferencesPanel onChanged={() => void fetchExplore("personalized")} />
                <section className="space-y-3">
                  <FeedHeading
                    icon={Compass}
                    title="For you"
                    description="Recommended from topic tags on public loops you like or save."
                    action={liveIndicator}
                  />
                  {renderLoops(loops, "No interest matches yet. Like or save public loops with topic tags to build this feed.")}
                  {renderLoadMore()}
                </section>
              </TabsContent>
            )}

            {user && (
              <TabsContent value="following" className="mt-4 space-y-3">
                <FeedHeading
                  icon={Users}
                  title="From people you follow"
                  description="Latest public loops from your circle."
                  action={liveIndicator}
                />
                {renderLoops(loops, "No recent public loops from people you follow yet")}
                {renderLoadMore()}
              </TabsContent>
            )}

            <TabsContent value="community" className="mt-4 space-y-3">
              <FeedHeading
                icon={Users}
                title="From Circles"
                description="Public work shared by communities you can discover."
                action={liveIndicator}
              />
              {renderLoops(loops, "No public Circle loops found yet")}
              {renderLoadMore()}
            </TabsContent>

            <TabsContent value="deepest" className="mt-4 space-y-3">
              <FeedHeading
                icon={GitBranch}
                title="Collaborative Chains"
                description="Open ideas with the most contributions."
                action={
                  <Link href="/chains" className="text-[11px] font-semibold text-primary hover:underline">
                    Explore all
                  </Link>
                }
              />
              {loading ? (
                <div className="flex items-center justify-center py-14 text-sm text-muted-foreground">
                  <Spinner className="mr-2 h-5 w-5" /> Loading Chains…
                </div>
              ) : chains.length === 0 ? (
                <EmptyState title="No collaborative Chains yet" icon={<GitBranch className="h-6 w-6" />} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {chains.map((chain) => (
                    <Link
                      key={chain.id}
                      href={`/chains/${chain.id}`}
                      className="group flex min-h-40 flex-col rounded-xl border border-border/70 bg-card p-3.5 transition-colors hover:border-border hover:bg-muted/20"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="capitalize text-[10px]">{chain.kind.replace(/_/g, " ")}</Badge>
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{chain.title}</h3>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {chain.prompt || chain.description || "An idea waiting for its next contribution."}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-2.5 border-t border-border/50 pt-2.5 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" /> {chain.contribution_count}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {chain.participant_count}</span>
                        <span className="ml-auto truncate">by {chain.creator_display_name || chain.creator_username}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="creative" className="mt-4 space-y-3">
              <FeedHeading
                icon={Zap}
                title="Most creative"
                description="Loops with the strongest engagement."
                action={liveIndicator}
              />
              {renderLoops(loops, "No creative loops yet")}
              {renderLoadMore()}
            </TabsContent>

            <TabsContent value="hashtags" className="mt-4 space-y-3">
              <FeedHeading
                icon={Hash}
                title="Trending hashtags"
                description="What the community is talking about right now."
                action={<Badge variant="secondary" className="text-[10px]">Live</Badge>}
              />
              {loading ? (
                <div className="flex items-center justify-center py-14 text-sm text-muted-foreground">
                  <Spinner className="mr-2 h-5 w-5" /> Loading hashtags…
                </div>
              ) : hashtags.length === 0 ? (
                <EmptyState title="No hashtags trending yet" icon={<Hash className="h-6 w-6" />} />
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {hashtags.map((hashtag, index) => {
                    const count = Number(hashtag.usage_count ?? hashtag.count ?? 0)
                    return (
                      <Link
                        key={hashtag.tag}
                        href={`/hashtag/${encodeURIComponent(hashtag.tag)}`}
                        className="group rounded-xl border border-border/70 bg-card p-3.5 transition-colors hover:border-border hover:bg-muted/20"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                            #{String(index + 1).padStart(2, "0")}
                          </span>
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <TrendingUp className="h-3 w-3" />
                            {hashtag.growth ?? "hot"}
                          </Badge>
                        </div>
                        <h3 className="mt-2 truncate text-sm font-semibold text-primary">#{hashtag.tag}</h3>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatNumber(count)} loops</p>
                      </Link>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
