"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/community-engine"
import {
  Bookmark,
  MessageCircle,
  Heart,
  ExternalLink,
  Trash2,
} from "lucide-react"

interface BookmarkedPost {
  id: number
  content: string
  post_type: string
  created_at: string
  author: {
    username: string
    display_name?: string
    avatar_url?: string
  }
  comment_count?: number
  like_count?: number
}

interface CommunityBookmarksProps {
  communityId: string
}

export function CommunityBookmarks({ communityId }: CommunityBookmarksProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/circles/${communityId}/bookmarks`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load bookmarks")
      setBookmarks(data.bookmarks || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  const removeBookmark = async (postId: number) => {
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsave" }),
      })
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== postId))
      }
    } catch {}
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={load}>
          Try again
        </Button>
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <Bookmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-bold text-lg">No saved posts yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Posts you save will appear here for quick access.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-1.5">
          <Bookmark className="h-4 w-4" /> Saved Posts
        </h2>
        <span className="text-xs text-muted-foreground">{bookmarks.length} saved</span>
      </div>

      {bookmarks.map((post) => (
        <div
          key={post.id}
          className="rounded-2xl border border-border bg-card p-4 transition hover:border-indigo-500/30"
        >
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/profile/${post.author?.username}`}>
              <Avatar className="h-6 w-6">
                <AvatarImage src={post.author?.avatar_url || ""} alt="" />
                <AvatarFallback className="text-[10px]">
                  {(post.author?.display_name || post.author?.username || "U").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Link href={`/profile/${post.author?.username}`} className="text-xs font-semibold hover:underline">
              {post.author?.display_name || post.author?.username}
            </Link>
            <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
            <Badge variant="outline" className="text-[9px] ml-auto">
              {post.post_type || "discussion"}
            </Badge>
          </div>

          <p className="text-sm line-clamp-3 mb-3">{post.content}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {post.like_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {post.comment_count || 0}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Link href={`/communities/${communityId}?focus=post-${post.id}`}>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="View post">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-500"
                onClick={() => removeBookmark(post.id)}
                title="Remove bookmark"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
