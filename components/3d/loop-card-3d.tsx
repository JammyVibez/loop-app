"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, GitBranch, Volume2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"
import { useTheme3D, useThemeColors } from "@/providers/theme-3d-provider"

interface ThemeColors {
  primary?: string
  secondary?: string
  accent?: string
  background?: string
  surface?: string
  text?: string
  shadow?: string
  highlight?: string
  depth?: string
  glow?: string
}

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

interface LoopCard3DProps {
  loop: Loop
  onLike: (loopId: string) => void
  onBookmark: (loopId: string) => void
  className?: string
  variant?: 'default' | 'compact' | 'featured'
}

export function LoopCard3D({ loop, onLike, onBookmark, className = '', variant = 'default' }: LoopCard3DProps) {
  const [showFullContent, setShowFullContent] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const { currentTheme } = useTheme3D()
  const colors = useThemeColors() as ThemeColors

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

  // Handle mouse movement for 3D tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const rotateX = (y - centerY) / 10
    const rotateY = (centerX - x) / 10

    setMousePosition({ x: rotateY, y: rotateX })
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setMousePosition({ x: 0, y: 0 })
  }

  // Generate dynamic styles based on current theme
  const cardStyles = {
    transform: isHovered 
      ? `perspective(1000px) rotateX(${mousePosition.y}deg) rotateY(${mousePosition.x}deg) translateZ(20px)` 
      : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
    background: currentTheme?.components.loopCard.background || 'rgba(30, 41, 59, 0.8)',
    border: currentTheme?.components.loopCard.border || '1px solid rgba(99, 102, 241, 0.2)',
    boxShadow: isHovered 
      ? `0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px ${colors.glow || 'rgba(99, 102, 241, 0.3)'}` 
      : currentTheme?.components.loopCard.boxShadow || '0 8px 32px rgba(0, 0, 0, 0.3)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  }

  const renderMedia = () => {
    if (!loop.media_url) return null

    switch (loop.media_type) {
      case "image":
        return (
          <div className="mt-3 rounded-lg overflow-hidden relative group">
            <img
              src={loop.media_url || "/placeholder.svg"}
              alt="Loop media"
              className="w-full h-auto max-h-96 object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        )
      case "video":
        return (
          <div className="mt-3 rounded-lg overflow-hidden bg-black relative group">
            <video 
              controls 
              className="w-full h-auto max-h-96 transition-transform duration-300 group-hover:scale-105" 
              poster="/placeholder.svg?height=300&width=500"
            >
              <source src={loop.media_url} type="video/mp4" />
            </video>
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
        )
      case "audio":
        return (
          <div className="mt-3 p-4 rounded-lg relative overflow-hidden group">
            <div 
              className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-300"
              style={{
                background: `linear-gradient(135deg, ${colors.primary || '#6366f1'}, ${colors.secondary || '#8b5cf6'})`
              }}
            />
            <div className="relative z-10 flex items-center space-x-3">
              <div 
                className="p-2 rounded-full"
                style={{ background: colors.primary || '#6366f1' }}
              >
                <Volume2 className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Audio Loop</p>
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

  const getVariantClasses = () => {
    switch (variant) {
      case 'compact':
        return 'p-3'
      case 'featured':
        return 'p-6 border-2'
      default:
        return 'p-4'
    }
  }

  return (
    <div
      ref={cardRef}
      className={`card-3d transform-3d ${className} ${getVariantClasses()}`}
      style={cardStyles}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glow effect overlay */}
      {isHovered && (
        <div 
          className="absolute inset-0 rounded-lg opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${((mousePosition.x + 10) / 20) * 100}% ${((mousePosition.y + 10) / 20) * 100}%, ${colors.glow || 'rgba(99, 102, 241, 0.5)'} 0%, transparent 70%)`
          }}
        />
      )}

      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Link href={`/profile/${user.username}`}>
              <div className="avatar-3d">
                <Avatar className="h-10 w-10 transition-transform duration-300 hover:scale-110">
                  <AvatarImage src={user.avatar_url || "/placeholder.svg"} alt={user.display_name} />
                  <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            </Link>
            <div>
              <div className="flex items-center space-x-1">
                <Link href={`/profile/${user.username}`}>
                  <span className="font-semibold hover:underline text-3d-glow transition-all duration-300">
                    {user.display_name}
                  </span>
                </Link>
                {user.is_verified && (
                  <Badge variant="secondary" className="h-4 w-4 p-0 bg-blue-500 hover:scale-110 transition-transform duration-300">
                    <span className="text-white text-xs">✓</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm opacity-70">
                <span>@{user.username}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(loop.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="btn-3d">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="modal-3d-content">
              <DropdownMenuItem>Report Loop</DropdownMenuItem>
              <DropdownMenuItem>Hide from Feed</DropdownMenuItem>
              <DropdownMenuItem>Copy Link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0 relative z-10">
        <div className="space-y-3">
          {/* Content */}
          <div>
            <p className="text-sm leading-relaxed">{showFullContent ? content : contentPreview}</p>
            {content.length > 200 && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-3d-glow hover:text-3d-glow transition-all duration-300"
                onClick={() => setShowFullContent(!showFullContent)}
                style={{ color: colors.accent || '#06b6d4' }}
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
                  <Badge 
                    variant="outline" 
                    className="hover:scale-105 transition-all duration-300 border-opacity-50 hover:border-opacity-100"
                    style={{ 
                      borderColor: colors.accent || '#06b6d4',
                      color: colors.accent || '#06b6d4'
                    }}
                  >
                    #{tag}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Media */}
          {renderMedia()}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-opacity-20" style={{ borderColor: colors.primary || '#6366f1' }}>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className={`btn-3d space-x-1 transition-all duration-300 ${loop.is_liked ? "text-red-500 hover:text-red-400" : "hover:text-red-500"}`}
                onClick={() => onLike(loop.id)}
              >
                <Heart className={`h-4 w-4 transition-transform duration-300 ${loop.is_liked ? "fill-current scale-110" : "hover:scale-110"}`} />
                <span>{loop.likes}</span>
              </Button>

              <Link href={`/loop/${loop.id}`}>
                <Button variant="ghost" size="sm" className="btn-3d space-x-1 hover:scale-105 transition-all duration-300">
                  <MessageCircle className="h-4 w-4" />
                  <span>{loop.comments}</span>
                </Button>
              </Link>

              <Button variant="ghost" size="sm" className="btn-3d space-x-1 hover:scale-105 transition-all duration-300">
                <GitBranch className="h-4 w-4" />
                <span>{loop.branches}</span>
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className={`btn-3d transition-all duration-300 ${loop.is_bookmarked ? "text-yellow-500 hover:text-yellow-400" : "hover:text-yellow-500"}`}
                onClick={() => onBookmark(loop.id)}
              >
                <Bookmark className={`h-4 w-4 transition-transform duration-300 ${loop.is_bookmarked ? "fill-current scale-110" : "hover:scale-110"}`} />
              </Button>

              <Button variant="ghost" size="sm" className="btn-3d hover:scale-105 transition-all duration-300">
                <Share className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Particle effect for featured variant */}
      {variant === 'featured' && isHovered && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          <div className="particles">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="particle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  background: colors.primary || '#6366f1'
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
