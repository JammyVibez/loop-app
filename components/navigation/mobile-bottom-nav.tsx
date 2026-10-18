"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, Video, MessageCircle, Compass, Menu } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { useLoginGate } from "@/hooks/use-login-gate"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { formatUnreadBadge } from "@/lib/unread-messages"
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

/**
 * Mobile tab bar: the four destinations worth a thumb tap, plus the drawer
 * for everything else. The profile lives in the header's avatar menu, so it
 * does not need a permanent tab here — that slot now carries Messages, the
 * one surface people check constantly and the only way to reach an unread DM
 * without opening the avatar dropdown first.
 */
export function MobileBottomNav() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()
  const [menuOpen, setMenuOpen] = useState(false)
  const unreadCount = useUnreadMessages()

  if (loading) return null
  if (HIDDEN_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return null
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

  const items = user
    ? [
        { href: "/", icon: Home, label: "Home" },
        { href: "/search", icon: Search, label: "Search" },
        { href: "/messages", icon: MessageCircle, label: "Messages", auth: true as const },
        { href: "/trees", icon: Video, label: "Trees" },
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
        <div className="grid grid-cols-5 items-stretch px-1 py-1.5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <Menu className="h-5 w-5 text-cyan-400" />
            <span>Menu</span>
          </button>

          {items.map((item) => {
            const active = isActive(item.href)
            const needsAuth = "auth" in item && Boolean(item.auth)
            const badge = item.href === "/messages" ? unreadCount : 0
            return (
              <Link
                key={item.href}
                href={needsAuth && !user ? "#" : item.href}
                onClick={(e) => {
                  if (needsAuth && !requireAuth("message")) {
                    e.preventDefault()
                  }
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* A quiet pill behind the current tab — easier to read at a
                    glance than a colour change alone in bright outdoor light. */}
                <span
                  className={cn(
                    "absolute inset-x-2 inset-y-1 -z-10 rounded-xl transition-colors",
                    active ? "bg-primary/10" : "bg-transparent",
                  )}
                />
                <div className="relative">
                  <item.icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                      {formatUnreadBadge(badge)}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
