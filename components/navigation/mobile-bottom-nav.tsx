"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, Video, MessageCircle, User } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const items = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/reels", icon: Video, label: "Reels" },
  { href: "/messages", icon: MessageCircle, label: "Chat" },
]

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

  if (loading || !user) return null
  if (HIDDEN_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return null
  }

  const profileHref = `/profile/${user.username || user.user_metadata?.username || ""}`
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 px-1 py-1.5">
        {items.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <Link
          href={profileHref}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
            pathname.startsWith("/profile") ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {user.avatar_url || user.user_metadata?.avatar_url ? (
            <Avatar className="h-5 w-5">
              <AvatarImage src={user.avatar_url || user.user_metadata?.avatar_url} />
              <AvatarFallback className="text-[9px]">
                {(user.display_name || user.username || "U").charAt(0)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-5 w-5" />
          )}
          <span>You</span>
        </Link>
      </div>
    </nav>
  )
}
