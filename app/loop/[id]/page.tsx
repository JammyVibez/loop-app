"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  TreePine,
  GitBranch,
  Eye,
  Calendar,
  Tag,
  Flag,
  Copy,
  ExternalLink,
} from "lucide-react"
import { CommentsSection } from "@/components/comments/comments-section"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface LoopData {
  id: string
  title: string
  content: string
  author: {
    id: string
    username: string
    displayName: string
    avatar: string
    verified: boolean
    premium: boolean
  }
  createdAt: string
  updatedAt: string
  stats: {
    likes: number
    comments: number
    shares: number
    views: number
    branches: number
  }
  tags: string[]
  parentLoop?: {
    id: string
    title: string
    author: string
  }
  branches: Array<{
    id: string
    title: string
    author: string
    avatar: string
    createdAt: string
  }>
  media?: {
    type: "image" | "video" | "gif"
    url: string
    thumbnail?: string
  }
  codeSnippet?: {
    language: string
    code: string
  }
  isLiked: boolean
  isBookmarked: boolean
  isFollowing: boolean
}

export default function LoopDetailPage() {
  const params = useParams()
  const loopId = params.id as string
  const [loop, setLoop] = useState<LoopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFullTree, setShowFullTree] = useState(false)

  useEffect(() => {
    const fetchLoop = async () => {
      setLoading(true)
      // Fetch main loop with author info
      const { data: loopData, error: loopError } = await supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(*),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .eq("id", loopId)
        .single()
      if (loopError || !loopData) {
        setLoop(null)
        setLoading(false)
        return
      }
      // Fetch branches (children)
      const { data: branchData } = await supabase
        .from("loops")
        .select(`
          id, content_title, author:profiles!author_id(username, display_name, avatar_url), created_at
        `)
        .eq("parent_loop_id", loopId)
        .order("created_at", { ascending: false })
      // Fetch parent loop info if exists
      let parentLoop: { id: string; title: string; author: string } | undefined = undefined
      if (loopData.parent_id) {
        const { data: parentData } = await supabase
          .from("loops")
          .select(`id, content_title, author:profiles!author_id(username)`)
          .eq("id", loopData.parent_loop_id)
          .single()
        if (parentData) {
          parentLoop = {
            id: parentData.id,
            title: parentData.content_title || "Untitled Loop",
            author: parentData.author?.username || "",
          }
        }
      }
      setLoop({
        id: loopData.id,
        title: loopData.content_title || "Untitled Loop",
        content: loopData.content_text || "",
        author: {
          id: loopData.author?.id || "",
          username: loopData.author?.username || "",
          displayName: loopData.author?.display_name || "",
          avatar: loopData.author?.avatar_url || "/placeholder.svg",
          verified: loopData.author?.is_verified || false,
          premium: loopData.author?.is_premium || false,
        },
        createdAt: loopData.created_at,
        updatedAt: loopData.updated_at || loopData.created_at,
        stats: {
          likes: loopData.loop_stats?.likes_count || 0,
          comments: loopData.loop_stats?.comments_count || 0,
          shares: loopData.loop_stats?.shares_count || 0,
          views: loopData.loop_stats?.views_count || 0,
          branches: branchData?.length || 0,
        },
        tags: loopData.hashtags || [],
        parentLoop,
        branches: (branchData || []).map((b: any) => ({
          id: b.id,
          title: b.content_title || "Untitled Loop",
          author: b.author?.username || "",
          avatar: b.author?.avatar_url || "/placeholder.svg",
          createdAt: b.created_at,
        })),
        codeSnippet: loopData.code_snippet
          ? { language: loopData.code_snippet_language, code: loopData.code_snippet }
          : undefined,
        isLiked: false,
        isBookmarked: false,
        isFollowing: false,
      })
      setLoading(false)
    }
    fetchLoop()
  }, [loopId])

  const handleLike = async () => {
    if (!loop) return

    try {
      const response = await fetch(`/api/loops/${loop.id}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ action: 'like' }),
      })

      const data = await response.json()

      if (response.ok) {
        setLoop((prev) =>
          prev
            ? {
                ...prev,
                isLiked: data.is_liked,
                stats: {
                  ...prev.stats,
                  likes: data.is_liked ? prev.stats.likes + 1 : prev.stats.likes - 1,
                },
              }
            : null,
        )
      }
    } catch (error) {
      console.error('Failed to like loop:', error)
    }
  }

  const handleBookmark = async () => {
    if (!loop) return

    try {
      const response = await fetch(`/api/loops/${loop.id}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ action: 'save' }),
      })

      const data = await response.json()

      if (response.ok) {
        setLoop((prev) =>
          prev
            ? {
                ...prev,
                isBookmarked: data.is_saved,
              }
            : null,
        )
      }
    } catch (error) {
      console.error('Failed to bookmark loop:', error)
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    // Show toast notification
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="rounded-full bg-muted h-12 w-12"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-3 bg-muted rounded w-1/6"></div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!loop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <TreePine className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Loop not found</h3>
            <p className="text-muted-foreground">This loop may have been deleted or doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Main Loop Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/profile/${loop.author.username}`}>
                  <Avatar className="cursor-pointer">
                    <AvatarImage src={loop.author.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{loop.author.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${loop.author.username}`} className="font-semibold hover:underline">
                      {loop.author.displayName}
                    </Link>
                    {loop.author.verified && (
                      <Badge variant="secondary" className="text-xs">
                        ✓
                      </Badge>
                    )}
                    {loop.author.premium && (
                      <Badge variant="outline" className="text-xs">
                        ⭐
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{loop.author.username} • {new Date(loop.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!loop.isFollowing && (
                  <Button variant="outline" size="sm">
                    Follow
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleShare}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Flag className="h-4 w-4 mr-2" />
                      Report Loop
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <h1 className="text-2xl font-bold mb-4">{loop.title}</h1>

            {/* Parent Loop Reference */}
            {loop.parentLoop && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
                <p className="text-sm text-muted-foreground mb-1">Branched from:</p>
                <Link
                  href={`/loop/${loop.parentLoop.id}`}
                  className="text-sm font-medium hover:underline flex items-center gap-2"
                >
                  <GitBranch className="h-3 w-3" />
                  {loop.parentLoop.title} by @{loop.parentLoop.author}
                </Link>
              </div>
            )}

            {/* Content */}
            <div className="prose prose-sm max-w-none mb-6">
              <p className="whitespace-pre-wrap">{loop.content}</p>
            </div>

            {/* Code Snippet */}
            {loop.codeSnippet && (
              <div className="mb-6">
                <div className="bg-muted rounded-lg p-4 overflow-x-auto">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      {loop.codeSnippet.language}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(loop.codeSnippet!.code)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <pre className="text-sm">
                    <code>{loop.codeSnippet.code}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {loop.tags.map((tag) => (
                <Link key={tag} href={`/hashtag/${tag}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {loop.stats.views.toLocaleString()} views
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(loop.createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1">
                <GitBranch className="h-4 w-4" />
                {loop.stats.branches} branches
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={handleLike} className={loop.isLiked ? "text-red-500" : ""}>
                  <Heart className={`h-4 w-4 mr-2 ${loop.isLiked ? "fill-current" : ""}`} />
                  {loop.stats.likes.toLocaleString()}
                </Button>
                <Button variant="ghost" size="sm">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {loop.stats.comments}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  {loop.stats.shares}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBookmark}
                className={loop.isBookmarked ? "text-blue-500" : ""}
              >
                <Bookmark className={`h-4 w-4 ${loop.isBookmarked ? "fill-current" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Branches Section */}
        {loop.branches.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Branches ({loop.branches.length})
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loop.branches.slice(0, showFullTree ? undefined : 3).map((branch) => (
                  <Link key={branch.id} href={`/loop/${branch.id}`}>
                    <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={branch.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{branch.author.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{branch.title}</p>
                        <p className="text-sm text-muted-foreground">
                          by @{branch.author} • {new Date(branch.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
                {loop.branches.length > 3 && (
                  <Button variant="ghost" onClick={() => setShowFullTree(!showFullTree)} className="w-full">
                    {showFullTree ? "Show Less" : `Show ${loop.branches.length - 3} More Branches`}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments Section */}
        <CommentsSection loopId={loop.id} />
      </div>
    </div>
  )
}
