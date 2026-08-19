"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppLogo } from "@/components/brand/app-logo"
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
  MessageCircle,
  Settings,
  User,
  LogOut,
  Plus,
  Coins,
  Radio,
  Bookmark,
  Zap,
  Shield,
  X,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserBadges } from "@/components/user-badge"

function LogoMark() {
  return (
    <AppLogo className="rounded-2xl shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-105" />
  )
}

export function Header() {
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const { user, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    const fetchUnread = () => {
      fetch("/api/messages/unread-count", {
        headers: { Authorization: `Bearer ${user.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && typeof data.count === "number") {
            setUnreadMessages(data.count)
          }
        })
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [user])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) router.push(`/search/${encodeURIComponent(q)}`)
    else router.push("/search")
  }

  const handleLogout = async () => {
    try {
      await signOut()
      window.location.href = "/landing"
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  if (!user) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <LogoMark />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight text-foreground">loopapp.me</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Social OS</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-4 font-semibold text-white shadow-md">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>
    )
  }

  const isAdmin = user.is_admin || (user as any).role === "admin" || user.email === "useehamza0@gmail.com"

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
        {/* Brand & Expandable Search Input */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <LogoMark />
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-base font-bold tracking-tight text-foreground">loopapp.me</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Social OS</span>
            </div>
          </Link>

          {/* Desktop & Mobile Responsive Search */}
          {mobileSearchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center gap-1 w-full max-w-xs animate-in fade-in duration-150">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  autoFocus
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 rounded-full border-border bg-muted/40 pl-8 pr-3 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setMobileSearchOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSearch} className="hidden md:flex relative w-48 lg:w-72 transition-all">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-full border-border bg-muted/40 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:ring-sky-500"
              />
            </form>
          )}
        </div>

        {/* Consolidated Actions Bar */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Mobile search trigger */}
          {!mobileSearchOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full md:hidden"
              onClick={() => setMobileSearchOpen(true)}
              title="Search"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}

          <ThemeToggle />

          {/* Notifications */}
          <NotificationDropdown />

          {/* Messages */}
          <Link href="/messages" className="relative">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Messages">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
            {unreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </Link>

          {/* Consolidated User Profile Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative h-8 w-8 rounded-full border border-border/80 bg-muted/50 p-0 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <Avatar className="h-full w-full">
                  <AvatarImage src={user.avatar_url} alt={user.display_name} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-[10px] font-bold text-white">
                    {(user.display_name || user.username || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl">
              <DropdownMenuLabel className="font-normal p-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold leading-none truncate">{user.display_name || user.username}</p>
                    <UserBadges
                      is_verified={user.is_verified}
                      is_team_member={user.is_team_member}
                      is_sponsor={user.is_sponsor}
                      email={user.email}
                      username={user.username}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-none">@{user.username}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                <Link href={`/profile/${user.username}`} className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Your Profile</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Settings</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="rounded-xl text-rose-500 hover:text-rose-600 focus:text-rose-600 cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="text-xs font-semibold">Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
