"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatedIconView } from "@/components/icons/animated/animated-icon-view"
import type { AnimatedIconComponent } from "@/components/icons/animated/animated-icon-view"
import HomeIcon from "@/components/icons/animated/home-icon"
import MagnifierIcon from "@/components/icons/animated/magnifier-icon"
import PenIcon from "@/components/icons/animated/pen-icon"
import UsersIcon from "@/components/icons/animated/users-icon"
import MessageCircleIcon from "@/components/icons/animated/message-circle-icon"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { useLoginGate } from "@/hooks/use-login-gate"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { formatUnreadBadge } from "@/lib/unread-messages"
import { EMPTY_AUDIENCE, primarySidebarNav } from "@/lib/sidebar-nav"
import { MobileSidebarSheet } from "@/components/left-sidebar"

const MOBILE_NAV_ICONS: Record<string, AnimatedIconComponent> = {
  "/": HomeIcon,
  "/explore": MagnifierIcon,
  "/create": PenIcon,
  "/communities": UsersIcon,
  "/messages": MessageCircleIcon,
}

const HIDDEN_PREFIXES = [
  "/login",
  "/signup",
  "/onboarding",
  "/landing",
  "/reset-password",
  "/verify-email",
  "/terms",
  "/privacy",
  "/legal",
]

/**
 * Mobile tab bar.
 *
 * The same five core destinations are used on desktop and mobile. Create is
 * the central action; notifications stay in the global header, while specialist
 * tools remain available through the secondary navigation sheet.
 */
export function MobileBottomNav() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()
  const [menuOpen, setMenuOpen] = useState(false)
  const unreadMessages = useUnreadMessages()

  // Swipe in from the left edge to reveal the sidebar. Vertical swipes are
  // ignored so scrolling never fights the gesture.
  useEffect(() => {
    let startX = 0
    let startY = 0
    let tracking = false

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch || touch.clientX > 48) {
        tracking = false
        return
      }
      tracking = true
      startX = touch.clientX
      startY = touch.clientY
    }
    const onEnd = (event: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const touch = event.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = Math.abs(touch.clientY - startY)
      if (dx > 70 && dy < 60) setMenuOpen(true)
    }

    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchend", onEnd)
    }
  }, [])

  if (loading) return null
  if (HIDDEN_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return null
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

  type TabItem = {
    href: string
    icon: AnimatedIconComponent
    label: string
    auth?: boolean
    center?: boolean
    badge?: number
  }

  const items: TabItem[] = primarySidebarNav(EMPTY_AUDIENCE).map((item) => ({
    href: item.href,
    icon: MOBILE_NAV_ICONS[item.href] ?? HomeIcon,
    label: item.label,
    center: item.href === "/create",
    auth: item.href === "/messages",
    badge: item.href === "/messages" ? unreadMessages : undefined,
  }))

  return (
    <>
      {LoginGateDialog}
      <MobileSidebarSheet open={menuOpen} onOpenChange={setMenuOpen} />

      <nav
        className="loop-mobile-nav fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        {/* 64px bar: 24px icons, 12px labels, 44px tap targets. */}
        <div className="grid h-16 grid-cols-5 items-stretch px-1">
          {items.map((item) => {
            const active = isActive(item.href)
            const needsAuth = Boolean(item.auth)
            const badge = Number(item.badge || 0)

            if (item.center) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="group relative flex flex-col items-center justify-end gap-1 pb-1.5 text-micro font-semibold touch-manipulation"
                >
                  <span
                    className={cn(
                      "loop-tactile -mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform group-active:translate-y-1",
                      active && "scale-105",
                    )}
                  >
                    <AnimatedIconView component={item.icon} size={24} className="h-6 w-6" />
                  </span>
                  <span className={cn("max-w-full truncate", active ? "text-primary" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                </Link>
              )
            }

            return (
              <Link
                key={item.href}
                href={needsAuth && !user ? "#" : item.href}
                onClick={(event) => {
                  if (needsAuth && !requireAuth("message")) event.preventDefault()
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-[2.75rem] min-w-[2.75rem] flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-micro font-medium transition-colors touch-manipulation",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-2 inset-y-1 -z-10 rounded-xl transition-colors",
                    active ? "bg-primary/10" : "bg-transparent",
                  )}
                />
                <div className="relative">
                  <AnimatedIconView component={item.icon} size={24} className="h-6 w-6" />
                  {badge > 0 && (
                    <span className="absolute -right-3 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-micro font-bold leading-none text-white ring-2 ring-background">
                      {formatUnreadBadge(badge)}
                    </span>
                  )}
                </div>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
