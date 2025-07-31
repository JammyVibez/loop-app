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
    // Simulate API call to fetch loop details
    const fetchLoop = async () => {
      setLoading(true)

      // Mock loop data
      const mockLoop: LoopData = {
        id: loopId,
        title: "Building a Modern React Component Library",
        content: `Just finished creating a comprehensive React component library with TypeScript support! 🚀

This library includes:
- 50+ reusable components
- Full TypeScript definitions
- Storybook documentation
- Jest testing suite
- Automated CI/CD pipeline

The goal was to create something that could be used across multiple projects while maintaining consistency and performance. The components are built with accessibility in mind and follow modern React patterns.

Key features:
✅ Tree-shakeable imports
✅ Theme customization
✅ Dark mode support
✅ Mobile responsive
✅ WAI-ARIA compliant

Would love to hear your thoughts and feedback! Planning to open-source this soon.

#react #typescript #componentlibrary #opensource`,
        author: {
          id: "user1",
          username: "sarahdev",
          displayName: "Sarah Chen",
          avatar: "/placeholder.svg?height=40&width=40",
          verified: true,
          premium: true,
        },
        createdAt: "2024-01-15T10:30:00Z",
        updatedAt: "2024-01-15T10:30:00Z",
        stats: {
          likes: 1247,
          comments: 89,
          shares: 156,
          views: 5420,
          branches: 23,
        },
        tags: ["react", "typescript", "componentlibrary", "opensource"],
        parentLoop: {
          id: "parent1",
          title: "Best Practices for React Development",
          author: "reactmaster",
        },
        branches: [
          {
            id: "branch1",
            title: "Added Dark Mode Support",
            author: "darkmode_dev",
            avatar: "/placeholder.svg?height=32&width=32",
            createdAt: "2024-01-16T08:15:00Z",
          },
          {
            id: "branch2",
            title: "Mobile Optimization Tips",
            author: "mobile_expert",
            avatar: "/placeholder.svg?height=32&width=32",
            createdAt: "2024-01-16T14:22:00Z",
          },
          {
            id: "branch3",
            title: "Testing Strategy Implementation",
            author: "test_guru",
            avatar: "/placeholder.svg?height=32&width=32",
            createdAt: "2024-01-17T09:45:00Z",
          },
        ],
        codeSnippet: {
          language: "typescript",
          code: `// Example component from the library
import React from 'react';
import { Button, ButtonProps } from './Button';

export interface CardProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  actions,
  variant = 'default'
}) => {
  return (
    <div className={\`card card--\${variant}\`}>
      <div className="card__header">
        <h3 className="card__title">{title}</h3>
        {actions && (
          <div className="card__actions">{actions}</div>
        )}
      </div>
      <div className="card__content">
        {children}
      </div>
    </div>
  );
};`,
        },
        isLiked: false,
        isBookmarked: true,
        isFollowing: false,
      }

      setTimeout(() => {
        setLoop(mockLoop)
        setLoading(false)
      }, 1000)
    }

    fetchLoop()
  }, [loopId])

  const handleLike = () => {
    if (!loop) return
    setLoop((prev) =>
      prev
        ? {
            ...prev,
            isLiked: !prev.isLiked,
            stats: {
              ...prev.stats,
              likes: prev.isLiked ? prev.stats.likes - 1 : prev.stats.likes + 1,
            },
          }
        : null,
    )
  }

  const handleBookmark = () => {
    if (!loop) return
    setLoop((prev) =>
      prev
        ? {
            ...prev,
            isBookmarked: !prev.isBookmarked,
          }
        : null,
    )
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
