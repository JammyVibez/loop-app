"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Bell,
  MessageCircle,
  Settings,
  User,
  LogOut,
  Plus,
  Coins,
  Crown,
  Menu,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"
import Link from "next/link"

export function Header() {
  const [searchQuery, setSearchQuery] = useState("")
  const { user, logout } = useAuth()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/search/${encodeURIComponent(searchQuery.trim())}`
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = "/landing"
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  if (!user) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Loop
            </span>
          </Link>

          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xs sm:text-sm">L</span>
          </div>
          <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Loop
          </span>
        </Link>

        {/* Search Bar - Hidden on mobile, shown on tablet+ */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search loops, users, circles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 w-full"
            />
          </form>
        </div>

        {/* Mobile Search Button */}
        <div className="md:hidden">
          <Link href="/search">
            <Button variant="ghost" size="sm">
              <Search className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
          {/* Create Button - Hidden text on mobile */}
          <Button size="sm" className="bg-gradient-to-r from-purple-500 to-blue-500">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Create</span>
          </Button>

          {/* Loop Coins - Hidden on mobile */}
          <Link href="/shop" className="hidden sm:block">
            <Button variant="outline" size="sm" className="flex items-center space-x-2">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold hidden lg:inline">{user.loop_coins.toLocaleString()}</span>
            </Button>
          </Link>

          {/* Messages */}
          <Link href="/messages">
            <Button variant="ghost" size="sm">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>

          {/* Notifications */}
          <NotificationDropdown />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-6 w-6 sm:h-8 sm:w-8 rounded-full">
                <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                  <AvatarImage src={user.avatar_url} alt={user.display_name} />
                  <AvatarFallback className="text-xs sm:text-sm">
                    {user.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {user.is_premium && (
                  <Crown className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 text-yellow-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium leading-none">
                      {user.display_name}
                    </p>
                    {user.is_verified && (
                      <Badge variant="secondary" className="text-xs">
                        ✓
                      </Badge>
                    )}
                    {user.is_premium && (
                      <Badge variant="outline" className="text-xs">
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs leading-none text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/profile/${user.username}`}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/shop">
                  <Coins className="mr-2 h-4 w-4" />
                  <span>Shop</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
