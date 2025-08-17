"use client"

import { memo, useState, useCallback } from "react"
import Link from "next/link"
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, GitBranch } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader } from "./ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { useIntersectionObserver, useOptimizedImage } from "@/hooks/use-optimized-loading"
import { useAdaptivePerformance } from "@/lib/performance-monitor"
import { formatDistanceToNow } from "date-fns"

interface OptimizedLoopCardProps {
  loop: {
    id: string
    user: {
      id: string
      username: string
      display_name: string
      avatar_url: string
      is_verified: boolean
      is_premium?: boolean
    }
    content: string
    media_urls?: string[]
    media_type?: "image" | "video" | "audio"
    likes: number
    comments: number
    branches: number
    created_at: string
    hashtags: string[]
    is_liked: boolean
    is_bookmarked: boolean
  }
  onLike: (loopId: string) => void
  onBookmark: (loopId: string) => void
  priority?: "high" | "low"
}

export const OptimizedLoopCard = memo<OptimizedLoopCardProps>(({ loop, onLike, onBookmark, priority = "low" }) => {
  const [showFullContent, setShowFullContent] = useState(false)
  const { elementRef, isVisible, hasBeenVisible } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: "50px",
  })
  const { shouldReduceAnimations, shouldReduceEffects } = useAdaptivePerformance()

  // Optimize image loading
  const { imageSrc, isLoading: imageLoading } = useOptimizedImage(
    loop.media_urls?.[0] || "",
    "/placeholder.svg?height=200&width=400",
  )

  // Memoize expensive calculations
  const contentPreview = loop.content.length > 200 ? loop.content.substring(0, 200) + "..." : loop.content

  const timeAgo = formatDistanceToNow(new Date(loop.created_at), { addSuffix: true })

  // Optimize event handlers
  const handleLike = useCallback(() => {
    onLike(loop.id)
  }, [onLike, loop.id])

  const handleBookmark = useCallback(() => {
    onBookmark(loop.id)
  }, [onBookmark, loop.id])

  const handleToggleContent = useCallback(() => {
    setShowFullContent((prev) => !prev)
  }, [])

  // Don't render if not visible and not high priority
  if (!hasBeenVisible && priority === "low") {
    return <div ref={elementRef} className="h-64 bg-muted/20 rounded-lg animate-pulse" aria-label="Loading post..." />
  }

  const cardClassName = `
    transition-all duration-200 
    ${shouldReduceAnimations ? "" : "hover:shadow-lg hover:scale-[1.01]"}
    ${shouldReduceEffects ? "" : "hover:shadow-purple-500/10"}
  `

  return (
    <Card ref={elementRef} className={cardClassName}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <Link href={`/profile/${loop.user.username}`} className="flex-shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={loop.user.avatar_url || "/placeholder.svg"}
                  alt={loop.user.display_name}
                  loading={priority === "high" ? "eager" : "lazy"}
                />
                <AvatarFallback>{loop.user.display_name.charAt(0)}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1">
                <Link href={`/profile/${loop.user.username}`}>
                  <span className="font-semibold hover:underline text-sm truncate">{loop.user.display_name}</span>
                </Link>
                {loop.user.is_verified && (
                  <Badge variant="secondary" className="text-xs">
                    ✓
                  </Badge>
                )}
                {loop.user.is_premium && (
                  <Badge className="text-xs bg-gradient-to-r from-purple-500 to-pink-500">Premium</Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span className="truncate">@{loop.user.username}</span>
                <span>•</span>
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="flex-shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Content */}
        <div>
          <p className="text-sm leading-relaxed">{showFullContent ? loop.content : contentPreview}</p>
          {loop.content.length > 200 && (
            <Button variant="link" size="sm" className="p-0 h-auto text-primary text-xs" onClick={handleToggleContent}>
              {showFullContent ? "Show less" : "Show more"}
            </Button>
          )}
        </div>

        {/* Hashtags */}
        {loop.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {loop.hashtags.slice(0, 3).map((tag) => (
              <Link key={tag} href={`/hashtag/${tag}`}>
                <Badge variant="outline" className="text-xs hover:bg-primary/10">
                  #{tag}
                </Badge>
              </Link>
            ))}
            {loop.hashtags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{loop.hashtags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Media - Only load if visible */}
        {loop.media_urls && loop.media_urls.length > 0 && isVisible && (
          <div className="rounded-lg overflow-hidden">
            {loop.media_type === "image" ? (
              <img
                src={imageSrc || "/placeholder.svg"}
                alt="Loop media"
                className="w-full h-auto max-h-96 object-cover"
                loading={priority === "high" ? "eager" : "lazy"}
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg?height=200&width=400"
                }}
              />
            ) : loop.media_type === "video" ? (
              <video
                controls
                className="w-full h-auto max-h-96"
                preload={priority === "high" ? "metadata" : "none"}
                poster="/placeholder.svg?height=200&width=400"
              >
                <source src={loop.media_urls[0]} type="video/mp4" />
              </video>
            ) : null}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className={`space-x-1 transition-colors ${loop.is_liked ? "text-red-500" : "hover:text-red-500"}`}
              onClick={handleLike}
            >
              <Heart className={`h-4 w-4 ${loop.is_liked ? "fill-current" : ""}`} />
              <span>{loop.likes}</span>
            </Button>

            <Link href={`/loop/${loop.id}`}>
              <Button variant="ghost" size="sm" className="space-x-1 hover:text-blue-500">
                <MessageCircle className="h-4 w-4" />
                <span>{loop.comments}</span>
              </Button>
            </Link>

            <Button variant="ghost" size="sm" className="space-x-1 hover:text-green-500">
              <GitBranch className="h-4 w-4" />
              <span>{loop.branches}</span>
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className={`transition-colors ${loop.is_bookmarked ? "text-yellow-500" : "hover:text-yellow-500"}`}
              onClick={handleBookmark}
            >
              <Bookmark className={`h-4 w-4 ${loop.is_bookmarked ? "fill-current" : ""}`} />
            </Button>

            <Button variant="ghost" size="sm" className="hover:text-blue-500">
              <Share className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

OptimizedLoopCard.displayName = "OptimizedLoopCard"
