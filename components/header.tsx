"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  Sparkles,
  Shield,
  X,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserBadges } from "@/components/user-badge"

function LogoMark() {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 p-[1px] shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-background text-xs font-black tracking-tight text-foreground dark:bg-[#0b1220] dark:text-white">
        L
      </div>
    </div>
  )
}

export function Header() {
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { user, signOut } = useAuth()
  const router = useRouter()

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
              <span className="text-base font-bold tracking-tight text-foreground">Loop</span>
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
              <span className="text-base font-bold tracking-tight text-foreground">Loop</span>
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

          {/* Create Button */}
          <Link href="/create">
            <Button
              size="sm"
              className="h-8 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-3 font-semibold text-xs text-white shadow-sm hover:from-violet-500 hover:to-cyan-400"
            >
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </Link>

          {/* Notifications */}
          <NotificationDropdown />

          {/* Messages */}
          <Link href="/messages">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Messages">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
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
