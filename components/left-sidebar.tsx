"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Home,
  TrendingUp,
  Video,
  Radio,
  Calendar,
  MessageCircle,
  Users,
  Coins,
  Bookmark,
  Bell,
  Shield,
  Sparkles,
  LogOut,
  Flame,
  Activity,
  User,
} from "lucide-react"

interface CircleItem {
  id: string
  name: string
  description?: string
  member_count?: number
  avatar_url?: string
}

interface ActivityItem {
  id: string
  title: string
  created_at: string
  type: string
}

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"

export function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [trendingCircles, setTrendingCircles] = useState<CircleItem[]>([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    if (!user) return

    fetch("/api/circles?limit=5")
      .then((res) => res.json())
      .then((data) => {
        if (data.circles || data.data) {
          setTrendingCircles(data.circles || data.data || [])
        }
      })
      .catch(() => {})

    fetch("/api/notifications?unread_only=true", {
      headers: { Authorization: `Bearer ${user.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.notifications) {
          setUnreadNotifs(data.notifications.length)
        }
      })
      .catch(() => {})

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
  }, [user])

  if (!user) return null

  const mainNav = [
    { href: "/", label: "Home", icon: Home },
    { href: "/explore", label: "Explore", icon: TrendingUp },
    { href: "/reels", label: "Reels", icon: Video },
    { href: "/streams", label: "Live Streams", icon: Radio, badge: "LIVE" },
    { href: "/events", label: "Events Stage", icon: Calendar },
    { href: "/circles", label: "Circles", icon: Users },
    { href: "/co-loop/studio", label: "Co-Loop Studio", icon: Sparkles, badge: "NEW" },
    {
      href: "/messages",
      label: "Messages",
      icon: MessageCircle,
      count: unreadMessages > 0 ? unreadMessages : null,
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      count: unreadNotifs > 0 ? unreadNotifs : null,
    },
    { href: "/wallet", label: "Wallet & Gifts", icon: Coins },
    { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  ]

  const isAdmin = user.is_admin || (user as any).role === "admin" || user.email === "useehamza0@gmail.com"

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-2 px-3 py-2 shrink-0">
          <Link href="/" onClick={onLinkClick} className="flex items-center gap-2.5 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 p-[1px] shadow-md group-hover:scale-105 transition-transform">
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-background text-sm font-black tracking-tight text-foreground dark:bg-[#0b1220]">
                L
              </div>
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-indigo-600 bg-clip-text text-transparent">
                LOOP
              </span>
              <span className="ml-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                HUB
              </span>
            </div>
          </Link>
        </div>

        <ScrollArea className="flex-1 my-2 pr-2 scrollbar-thin">
          {/* Main Navigation Links */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Navigation
            </p>
            {mainNav.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onLinkClick}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <Badge className="bg-rose-500 text-[9px] px-1.5 py-0 text-white font-bold animate-pulse">
                      {item.badge}
                    </Badge>
                  )}
                  {item.count ? (
                    <Badge className="bg-sky-500 text-[10px] px-1.5 py-0 text-white font-bold">
                      {item.count}
                    </Badge>
                  ) : null}
                </Link>
              )
            })}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={onLinkClick}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  pathname.startsWith("/admin")
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-amber-500 hover:bg-amber-500/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4" />
                  <span>Admin Dashboard</span>
                </div>
                <Badge variant="outline" className="border-amber-500/50 text-[9px]">
                  ADMIN
                </Badge>
              </Link>
            )}
          </div>

          {/* Trending Circles Section */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between px-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Trending Circles
              </p>
            </div>

            <div className="space-y-1">
              {trendingCircles.length === 0 ? (
                <p className="px-3 text-xs text-muted-foreground italic">No circles found</p>
              ) : (
                trendingCircles.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    href={`/circles/${c.id}`}
                    onClick={onLinkClick}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all hover:bg-muted"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={c.avatar_url} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {c.name?.charAt(0) || "C"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground truncate">{c.name}</span>
                    </div>
                    {c.member_count !== undefined && (
                      <span className="text-[10px] text-muted-foreground">{c.member_count}m</span>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick User Balance Card */}
          <div className="mt-6 rounded-2xl border border-border/60 bg-muted/40 p-3.5 text-xs space-y-2 mb-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">Loop Coins</span>
              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs font-bold">
                🪙 {Number(user.loop_coins || 0).toLocaleString()}
              </Badge>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full text-xs rounded-xl h-7" onClick={onLinkClick}>
              <Link href="/wallet">Top Up & Send Gifts</Link>
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Footer User Profile & Logout */}
      <div className="border-t border-border/60 pt-3 shrink-0 flex items-center justify-between">
        <Link href={`/profile/${user.username}`} onClick={onLinkClick} className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar_url || user.user_metadata?.avatar_url} />
            <AvatarFallback>{(user.display_name || user.username || "U").charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">{user.display_name || user.username}</p>
            <p className="text-[10px] text-muted-foreground truncate">@{user.username}</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onLinkClick?.()
            void signOut()
          }}
          className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function LeftSidebar() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-border/60 bg-card/50 p-4 lg:flex">
      <SidebarContent />
    </aside>
  )
}

export function MobileSidebarSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] p-4 bg-card border-r border-border/60">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation Menu</SheetTitle>
        </SheetHeader>
        <SidebarContent onLinkClick={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
