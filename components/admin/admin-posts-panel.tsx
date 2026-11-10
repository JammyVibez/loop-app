"use client"

import { useCallback, useEffect, useState } from "react"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/skeletons"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Heart, MessageCircle, RefreshCw, Search, Trash2 } from "@/components/icons/lucide-compat"

interface AdminPost {
  id: string
  preview: string
  content_title: string | null
  content_media_url: string | null
  media_url: string | null
  content_type: string | null
  created_at: string
  parent_loop_id: string | null
  circle_id: string | null
  visibility: string | null
  like_count: number | null
  comment_count: number | null
  author?: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
  } | null
}

export function AdminPostsPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(
    async (search = q) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: "40" })
        if (search.trim()) params.set("q", search.trim())
        const res = await fetch(`/api/admin/posts?${params}`, { headers: getAuthHeader() })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load posts")
        setPosts(data.posts || [])
      } catch (error: any) {
        toast({ title: "Could not load posts", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    },
    [getAuthHeader, q, toast],
  )

  useEffect(() => {
    void load("")
    // Only on mount — searches run from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remove = async (post: AdminPost) => {
    const ok = await confirmDialog({
      title: "Delete this post?",
      description:
        "The post and its replies disappear for everyone. This cannot be undone — the author is not notified.",
      confirmLabel: "Delete post",
      destructive: true,
    })
    if (!ok) return
    setDeletingId(post.id)
    try {
      const res = await fetch(`/api/admin/posts?id=${encodeURIComponent(post.id)}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete post")
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      toast({ title: "Post deleted" })
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
              placeholder="Search post text…"
              className="rounded-full pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => void load()}>
              Search
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => void load()} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
              <Spinner className="h-5 w-5" /> Loading posts…
            </div>
          ) : posts.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">No posts match that search.</p>
          ) : (
            <ul className="divide-y">
              {posts.map((post) => {
                const author = post.author
                const name = author?.display_name || author?.username || "Unknown"
                const media = post.content_media_url || post.media_url
                return (
                  <li key={post.id} className="flex gap-3 p-4">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={author?.avatar_url || undefined} />
                      <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        {author?.username && (
                          <span className="truncate text-xs text-muted-foreground">@{author.username}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          · {new Date(post.created_at).toLocaleString()}
                        </span>
                        {post.parent_loop_id && (
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            Reply/branch
                          </Badge>
                        )}
                        {post.circle_id && (
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            Community
                          </Badge>
                        )}
                        {post.visibility && post.visibility !== "public" && (
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            {post.visibility}
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-3 whitespace-pre-wrap text-sm text-foreground/90">
                        {post.content_title ? `${post.content_title} — ` : ""}
                        {post.preview}
                      </p>
                      {media && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={media}
                          alt=""
                          className="max-h-32 w-auto rounded-lg border object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" /> {Number(post.like_count || 0)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" /> {Number(post.comment_count || 0)}
                        </span>
                        <a
                          href={`/loop/${post.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 rounded-full"
                      disabled={deletingId === post.id}
                      onClick={() => void remove(post)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingId === post.id ? "Deleting…" : "Delete"}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
