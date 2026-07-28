"use client"

import { useState } from "react"
import Link from "next/link"
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
import { Search, MessageCircle, Settings, User, LogOut, Plus, Coins, Crown, Sparkles, Shield } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"

function LogoMark() {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 p-[1px] shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-background text-sm font-bold tracking-tight text-foreground dark:bg-[#0b1220] dark:text-white">
        L
      </div>
    </div>
  )
}

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
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <LogoMark />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight text-foreground">Loop</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Social OS</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-5 font-semibold text-white shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-cyan-400">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <LogoMark />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-lg font-semibold tracking-tight text-foreground">Loop</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Social OS</span>
          </div>
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <form onSubmit={handleSearch} className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search loops, people, circles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-full border-border bg-muted/40 pl-11 pr-4 placeholder:text-muted-foreground"
            />
          </form>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          <Link href="/create">
            <Button size="sm" className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-3 font-semibold text-white shadow-lg shadow-violet-600/25 hover:from-violet-500 hover:to-cyan-400 sm:px-4">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </Link>

          <Link href="/shop" className="hidden sm:block">
            <Button variant="outline" size="sm" className="rounded-full">
              <Coins className="mr-2 h-4 w-4 text-yellow-500" />
              <span className="hidden font-semibold lg:inline">{user.loop_coins.toLocaleString()}</span>
            </Button>
          </Link>

          <Link href="/messages">
            <Button variant="ghost" size="sm" className="rounded-full">
              <MessageCircle className="h-5 w-5" />
            </Button>
          </Link>

          <NotificationDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border bg-muted/40 p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url} alt={user.display_name} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-xs text-white">
                    {user.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {user.is_premium && (
                  <Crown className="absolute -right-1 -top-1 h-3.5 w-3.5 text-yellow-500 drop-shadow" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none">{user.display_name}</p>
                    {user.is_verified && <Badge variant="secondary">✓</Badge>}
                    {user.is_premium && (
                      <Badge variant="outline">
                        <Sparkles className="mr-1 h-3 w-3" /> Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs leading-none text-muted-foreground">@{user.username}</p>
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
                <Link href="/circles">
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span>Circles</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/explore">
                  <Search className="mr-2 h-4 w-4" />
                  <span>Explore</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              {user.is_admin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    <span>App Admin</span>
                  </Link>
                </DropdownMenuItem>
              )}
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
