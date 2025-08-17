"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, GitBranch, Volume2, Sparkles, Zap } from "lucide-react"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader } from "../ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Badge } from "../ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"
import { useTheme3D } from "@/providers/theme-3d-provider"

interface Loop {
  id: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string
    is_verified: boolean
    is_premium?: boolean
    xp_points?: number
    level?: number
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
  is_featured?: boolean
  engagement_score?: number
}

interface EnhancedLoopCard3DProps {
  loop: Loop
  onLike: (loopId: string) => void
  onBookmark: (loopId: string) => void
  className?: string
  variant?: 'default' | 'featured' | 'premium'
}

export function EnhancedLoopCard3D({ 
  loop, 
  onLike, 
  onBookmark, 
  className = '', 
  variant = 'default' 
}: EnhancedLoopCard3DProps) {
  const [showFullContent, setShowFullContent] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isAnimating, setIsAnimating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const { currentTheme } = useTheme3D()

  // Defensive fallback for missing user
  const user = loop.user || {
    username: "unknown",
    display_name: "Unknown User",
    avatar_url: "/placeholder.svg",
    is_verified: false,
    is_premium: false,
    xp_points: 0,
    level: 1
  }

  // Defensive fallback for content and hashtags
  const content = typeof loop.content === "string" ? loop.content : ""
  const hashtags = Array.isArray(loop.hashtags) ? loop.hashtags : []
  const contentPreview = content.length > 200 ? content.substring(0, 200) + "..." : content

  // Mouse tracking for 3D tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    
    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const mouseX = e.clientX - centerX
    const mouseY = e.clientY - centerY
    
    setMousePosition({ x: mouseX, y: mouseY })
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
    setIsAnimating(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setMousePosition({ x: 0, y: 0 })
    setTimeout(() => setIsAnimating(false), 300)
  }

  // Calculate 3D transform based on mouse position
  const getTransform = () => {
    if (!isHovered) return 'translateZ(0) rotateX(0deg) rotateY(0deg)'
    
    const maxTilt = variant === 'featured' ? 15 : 10
    const rotateX = (mousePosition.y / 100) * maxTilt * -1
    const rotateY = (mousePosition.x / 100) * maxTilt
    const translateZ = variant === 'featured' ? 20 : 12
    
    return `translateZ(${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
  }

  // Get variant-specific classes
  const getVariantClasses = () => {
    switch (variant) {
      case 'featured':
        return 'border-2 border-gradient-to-r from-yellow-400 to-orange-500 shadow-2xl'
      case 'premium':
        return 'border-2 border-gradient-to-r from-purple-400 to-pink-500 shadow-xl'
      default:
        return 'border border-border/50'
    }
  }

  // Render media with enhanced 3D effects
  const renderMedia = () => {
    if (!loop.media_url) return null

    const mediaClasses = `mt-3 rounded-lg overflow-hidden transition-all duration-300 ${
      isHovered ? 'scale-105 shadow-lg' : ''
    }`

    switch (loop.media_type) {
      case "image":
        return (
          <div className={mediaClasses}>
            <img
              src={loop.media_url || "/placeholder.svg"}
              alt="Loop media"
              className="w-full h-auto max-h-96 object-cover transition-transform duration-300"
            />
          </div>
        )
      case "video":
        return (
          <div className={`${mediaClasses} bg-black relative group`}>
            <video 
              controls 
              className="w-full h-auto max-h-96 transition-transform duration-300" 
              poster="/placeholder.svg?height=300&width=500"
            >
              <source src={loop.media_url} type="video/mp4" />
            </video>
          </div>
        )
      case "audio":
        return (
          <div className={`${mediaClasses} p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20`}>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600 rounded-full animate-pulse">
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

  // Enhanced like animation
  const handleLike = () => {
    onLike(loop.id)
    // Trigger particle effect for likes
    if (!loop.is_liked) {
      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), 600)
    }
  }

  return (
    <div 
      className={`card-3d perspective-1000 ${className}`}
      style={{ perspective: '1000px' }}
    >
      <Card 
        ref={cardRef}
        className={`
          relative transform-3d transition-all duration-300 ease-out cursor-pointer
          ${getVariantClasses()}
          ${isHovered ? 'shadow-2xl' : 'shadow-lg hover:shadow-xl'}
          ${variant === 'featured' ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10' : ''}
          ${variant === 'premium' ? 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10' : ''}
        `}
        style={{
          transform: getTransform(),
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Particle effects for featured content */}
        {(variant === 'featured' || isAnimating) && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`absolute w-1 h-1 bg-yellow-400 rounded-full animate-ping opacity-70`}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Premium glow effect */}
        {variant === 'premium' && (
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-25 animate-pulse" />
        )}

        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="avatar-3d">
                <Link href={`/profile/${user.username}`}>
                  <Avatar className={`h-10 w-10 transition-transform duration-300 ${isHovered ? 'scale-110 rotate-3' : ''}`}>
                    <AvatarImage src={user.avatar_url || "/placeholder.svg"} alt={user.display_name} />
                    <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Link>
              </div>
              <div className="flex items-center space-x-1">
                <Link href={`/profile/${user.username}`}>
                  <span className={`font-semibold hover:underline transition-colors duration-200 ${
                    isHovered ? 'text-primary' : ''
                  }`}>
                    {user.display_name}
                  </span>
                </Link>
                {user.is_verified && (
                  <Badge variant="secondary" className="h-4 w-4 p-0 bg-blue-500 animate-pulse">
                    <span className="text-white text-xs">✓</span>
                  </Badge>
                )}
                {user.is_premium && (
                  <Badge className="h-4 w-4 p-0 bg-gradient-to-r from-purple-500 to-pink-500">
                    <Sparkles className="h-2 w-2 text-white" />
                  </Badge>
                )}
                {user.level && user.level > 1 && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    L{user.level}
                  </Badge>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={`btn-3d transition-transform duration-200 ${
                  isHovered ? 'scale-110' : ''
                }`}>
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

          <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
            <span>@{user.username}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(loop.created_at), { addSuffix: true })}</span>
            {loop.engagement_score && loop.engagement_score > 80 && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                  <Zap className="h-2 w-2 mr-1" />
                  Hot
                </Badge>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0 relative z-10">
          <div className="space-y-3">
            {/* Content */}
            <div>
              <p className={`text-sm leading-relaxed transition-all duration-200 ${
                isHovered ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {showFullContent ? content : contentPreview}
              </p>
              {content.length > 200 && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto text-primary hover:text-primary/80 transition-colors duration-200"
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
                    <Badge 
                      variant="outline" 
                      className={`text-primary hover:bg-primary/10 transition-all duration-200 ${
                        isHovered ? 'scale-105 shadow-sm' : ''
                      }`}
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
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`btn-3d space-x-1 transition-all duration-300 ${
                    loop.is_liked 
                      ? "text-red-500 scale-110" 
                      : "hover:text-red-500 hover:scale-105"
                  }`}
                  onClick={handleLike}
                >
                  <Heart className={`h-4 w-4 transition-all duration-200 ${
                    loop.is_liked ? "fill-current animate-pulse" : ""
                  }`} />
                  <span className="font-medium">{loop.likes}</span>
                </Button>

                <Link href={`/loop/${loop.id}`}>
                  <Button variant="ghost" size="sm" className="btn-3d space-x-1 hover:scale-105 transition-all duration-300">
                    <MessageCircle className="h-4 w-4" />
                    <span className="font-medium">{loop.comments}</span>
                  </Button>
                </Link>

                <Button variant="ghost" size="sm" className="btn-3d space-x-1 hover:scale-105 transition-all duration-300">
                  <GitBranch className="h-4 w-4" />
                  <span className="font-medium">{loop.branches}</span>
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`btn-3d transition-all duration-300 ${
                    loop.is_bookmarked 
                      ? "text-yellow-500 scale-110" 
                      : "hover:text-yellow-500 hover:scale-105"
                  }`}
                  onClick={() => onBookmark(loop.id)}
                >
                  <Bookmark className={`h-4 w-4 ${loop.is_bookmarked ? "fill-current" : ""}`} />
                </Button>

                <Button variant="ghost" size="sm" className="btn-3d hover:scale-105 transition-all duration-300">
                  <Share className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
