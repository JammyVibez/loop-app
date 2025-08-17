"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Search, 
  MessageCircle, 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Sparkles, 
  Zap,
  Crown,
  Gift,
  Trophy
} from "lucide-react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { Badge } from "../ui/badge"
import { Progress } from "../ui/progress"
import { useAuth } from "../../providers/auth-provider"
import { useTheme3D } from "@/providers/theme-3d-provider"
import { EnhancedNotificationDropdown3D } from "./enhanced-notification-dropdown-3d"

interface XPDisplayProps {
  currentXP: number
  level: number
  nextLevelXP: number
  className?: string
}

function XPDisplay({ currentXP, level, nextLevelXP, className = "" }: XPDisplayProps) {
  const progress = ((currentXP % 1000) / 1000) * 100 // Assuming 1000 XP per level
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-1">
        <Trophy className="h-3 w-3 text-yellow-500" />
        <span className="text-xs font-medium">L{level}</span>
      </div>
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{currentXP % 1000}/1000</span>
    </div>
  )
}

export function EnhancedHeader3D() {
  const { user, logout } = useAuth()
  const { currentTheme } = useTheme3D()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const headerRef = useRef<HTMLElement>(null)

  // Mock user data with gamification
  const enhancedUser = user ? {
    ...user,
    xp_points: 2750,
    level: 3,
    loop_coins: 1250,
    unread_messages: 3,
    achievements_count: 12,
    is_premium: true
  } : null

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Mouse tracking for subtle 3D effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height
        setMousePosition({ x, y })
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search/${encodeURIComponent(searchQuery)}`)
      setSearchQuery("")
      setSearchFocused(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  if (!enhancedUser) {
    return (
      <header 
        ref={headerRef}
        className={`nav-3d sticky top-0 z-50 w-full transition-all duration-300 ${
          isScrolled 
            ? 'backdrop-blur-xl bg-background/80 shadow-lg border-b border-border/50' 
            : 'bg-background/60 border-b border-border/30'
        }`}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Loop
            </span>
          </Link>

          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost" className="btn-3d">Login</Button>
            </Link>
            <Link href="/signup">
              <Button className="btn-3d">Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header 
      ref={headerRef}
      className={`nav-3d sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? 'backdrop-blur-xl bg-background/90 shadow-2xl border-b border-border/50' 
          : 'bg-background/70 border-b border-border/30'
      }`}
      style={{
        transform: `translateZ(0) rotateX(${mousePosition.y * 0.5}deg)`,
        transformStyle: 'preserve-3d'
      }}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo with enhanced 3D effects */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="relative">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-12 shadow-lg">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-300" />
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300">
            Loop
          </span>
        </Link>

        {/* Enhanced Search Bar - Desktop */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
          <div className={`relative w-full transition-all duration-300 ${
            searchFocused ? 'scale-105' : ''
          }`}>
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${
              searchFocused ? 'text-primary' : 'text-muted-foreground'
            }`} />
            <Input
              type="text"
              placeholder="Search loops, users, circles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={`pl-10 pr-4 w-full card-3d transition-all duration-300 ${
                searchFocused 
                  ? 'ring-2 ring-primary/50 shadow-lg scale-105' 
                  : 'hover:shadow-md'
              }`}
            />
            {/* Search suggestions indicator */}
            {searchQuery && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
            )}
          </div>
        </form>

        {/* Enhanced Navigation - Desktop */}
        <nav className="hidden md:flex items-center space-x-4">
          {/* XP Display */}
          <div className="hidden lg:block">
            <XPDisplay 
              currentXP={enhancedUser.xp_points} 
              level={enhancedUser.level} 
              nextLevelXP={4000}
              className="px-3 py-1 bg-background/50 rounded-full border border-border/50"
            />
          </div>

          {/* Loop Coins */}
          <div className="hidden lg:flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-full border border-yellow-200 dark:border-yellow-800">
            <Zap className="h-3 w-3 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
              {enhancedUser.loop_coins.toLocaleString()}
            </span>
          </div>

          {/* Messages */}
          <Link href="/messages">
            <Button variant="ghost" size="sm" className="btn-3d relative group">
              <MessageCircle className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
              {enhancedUser.unread_messages > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 animate-pulse">
                  {enhancedUser.unread_messages}
                </Badge>
              )}
            </Button>
          </Link>

          {/* Enhanced Notifications */}
          <EnhancedNotificationDropdown3D />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full btn-3d group">
                <div className="relative">
                  <Avatar className="h-8 w-8 transition-all duration-300 group-hover:scale-110">
                    <AvatarImage src={enhancedUser.avatar_url || "/placeholder.svg"} alt={enhancedUser.display_name} />
                    <AvatarFallback>{enhancedUser.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {/* Premium indicator */}
                  {enhancedUser.is_premium && (
                    <div className="absolute -top-1 -right-1">
                      <Crown className="h-3 w-3 text-yellow-500 animate-pulse" />
                    </div>
                  )}
                  {/* Level indicator */}
                  <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {enhancedUser.level}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 modal-3d-content" align="end" forceMount>
              <div className="flex items-center justify-start gap-3 p-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={enhancedUser.avatar_url || "/placeholder.svg"} alt={enhancedUser.display_name} />
                  <AvatarFallback>{enhancedUser.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1 leading-none">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium">{enhancedUser.display_name}</p>
                    {enhancedUser.is_premium && (
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="w-[200px] truncate text-sm text-muted-foreground">@{enhancedUser.username}</p>
                  <XPDisplay 
                    currentXP={enhancedUser.xp_points} 
                    level={enhancedUser.level} 
                    nextLevelXP={4000}
                    className="mt-2"
                  />
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/profile/${enhancedUser.username}`} className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/achievements" className="flex items-center">
                  <Trophy className="mr-2 h-4 w-4" />
                  Achievements ({enhancedUser.achievements_count})
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/shop" className="flex items-center">
                  <Gift className="mr-2 h-4 w-4" />
                  Shop
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Mobile Menu Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="md:hidden btn-3d" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Enhanced Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-xl modal-3d-content">
          <div className="container mx-auto px-4 py-4 space-y-4">
            {/* Mobile Search */}
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 card-3d"
                />
              </div>
            </form>

            {/* Mobile XP Display */}
            <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
              <XPDisplay 
                currentXP={enhancedUser.xp_points} 
                level={enhancedUser.level} 
                nextLevelXP={4000}
              />
              <div className="flex items-center space-x-1">
                <Zap className="h-3 w-3 text-yellow-600" />
                <span className="text-sm font-medium">{enhancedUser.loop_coins.toLocaleString()}</span>
              </div>
            </div>

            {/* Mobile Navigation */}
            <div className="flex flex-col space-y-2">
              <Link href={`/profile/${enhancedUser.username}`} onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start btn-3d">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Button>
              </Link>
              <Link href="/messages" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start btn-3d">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Messages
                  {enhancedUser.unread_messages > 0 && (
                    <Badge className="ml-auto bg-red-500">{enhancedUser.unread_messages}</Badge>
                  )}
                </Button>
              </Link>
              <Link href="/achievements" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start btn-3d">
                  <Trophy className="mr-2 h-4 w-4" />
                  Achievements ({enhancedUser.achievements_count})
                </Button>
              </Link>
              <Link href="/shop" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start btn-3d">
                  <Gift className="mr-2 h-4 w-4" />
                  Shop
                </Button>
              </Link>
              <Link href="/settings" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start btn-3d">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start btn-3d text-red-600 dark:text-red-400" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
