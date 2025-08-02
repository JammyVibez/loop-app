"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, GitBranch, Volume2 } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader } from "./ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"

interface Loop {
  id: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string
    is_verified: boolean
  }
  content: string
  media_url?: string
  media_type?: "image" | "video" | "audio"
  likes: number
  comments: number
  branches: number
  created_at: string
  hashtags: string[]
  is_liked: boolean
  is_bookmarked: boolean
  parent_loop_id?: string
}

interface LoopCardProps {
  loop: Loop
  onLike: (loopId: string) => void
  onBookmark: (loopId: string) => void
}

export function LoopCard({ loop, onLike, onBookmark }: LoopCardProps) {
  const [showFullContent, setShowFullContent] = useState(false)

  // Defensive fallback for missing user
  const user = loop.user || {
    username: "unknown",
    display_name: "Unknown User",
    avatar_url: "/placeholder.svg",
    is_verified: false,
  }

  // Defensive fallback for content and hashtags
  const content = typeof loop.content === "string" ? loop.content : ""
  const hashtags = Array.isArray(loop.hashtags) ? loop.hashtags : []

  const contentPreview = content.length > 200 ? content.substring(0, 200) + "..." : content

  const renderMedia = () => {
    if (!loop.media_url) return null

    switch (loop.media_type) {
      case "image":
        return (
          <div className="mt-3 rounded-lg overflow-hidden">
            <img
              src={loop.media_url || "/placeholder.svg"}
              alt="Loop media"
              className="w-full h-auto max-h-96 object-cover"
            />
          </div>
        )
      case "video":
        return (
          <div className="mt-3 rounded-lg overflow-hidden bg-black relative">
            <video controls className="w-full h-auto max-h-96" poster="/placeholder.svg?height=300&width=500">
              <source src={loop.media_url} type="video/mp4" />
            </video>
          </div>
        )
      case "audio":
        return (
          <div className="mt-3 p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600 rounded-full">
                <Volume2 className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Audio Loop</p>
                <audio controls className="w-full mt-2">
                  <source src={loop.media_url} type="audio/mpeg" />
                </audio>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Link href={`/profile/${user.username}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar_url || "/placeholder.svg"} alt={user.display_name} />
                <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <div className="flex items-center space-x-1">
                <Link href={`/profile/${user.username}`}>
                  <span className="font-semibold hover:underline">{user.display_name}</span>
                </Link>
                {user.is_verified && (
                  <Badge variant="secondary" className="h-4 w-4 p-0 bg-blue-500">
                    <span className="text-white text-xs">✓</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>@{user.username}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(loop.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Report Loop</DropdownMenuItem>
              <DropdownMenuItem>Hide from Feed</DropdownMenuItem>
              <DropdownMenuItem>Copy Link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Content */}
          <div>
            <p className="text-sm leading-relaxed">{showFullContent ? content : contentPreview}</p>
            {content.length > 200 && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-purple-600"
                onClick={() => setShowFullContent(!showFullContent)}
              >
                {showFullContent ? "Show less" : "Show more"}
              </Button>
            )}
          </div>

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag) => (
                <Link key={tag} href={`/hashtag/${tag}`}>
                  <Badge variant="outline" className="text-purple-600 hover:bg-purple-50">
                    #{tag}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Media */}
          {renderMedia()}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className={`space-x-1 ${loop.is_liked ? "text-red-500" : ""}`}
                onClick={() => onLike(loop.id)}
              >
                <Heart className={`h-4 w-4 ${loop.is_liked ? "fill-current" : ""}`} />
                <span>{loop.likes}</span>
              </Button>

              <Link href={`/loop/${loop.id}`}>
                <Button variant="ghost" size="sm" className="space-x-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>{loop.comments}</span>
                </Button>
              </Link>

              <Button variant="ghost" size="sm" className="space-x-1">
                <GitBranch className="h-4 w-4" />
                <span>{loop.branches}</span>
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className={loop.is_bookmarked ? "text-yellow-500" : ""}
                onClick={() => onBookmark(loop.id)}
              >
                <Bookmark className={`h-4 w-4 ${loop.is_bookmarked ? "fill-current" : ""}`} />
              </Button>

              <Button variant="ghost" size="sm">
                <Share className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
