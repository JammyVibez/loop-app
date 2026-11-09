"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Hash, Code2, Star, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { Spinner } from "@/components/ui/skeletons"

interface TrendingHashtag {
  tag: string
  count: number
}

interface TrendingProject {
  id: string
  title: string
  language: string
  stars: number
  author: { username?: string; display_name?: string } | null
}

export function TrendingSidebar() {
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([])
  const [trendingProjects, setTrendingProjects] = useState<TrendingProject[]>([])
  const [loading, setLoading] = useState(true)
  const { user, getAuthHeader } = useAuth()

  useEffect(() => {
    if (user) {
      void fetchTrendingData()
      void fetchTrendingProjects()
    }
  }, [user?.id])

  const fetchTrendingData = async () => {
    try {
      const hashtagResponse = await fetch("/api/explore/trending?type=hashtags&limit=8", {
        headers: {
          ...getAuthHeader(),
        },
        cache: "no-store",
      })
      const hashtagData = await hashtagResponse.json()
      const rows = hashtagData.hashtags || hashtagData.data || []
      if (hashtagData.success && Array.isArray(rows)) {
        setTrendingHashtags(
          rows.map((row: any) => ({
            tag: row.tag || row.hashtag,
            count: Number(row.count ?? row.usage_count ?? 0),
          })),
        )
      } else {
        setTrendingHashtags([])
      }
    } catch (error) {
      console.error("Error fetching trending data:", error)
      setTrendingHashtags([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTrendingProjects = async () => {
    try {
      const res = await fetch("/api/developers/projects?sortBy=popular&limit=3", { cache: "no-store" })
      const data = await res.json()
      if (Array.isArray(data.projects)) {
        setTrendingProjects(data.projects)
      }
    } catch (error) {
      console.error("Error fetching trending projects:", error)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Hash className="h-5 w-5" />
            <span>Trending Hashtags</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner className="h-4 w-4" />
            </div>
          ) : trendingHashtags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trending hashtags yet</p>
          ) : (
            <div className="space-y-3">
              {trendingHashtags.map((hashtag, index) => (
                <Link
                  key={hashtag.tag}
                  href={`/hashtag/${encodeURIComponent(hashtag.tag)}`}
                  className="-m-2 block rounded-lg p-2 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">#{hashtag.tag}</p>
                      <p className="text-xs text-muted-foreground">
                        {hashtag.count} loops
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {trendingProjects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center space-x-2">
                <Code2 className="h-5 w-5" />
                <span>Developer Hub</span>
              </span>
              <Badge variant="secondary" className="text-[10px]">New</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {trendingProjects.map((project) => (
              <Link
                key={project.id}
                href={`/developers`}
                className="-m-2 block rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.language}
                      {project.author?.username ? ` · @${project.author.username}` : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" />
                    {project.stars || 0}
                  </span>
                </div>
              </Link>
            ))}
            <Link
              href="/developers"
              className="mt-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-primary hover:underline"
            >
              Explore Developer Hub
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            <span>Your Stats</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Loop Coins</span>
              <Badge variant="secondary">
                {user.loop_coins.toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Account Type</span>
              <Badge variant={user.is_premium ? "default" : "outline"}>
                {user.is_premium ? "Premium" : "Free"}
              </Badge>
            </div>
            {user.is_verified && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="secondary" className="gap-1 bg-gradient-to-r from-sky-500/15 to-indigo-500/15 text-sky-600 dark:text-sky-400">
                  <VerifiedSeal size={15} title="Verified Creator" /> Verified
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
