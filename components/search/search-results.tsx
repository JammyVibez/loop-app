"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Hash, Users, GitBranch, Search, Loader2, Circle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { LoopCard } from "@/components/loop-card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { normalizeLoops } from "@/lib/normalize-loop"

interface SearchResultsProps {
  query: string
}

export function SearchResults({ query }: SearchResultsProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set())
  const [searchResults, setSearchResults] = useState<{
    loops: any[]
    users: any[]
    hashtags: any[]
    circles: any[]
  }>({ loops: [], users: [], hashtags: [], circles: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setSearchResults({ loops: [], users: [], hashtags: [], circles: [] })
        setLoading(false)
        return
      }
      setLoading(true)

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=24`, {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        })
        const data = await response.json().catch(() => ({}))

        if (response.ok) {
          const nested = data.results || {}
          const users = data.users || nested.users || []
          const loops = normalizeLoops(data.loops || nested.loops || [])
          const hashtags = data.hashtags || nested.hashtags || []
          const circles = data.circles || nested.circles || []
          setSearchResults({ loops, users, hashtags, circles })
          if (user) {
            setFollowedUsers(new Set(users.filter((p: any) => p.is_following).map((p: any) => p.id)))
          }
        } else {
          const usersRes = await fetch(`/api/users?q=${encodeURIComponent(query)}&limit=20`, {
            headers: { ...getAuthHeader() },
          })
          const usersData = usersRes.ok ? await usersRes.json() : { users: [] }
          setSearchResults({
            loops: [],
            users: usersData.users || usersData.data || [],
            hashtags: [],
            circles: [],
          })
        }
      } catch (error) {
        console.error("Error performing search:", error)
      } finally {
        setLoading(false)
      }
    }

    void performSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user?.id])

  const handleFollow = async (userId: string) => {
    if (!user) {
      window.location.href = "/login"
      return
    }
    const wasFollowing = followedUsers.has(userId)
    setFollowedUsers((prev) => {
      const next = new Set(prev)
      if (wasFollowing) next.delete(userId)
      else next.add(userId)
      return next
    })
    try {
      const response = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          target_user_id: userId,
          action: wasFollowing ? "unfollow" : "follow",
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Follow failed")
      setFollowedUsers((prev) => {
        const next = new Set(prev)
        if (data.is_following) next.add(userId)
        else next.delete(userId)
        return next
      })
    } catch (error: any) {
      setFollowedUsers((prev) => {
        const next = new Set(prev)
        if (wasFollowing) next.add(userId)
        else next.delete(userId)
        return next
      })
      toast({ title: "Could not update follow", description: error.message, variant: "destructive" })
    }
  }

  const formatNumber = (num: number) => {
    if (!num) return "0"
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return String(num)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Searching…
      </div>
    )
  }

  const empty =
    !searchResults.loops.length &&
    !searchResults.users.length &&
    !searchResults.hashtags.length &&
    !searchResults.circles.length

  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 px-6 py-16 text-center">
        <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">No results for “{query}”</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try a username, a keyword, or a #hashtag
        </p>
      </div>
    )
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="users" className="gap-1">
          <Users className="h-3.5 w-3.5" /> People ({searchResults.users.length})
        </TabsTrigger>
        <TabsTrigger value="loops" className="gap-1">
          <GitBranch className="h-3.5 w-3.5" /> Loops ({searchResults.loops.length})
        </TabsTrigger>
        <TabsTrigger value="hashtags" className="gap-1">
          <Hash className="h-3.5 w-3.5" /> Tags ({searchResults.hashtags.length})
        </TabsTrigger>
        <TabsTrigger value="circles" className="gap-1">
          <Circle className="h-3.5 w-3.5" /> Circles ({searchResults.circles.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-6 space-y-8">
        {searchResults.users.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">People</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {searchResults.users.slice(0, 4).map((person: any) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  following={followedUsers.has(person.id)}
                  onFollow={() => void handleFollow(person.id)}
                  formatNumber={formatNumber}
                />
              ))}
            </div>
          </section>
        )}

        {searchResults.loops.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Loops</h3>
            <div className="space-y-4">
              {searchResults.loops.slice(0, 5).map((loop: any) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
            </div>
          </section>
        )}

        {searchResults.hashtags.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hashtags</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {searchResults.hashtags.slice(0, 6).map((hashtag: any) => (
                <HashtagCard key={hashtag.tag} hashtag={hashtag} formatNumber={formatNumber} />
              ))}
            </div>
          </section>
        )}

        {searchResults.circles.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Communities</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {searchResults.circles.slice(0, 4).map((circle: any) => (
                <CircleCard key={circle.id} circle={circle} formatNumber={formatNumber} />
              ))}
            </div>
          </section>
        )}
      </TabsContent>

      <TabsContent value="users" className="mt-6 space-y-3">
        {searchResults.users.map((person: any) => (
          <PersonRow
            key={person.id}
            person={person}
            following={followedUsers.has(person.id)}
            onFollow={() => void handleFollow(person.id)}
            formatNumber={formatNumber}
            large
          />
        ))}
      </TabsContent>

      <TabsContent value="loops" className="mt-6 space-y-4">
        {searchResults.loops.map((loop: any) => (
          <LoopCard key={loop.id} loop={loop} />
        ))}
      </TabsContent>

      <TabsContent value="hashtags" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {searchResults.hashtags.map((hashtag: any) => (
            <HashtagCard key={hashtag.tag} hashtag={hashtag} formatNumber={formatNumber} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="circles" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {searchResults.circles.map((circle: any) => (
            <CircleCard key={circle.id} circle={circle} formatNumber={formatNumber} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}

function PersonRow({
  person,
  following,
  onFollow,
  formatNumber,
  large,
}: {
  person: any
  following: boolean
  onFollow: () => void
  formatNumber: (n: number) => string
  large?: boolean
}) {
  return (
    <Card>
      <CardContent className={large ? "flex items-center gap-4 p-5" : "flex items-center gap-3 p-4"}>
        <Link href={`/profile/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className={large ? "h-14 w-14" : "h-11 w-11"}>
            <AvatarImage src={person.avatar_url || undefined} />
            <AvatarFallback>{(person.display_name || person.username || "?").charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold">{person.display_name || person.username}</p>
              {person.is_verified ? <Badge variant="secondary">Verified</Badge> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">@{person.username}</p>
            {person.bio ? <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{person.bio}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(person.followers_count || 0)} followers
            </p>
          </div>
        </Link>
        <Button variant={following ? "outline" : "default"} size="sm" className="rounded-full" onClick={onFollow}>
          {following ? "Following" : "Follow"}
        </Button>
      </CardContent>
    </Card>
  )
}

function HashtagCard({
  hashtag,
  formatNumber,
}: {
  hashtag: any
  formatNumber: (n: number) => string
}) {
  const tag = String(hashtag.tag || "").replace(/^#/, "")
  return (
    <Link href={`/hashtag/${encodeURIComponent(tag)}`}>
      <Card className="transition hover:bg-muted/40">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Hash className="h-5 w-5 text-sky-500" />
            <p className="font-semibold">#{tag}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatNumber(hashtag.loop_count || hashtag.usage_count || 0)} loops
          </p>
          {hashtag.is_trending ? <Badge className="mt-2">Trending</Badge> : null}
        </CardContent>
      </Card>
    </Link>
  )
}

function CircleCard({
  circle,
  formatNumber,
}: {
  circle: any
  formatNumber: (n: number) => string
}) {
  return (
    <Link href={`/circles/${circle.id}`}>
      <Card className="transition hover:bg-muted/40">
        <CardContent className="flex items-center gap-3 p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={circle.avatar_url || undefined} />
            <AvatarFallback>{(circle.name || "C").charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">{circle.name}</p>
            <p className="line-clamp-1 text-sm text-muted-foreground">{circle.description}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatNumber(circle.member_count || 0)} members
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
