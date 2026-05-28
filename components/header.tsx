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
import { Search, MessageCircle, Settings, User, LogOut, Plus, Coins, Crown, Sparkles } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"

function LogoMark() {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 p-[1px] shadow-lg shadow-violet-500/25 transition-transform duration-300 group-hover:scale-105">
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0b1220] text-sm font-bold tracking-tight text-white">
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
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#030712]/75 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <LogoMark />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight text-white">Loop</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">Social OS</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-300 hover:bg-white/5 hover:text-white">
                Log In
              </Button>
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
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#030712]/75 backdrop-blur-xl supports-[backdrop-filter]:bg-[#030712]/70">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <LogoMark />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-lg font-semibold tracking-tight text-white">Loop</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">Social OS</span>
          </div>
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <form onSubmit={handleSearch} className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              type="text"
              placeholder="Search loops, people, circles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-11 pr-4 text-slate-100 placeholder:text-slate-500 shadow-inner shadow-black/20 backdrop-blur focus-visible:ring-cyan-400/50"
            />
          </form>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/create">
            <Button size="sm" className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-3 font-semibold text-white shadow-lg shadow-violet-600/25 hover:from-violet-500 hover:to-cyan-400 sm:px-4">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </Link>

          <Link href="/shop" className="hidden sm:block">
            <Button variant="outline" size="sm" className="rounded-full border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10 hover:text-white">
              <Coins className="mr-2 h-4 w-4 text-yellow-300" />
              <span className="hidden font-semibold lg:inline">{user.loop_coins.toLocaleString()}</span>
            </Button>
          </Link>

          <Link href="/messages">
            <Button variant="ghost" size="sm" className="rounded-full text-slate-300 hover:bg-white/10 hover:text-white">
              <MessageCircle className="h-5 w-5" />
            </Button>
          </Link>

          <NotificationDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-white/10 bg-white/[0.04] p-0 hover:bg-white/10">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url} alt={user.display_name} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-xs text-white">
                    {user.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {user.is_premium && (
                  <Crown className="absolute -right-1 -top-1 h-3.5 w-3.5 text-yellow-300 drop-shadow" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 border-white/10 bg-[#0a1020]/95 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-xl" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none">{user.display_name}</p>
                    {user.is_verified && <Badge className="bg-cyan-500/15 text-cyan-200">✓</Badge>}
                    {user.is_premium && (
                      <Badge variant="outline" className="border-yellow-400/30 text-yellow-200">
                        <Sparkles className="mr-1 h-3 w-3" /> Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs leading-none text-slate-500">@{user.username}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white">
                <Link href={`/profile/${user.username}`}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white">
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white">
                <Link href="/shop">
                  <Coins className="mr-2 h-4 w-4" />
                  <span>Shop</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={handleLogout} className="focus:bg-white/10 focus:text-white">
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
