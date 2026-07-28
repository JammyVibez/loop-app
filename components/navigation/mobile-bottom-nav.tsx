"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Compass, Video, MessageCircle, User } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const items = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/explore", icon: Compass, label: "Explore" },
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
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#030712]/92 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
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
                active ? "text-cyan-300" : "text-slate-400 hover:text-slate-200",
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]")} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <Link
          href={profileHref}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
            pathname.startsWith("/profile") ? "text-cyan-300" : "text-slate-400 hover:text-slate-200",
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
