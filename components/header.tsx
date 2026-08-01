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
import { Search, MessageCircle, Settings, User, Users, LogOut, Plus, Coins, Crown, Sparkles, Shield, Store, Radio, Package, Calendar } from "lucide-react"
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
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) router.push(`/search/${encodeURIComponent(q)}`)
    else router.push("/search")
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

          <Link href="/streams" className="hidden md:block">
            <Button variant="outline" size="sm" className="rounded-full">
              <Radio className="mr-2 h-4 w-4 text-rose-500" />
              Live
            </Button>
          </Link>

          <Link href="/wallet" className="hidden sm:block">
            <Button variant="outline" size="sm" className="rounded-full border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500">
              <Coins className="mr-1.5 h-4 w-4 text-yellow-500" />
              <span className="font-semibold text-xs">{user.loop_coins.toLocaleString()}</span>
            </Button>
          </Link>

          <Link href="/messages">
            <Button variant="ghost" size="sm" className="rounded-full">
              <MessageCircle className="h-5 w-5" />
            </Button>
          </Link>

          <NotificationDropdown />

          <Link href={`/profile/${user.username}`}>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border bg-muted/40 p-0 hover:opacity-80 transition-opacity">
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
          </Link>
        </div>
      </div>
    </header>
  )
}
