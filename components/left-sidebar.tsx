"use client"

import { HomeIcon, SearchIcon as MagnifierIcon, PenToolIcon as PenIcon, UsersIcon as UsersGroupIcon, MessageCircleIcon, ChartLineIcon, SendIcon as SendHorizontalIcon, RadioIcon, CctvIcon as TvIcon, FlameIcon, ClockIcon, BookmarkIcon } from "@/components/icons"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AppLogo } from "@/components/brand/app-logo"
import { useAuth } from "@/hooks/use-auth"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LogOut } from "lucide-react"
import { AnimatedIconView, type AnimatedIconComponent } from "@/components/icons/animated-icon-view"

import { UserBadges } from "@/components/user-badge"
import {
  primarySidebarNav,
  secondarySidebarNav,
  type SidebarAudience,
} from "@/lib/sidebar-nav"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/** Icons live here rather than in the nav model so `lib/sidebar-nav` stays free
 *  of React. Every row gets its own icon: repeated icons made separate
 *  destinations look like duplicates. */
const NAV_ICONS: Record<string, AnimatedIconComponent> = {
  "/": HomeIcon,
  "/explore": MagnifierIcon,
  "/create": PenIcon,
  "/communities": UsersGroupIcon,
  "/messages": MessageCircleIcon,
  "/quests": ChartLineIcon,
  "/chains": SendHorizontalIcon,
  "/streams": RadioIcon,
  "/channels": TvIcon,
  "/drops": FlameIcon,
  "/events": ClockIcon,
  "/bookmarks": BookmarkIcon,
}

/** Guides the new-user tour to real elements. */
const NAV_TOUR_ANCHORS: Record<string, string> = {
  "/communities": "nav-circles",
  "/wallet": "wallet",
}

function navItemClasses(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground shadow-sm"
    : "text-muted-foreground hover:bg-muted hover:text-foreground"
}

export function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  const isAdmin = Boolean(user.staff_role || user.is_admin || user.is_moderator)

  const audience: SidebarAudience = {
    isPremium: Boolean(user.is_premium),
    isOrganization: Boolean(user.is_organization),
    isAdmin,
    isTeamMember: Boolean(user.is_team_member),
  }

  // One list: five core destinations, then the product surfaces. Account and
  // staff tools are in the profile menu, so nothing appears twice.
  const navItems = [...primarySidebarNav(audience), ...secondarySidebarNav(audience)]
  const primaryCount = primarySidebarNav(audience).length

  const isItemActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Logo Header */}
        <div className="flex shrink-0 items-center gap-2 px-2 py-2">
          <Link href="/" onClick={onLinkClick} className="flex items-center gap-2.5 group">
            <AppLogo showWordmark className="rounded-xl shadow-md transition-transform group-hover:scale-105" />
          </Link>
        </div>

        <ScrollArea className="flex-1 my-2 pr-2 scrollbar-thin">
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            Menu
          </p>
          <div className="space-y-0.5">
            {navItems.map((item, index) => {
              const Icon = NAV_ICONS[item.href]
              const isActive = isItemActive(item.href)
              return (
                <div key={item.href}>
                  {index === primaryCount ? (
                    <div className="mx-3 my-2 h-px bg-border/70" aria-hidden="true" />
                  ) : null}
                  <Link
                    href={item.href}
                    onClick={onLinkClick}
                    data-tour={NAV_TOUR_ANCHORS[item.href]}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${navItemClasses(isActive)}`}
                  >
                    <div className="flex items-center gap-3">
                      {Icon ? <AnimatedIconView component={Icon} size={16} className="h-4 w-4" /> : null}
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <Badge className="bg-rose-500 px-1.5 py-0 text-[9px] font-bold text-white">
                        {item.badge}
                      </Badge>
                    ) : null}
                  </Link>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Footer User Profile & Logout */}
      <div className="mt-2 flex shrink-0 items-center justify-between rounded-2xl border border-border/60 bg-muted/30 p-2">
        <Link href={`/profile/${user.username || user.id}`} onClick={onLinkClick} className="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80">
          <AvatarWithFrame
            avatarUrl={user.avatar_url || user.user_metadata?.avatar_url}
            videoAvatarUrl={(user as any).video_avatar_url || null}
            frameId={user.equipped_frame_id}
            size={36}
            alt={user.display_name || user.username}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-xs font-bold truncate">{user.display_name || user.username}</p>
              <UserBadges
                is_verified={user.is_verified}
                is_team_member={user.is_team_member}
                is_sponsor={user.is_sponsor}
                is_organization={user.is_organization}
                organization_badge_url={user.organization_badge_url}
                organization_name={user.organization_name}
                email={user.email}
                username={user.username}
                size="sm"
              />
            </div>
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
  const pathname = usePathname()
  if ([ "/legal/consent", "/terms", "/privacy" ].some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null
  if (!user) return null

  return (
    <aside data-tour="app-sidebar" className="sticky top-0 hidden h-dvh w-[264px] flex-col border-r border-border/60 bg-card/50 p-3.5 lg:flex">
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
