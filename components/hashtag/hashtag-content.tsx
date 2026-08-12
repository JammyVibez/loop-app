"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Hash, TrendingUp } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface HashtagContentProps {
  tag: string
}

export function HashtagContent({ tag }: HashtagContentProps) {
  const normalized = String(tag || "").replace(/^#/, "").toLowerCase().trim()
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [sortBy, setSortBy] = useState("recent")
  const [isFollowing, setIsFollowing] = useState(false)
  const [hashtagData, setHashtagData] = useState<{
    count: number
    trending: boolean
    description: string
    relatedTags: string[]
    loops: any[]
  }>({
    count: 0,
    trending: false,
    description: `Explore loops tagged with #${normalized}`,
    relatedTags: [],
    loops: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHashtagData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/hashtags/${encodeURIComponent(normalized)}`, {
          headers: user ? getAuthHeader() : undefined,
          cache: "no-store",
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to load hashtag")

        setHashtagData({
          count: Number(data.count || data.loops?.length || 0),
          trending: Boolean(data.trending),
          description: data.description || `Explore loops tagged with #${normalized}`,
          relatedTags: data.relatedTags || [],
          loops: data.loops || [],
        })
        setIsFollowing(Boolean(data.is_following))
      } catch (error: any) {
        console.error("Error fetching hashtag data:", error)
        toast({ title: "Hashtag unavailable", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    if (normalized) void fetchHashtagData()
  }, [normalized, user?.id])

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const likesOf = (loop: any) => Number(loop?.stats?.likes_count ?? loop?.stats?.likes ?? 0)
  const branchesOf = (loop: any) => Number(loop?.stats?.branches_count ?? loop?.stats?.branches ?? 0)

  const sortedLoops = [...hashtagData.loops].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case "popular":
        return likesOf(b) - likesOf(a)
      case "branches":
        return branchesOf(b) - branchesOf(a)
      default:
        return 0
    }
  })

  const handleFollowHashtag = async () => {
    if (!user) {
      toast({ title: "Sign in to follow hashtags", variant: "destructive" })
      return
    }
    try {
      const response = await fetch(`/api/hashtags/${encodeURIComponent(normalized)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ action: isFollowing ? "unfollow" : "follow" }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        // Soft success if table missing — still toggle for UX
        if (response.status === 404 || /relation|does not exist/i.test(data.error || "")) {
          setIsFollowing(!isFollowing)
          return
        }
        throw new Error(data.error || "Follow failed")
      }
      setIsFollowing(Boolean(data.is_following ?? !isFollowing))
    } catch (error: any) {
      console.error("Error following hashtag:", error)
      toast({ title: "Couldn’t update follow", description: error.message, variant: "destructive" })
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8 text-muted-foreground">Loading #{normalized}…</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-cyan-500">
                <Hash className="h-8 w-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl">#{normalized}</CardTitle>
                <p className="mt-1 text-muted-foreground">{hashtagData.description}</p>
                <div className="mt-2 flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">{formatNumber(hashtagData.count)} loops</span>
                  {hashtagData.trending && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <TrendingUp className="mr-1 h-3 w-3" />
                      Trending
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant={isFollowing ? "outline" : "default"} onClick={handleFollowHashtag}>
              {isFollowing ? "Following" : "Follow"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {hashtagData.relatedTags.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold">Related Tags</h3>
            <div className="flex flex-wrap gap-2">
              {hashtagData.relatedTags.map((relatedTag) => (
                <Link key={relatedTag} href={`/hashtag/${encodeURIComponent(relatedTag)}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/20">
                    #{relatedTag}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="loops" className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="loops">Loops</TabsTrigger>
            <TabsTrigger value="top" onClick={() => setSortBy("popular")}>
              Top
            </TabsTrigger>
            <TabsTrigger value="recent" onClick={() => setSortBy("recent")}>
              Recent
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-md border bg-background px-3 py-1 text-sm"
            >
              <option value="recent">Most Recent</option>
              <option value="popular">Most Popular</option>
              <option value="branches">Most Branched</option>
            </select>
          </div>
        </div>

        <TabsContent value="loops" className="mt-6">
          {sortedLoops.length > 0 ? (
            <div className="space-y-4">
              {sortedLoops.map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Hash className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
                <h3 className="mb-2 text-lg font-semibold">No loops found</h3>
                <p className="mb-4 text-muted-foreground">Be the first to create a loop with #{normalized}</p>
                <Link href="/create">
                  <Button>Create Loop</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="top" className="mt-6">
          <div className="space-y-4">
            {[...sortedLoops]
              .sort((a, b) => likesOf(b) - likesOf(a))
              .map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          <div className="space-y-4">
            {[...sortedLoops]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
