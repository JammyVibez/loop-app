"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Home,
  Search,
  Video,
  Radio,
  MessageCircle,
  Bell,
  User,
  Settings,
  LogOut,
  Plus,
  TrendingUp,
  Users,
  Bookmark,
  Crown,
  DollarSign,
  Menu,
  X,
  Coins,
  Shield,
  Sparkles,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

const navigationItems = [
  { href: "/", icon: Home, label: "Home", badge: null },
  { href: "/explore", icon: TrendingUp, label: "Explore", badge: null },
  { href: "/reels", icon: Video, label: "Reels", badge: null },
  { href: "/streams", icon: Radio, label: "Live", badge: "live" },
  { href: "/messages", icon: MessageCircle, label: "Messages", badge: null },
  { href: "/circles", icon: Users, label: "Circles", badge: null },
  { href: "/bookmarks", icon: Bookmark, label: "Bookmarks", badge: null },
]

export function MainNavigation() {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [notifications, setNotifications] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [liveStreams, setLiveStreams] = useState(0)

  useEffect(() => {
    // Fetch notification count
    fetchNotificationCount()
    // Fetch live streams count
    fetchLiveStreamsCount()
  }, [])

  const fetchNotificationCount = async () => {
    try {
      const response = await fetch("/api/notifications?unread_only=true", {
        headers: {
          Authorization: `Bearer ${user?.access_token}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.data?.unread_count || 0)
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  const fetchLiveStreamsCount = async () => {
    try {
      const response = await fetch("/api/streams?status=live&limit=1")
      if (response.ok) {
        const data = await response.json()
        setLiveStreams(data.data?.streams?.length || 0)
      }
    } catch (error) {
      console.error("Failed to fetch live streams:", error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/search/${encodeURIComponent(searchQuery.trim())}`
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      })
    }
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300 group-hover:scale-105">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Loop
                </span>
                <span className="text-xs text-muted-foreground -mt-1">Social Reimagined</span>
              </div>
            </Link>

            <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-8">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder="Search loops, users, hashtags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-3 bg-muted/50 border-border/50 rounded-xl focus:bg-background focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/70"
                />
              </div>
            </form>

            <div className="flex items-center space-x-2">
              {navigationItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive(item.href) ? "default" : "ghost"}
                    size="sm"
                    className={`relative px-4 py-2 rounded-lg transition-all duration-200 ${
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-muted/80 hover:scale-105"
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                    {item.badge === "live" && liveStreams > 0 && (
                      <Badge className="ml-2 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-0.5 animate-pulse">
                        {liveStreams}
                      </Badge>
                    )}
                  </Button>
                </Link>
              ))}

              <Link href="/notifications">
                <Button
                  variant={pathname === "/notifications" ? "default" : "ghost"}
                  size="sm"
                  className="relative p-2 rounded-lg hover:scale-105 transition-all duration-200"
                >
                  <Bell className="w-5 h-5" />
                  {notifications > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center border-2 border-background">
                      {notifications > 99 ? "99+" : notifications}
                    </Badge>
                  )}
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 hover:from-purple-600 hover:via-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-purple-500/25 transition-all duration-200 hover:scale-105 px-4 py-2 rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-background/95 backdrop-blur-md border border-border/50 shadow-xl rounded-xl"
                >
                  <DropdownMenuItem asChild className="rounded-lg">
                    <Link href="/create/loop" className="flex items-center px-3 py-2">
                      <Home className="w-4 h-4 mr-3 text-purple-500" />
                      <div>
                        <div className="font-medium">Create Loop</div>
                        <div className="text-xs text-muted-foreground">Share your thoughts</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg">
                    <Link href="/create/reel" className="flex items-center px-3 py-2">
                      <Video className="w-4 h-4 mr-3 text-blue-500" />
                      <div>
                        <div className="font-medium">Create Reel</div>
                        <div className="text-xs text-muted-foreground">Short video content</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg">
                    <Link href="/create/stream" className="flex items-center px-3 py-2">
                      <Radio className="w-4 h-4 mr-3 text-red-500" />
                      <div>
                        <div className="font-medium">Go Live</div>
                        <div className="text-xs text-muted-foreground">Start streaming</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative p-1 rounded-lg hover:scale-105 transition-all duration-200"
                  >
                    <Avatar className="w-8 h-8 ring-2 ring-transparent hover:ring-primary/20 transition-all duration-200">
                      <AvatarImage src={user?.user_metadata?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
                        {user?.user_metadata?.display_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {user?.user_metadata?.is_premium && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                        <Crown className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-72 bg-background/95 backdrop-blur-md border border-border/50 shadow-xl rounded-xl"
                >
                  <div className="px-4 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-t-xl">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={user?.user_metadata?.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold text-lg">
                          {user?.user_metadata?.display_name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{user?.user_metadata?.display_name || "User"}</p>
                        <p className="text-sm text-muted-foreground">@{user?.user_metadata?.username || "username"}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          {user?.user_metadata?.is_premium && (
                            <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs px-2 py-0.5">
                              <Crown className="w-3 h-3 mr-1" />
                              Premium
                            </Badge>
                          )}
                          {user?.user_metadata?.is_verified && (
                            <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5">
                              <Shield className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-background/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-medium">Loop Coins</span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        >
                          {user?.loop_coins?.toLocaleString() || "0"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <DropdownMenuItem asChild className="rounded-lg mx-2">
                      <Link href={`/profile/${user?.user_metadata?.username}`} className="flex items-center px-3 py-2">
                        <User className="w-4 h-4 mr-3" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg mx-2">
                      <Link href="/shop" className="flex items-center px-3 py-2">
                        <Sparkles className="w-4 h-4 mr-3" />
                        Shop
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg mx-2">
                      <Link href="/earnings" className="flex items-center px-3 py-2">
                        <DollarSign className="w-4 h-4 mr-3" />
                        Earnings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg mx-2">
                      <Link href="/settings" className="flex items-center px-3 py-2">
                        <Settings className="w-4 h-4 mr-3" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator className="mx-2" />
                  <div className="py-2">
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg mx-2"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Mobile Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-purple-500/25 transition-all duration-300">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Loop
              </span>
            </Link>

            <div className="flex items-center space-x-2">
              {/* Search Button */}
              <Link href="/search">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 rounded-lg hover:scale-105 transition-all duration-200"
                >
                  <Search className="w-5 h-5" />
                </Button>
              </Link>

              {/* Notifications */}
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative p-2 rounded-lg hover:scale-105 transition-all duration-200"
                >
                  <Bell className="w-5 h-5" />
                  {notifications > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs min-w-[18px] h-4 rounded-full flex items-center justify-center border border-background">
                      {notifications > 9 ? "9+" : notifications}
                    </Badge>
                  )}
                </Button>
              </Link>

              {/* Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:scale-105 transition-all duration-200"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-4 space-y-2">
              {navigationItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant={isActive(item.href) ? "default" : "ghost"}
                    className="w-full justify-start rounded-lg transition-all duration-200 hover:scale-[1.02]"
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.label}
                    {item.badge === "live" && liveStreams > 0 && (
                      <Badge className="ml-auto bg-red-500 text-white text-xs animate-pulse">{liveStreams}</Badge>
                    )}
                  </Button>
                </Link>
              ))}

              <div className="border-t border-border/50 pt-3 mt-3">
                <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full justify-start bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 hover:from-purple-600 hover:via-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 hover:scale-[1.02]">
                    <Plus className="w-5 h-5 mr-3" />
                    Create
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50 shadow-lg">
        <div className="grid grid-cols-5 py-2">
          {navigationItems.slice(0, 4).map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center py-3 px-2 group">
              <div className="relative">
                <item.icon
                  className={`w-6 h-6 transition-all duration-200 group-hover:scale-110 ${
                    isActive(item.href) ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {item.badge === "live" && liveStreams > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border border-background"></div>
                )}
                {isActive(item.href) && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
                )}
              </div>
              <span
                className={`text-xs mt-1 transition-all duration-200 ${
                  isActive(item.href) ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {item.label}
              </span>
            </Link>
          ))}

          <Link
            href={`/profile/${user?.user_metadata?.username}`}
            className="flex flex-col items-center py-3 px-2 group"
          >
            <div className="relative">
              <Avatar className="w-6 h-6 transition-all duration-200 group-hover:scale-110">
                <AvatarImage src={user?.user_metadata?.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                  {user?.user_metadata?.display_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              {user?.user_metadata?.is_premium && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <Crown className="w-1.5 h-1.5 text-white" />
                </div>
              )}
              {pathname.includes("/profile") && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
              )}
            </div>
            <span
              className={`text-xs mt-1 transition-all duration-200 ${
                pathname.includes("/profile")
                  ? "text-primary font-medium"
                  : "text-muted-foreground group-hover:text-foreground"
              }`}
            >
              Profile
            </span>
          </Link>
        </div>
      </nav>

      <div className="h-20 lg:h-24"></div>
      <div className="lg:hidden h-20"></div>
    </>
  )
}
