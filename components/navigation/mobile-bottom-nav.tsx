"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, Video, MessageCircle, User, LogIn, Compass, Menu } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { cn } from "@/lib/utils"
import { useLoginGate } from "@/hooks/use-login-gate"
import { MobileSidebarSheet } from "@/components/left-sidebar"

const HIDDEN_PREFIXES = [
  "/login",
  "/signup",
  "/onboarding",
  "/landing",
  "/reset-password",
  "/verify-email",
  "/terms",
  "/privacy",
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    const fetchUnread = () => {
      fetch("/api/messages/unread-count", {
        headers: { Authorization: `Bearer ${user.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && typeof data.count === "number") {
            setUnreadCount(data.count)
          }
        })
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [user])

  if (loading) return null
  if (HIDDEN_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return null
  }

  const profileHref = user
    ? `/profile/${user.username || user.user_metadata?.username || ""}`
    : "/login"
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

  const items = user
    ? [
        { href: "/", icon: Home, label: "Home" },
        { href: "/search", icon: Search, label: "Search" },
        { href: "/trees", icon: Video, label: "Trees" },
        { href: "/messages", icon: MessageCircle, label: "Chat", auth: true as const },
      ]
    : [
        { href: "/", icon: Home, label: "Home" },
        { href: "/search", icon: Search, label: "Search" },
        { href: "/explore", icon: Compass, label: "Explore" },
        { href: "/trees", icon: Video, label: "Trees" },
      ]

  return (
    <>
      {LoginGateDialog}
      <MobileSidebarSheet open={menuOpen} onOpenChange={setMenuOpen} />

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 px-1 py-1.5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Menu className="h-5 w-5 text-cyan-400" />
            <span>Menu</span>
          </button>

          {items.slice(0, 3).map((item) => {
            const active = isActive(item.href)
            const needsAuth = "auth" in item && Boolean(item.auth)
            return (
              <Link
                key={item.href + item.label}
                href={needsAuth && !user ? "#" : item.href}
                onClick={(e) => {
                  if (needsAuth && !requireAuth("message")) {
                    e.preventDefault()
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.href === "/messages" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            )
          })}

          {user ? (
            <Link
              href={profileHref}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
                pathname.startsWith("/profile") ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {user.avatar_url || user.user_metadata?.avatar_url || (user as any).video_avatar_url ? (
                <VideoAvatar
                  src={user.avatar_url || user.user_metadata?.avatar_url}
                  videoSrc={(user as any).video_avatar_url || null}
                  isPremium={user.is_premium}
                  alt={user.display_name || user.username}
                  size="sm"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
              <span>You</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium text-sky-600"
            >
              <LogIn className="h-5 w-5" />
              <span>Log in</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}
