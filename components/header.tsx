"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppLogo } from "@/components/brand/app-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Settings,
  User,
  LogOut,
  Coins,
  X,
  Sun,
  Moon,
  Circle,
  Flower2,
  TreePine,
  Palette,
  Bookmark,
  Wallet,
  Code,
  UserPlus,
  Lock,
  Building2,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useTheme } from "next-themes"
import { AnimatedIconView } from "@/components/icons/animated/animated-icon-view"
import MagnifierIcon from "@/components/icons/animated/magnifier-icon"
import { useAuth } from "@/hooks/use-auth"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"
import { NotificationCenterSheet } from "@/components/notifications/notification-center-sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserBadges } from "@/components/user-badge"
import { AccountSwitcher } from "@/components/accounts/account-switcher"

function LogoMark() {
  return (
    <AppLogo className="rounded-2xl shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-105" />
  )
}

/**
 * Bar density: the header carries only the brand, search, the coins balance and
 * notifications. Everything used less often (theme, chat) lives in the profile
 * menu below instead of occupying permanent space in the bar.
 */
const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "midnight", label: "Midnight", icon: Circle },
  { value: "sakura", label: "Sakura", icon: Flower2 },
  { value: "forest", label: "Forest", icon: TreePine },
] as const

export function Header() {
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
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
      // Client-side navigation: a full reload here threw away every cached
      // client state for no reason and made signing out feel like a crash.
      router.push("/landing")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  if (!user) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <LogoMark />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight text-foreground">loopapp.me</span>
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

  const isAdmin = Boolean(user.staff_role || user.is_admin || user.is_moderator)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-3 sm:px-4">
        {/* Brand & Expandable Search Input */}
        <div className="flex items-center gap-2 min-w-0">          {/* The desktop rail already carries the brand, so the bar starts at
              search there instead of repeating the logo twice per screen. */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5 lg:hidden">
            <LogoMark />
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-base font-bold tracking-tight text-foreground">loopapp.me</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Social OS</span>
            </div>
          </Link>

          {/* Desktop & Mobile Responsive Search */}
          {mobileSearchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center gap-1 w-full max-w-xs animate-in fade-in duration-150">
              <div className="relative flex-1">
                <AnimatedIconView component={MagnifierIcon} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  autoFocus
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 rounded-full border-border bg-muted/40 pl-9 pr-3 text-sm"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setMobileSearchOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSearch} className="relative hidden w-56 md:flex lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search Loops, people, Circles"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-full border-border bg-muted/40 pl-9 pr-3 text-sm placeholder:text-muted-foreground transition-colors focus-visible:border-primary/40 focus-visible:bg-background"
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
              className="h-10 w-10 rounded-full md:hidden"
              onClick={() => setMobileSearchOpen(true)}
              title="Search"
            >
              <AnimatedIconView component={MagnifierIcon} size={22} />
            </Button>
          )}

          {/* Loop Coins — the balance is also the single wallet entry on every
              device, so Wallet is not repeated in any navigation list. */}
          <Link
            href="/wallet"
            data-tour="wallet"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 text-xs font-semibold tabular-nums text-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
            title="Loop Coins — open wallet"
            aria-label={`${Number(user.loop_coins || 0).toLocaleString()} Loop Coins — open wallet`}
          >
            <Coins className="h-4 w-4 text-[hsl(var(--warning))]" />
            {Number(user.loop_coins || 0).toLocaleString()}
          </Link>

          {/* Notifications — a compact dropdown on desktop, a full-height
              slide-over center on phones and tablets (the tab bar has no bell). */}
          <span data-tour="notifications" className="inline-flex">
            <span className="hidden lg:inline-flex">
              <NotificationDropdown />
            </span>
            <NotificationCenterSheet className="lg:hidden" />
          </span>

          {/* Consolidated User Profile Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-tour="nav-profile"
                className="relative flex h-10 w-10 shrink-0 flex-none touch-manipulation items-center justify-center rounded-full border border-border/70 bg-muted/50 p-0 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <AvatarWithFrame
                  avatarUrl={user.avatar_url}
                  videoAvatarUrl={(user as any).video_avatar_url || null}
                  frameId={user.equipped_frame_id}
                  size={36}
                  alt={user.display_name}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" sideOffset={8} collisionPadding={12} className="w-56 rounded-2xl p-1.5">
              <DropdownMenuLabel className="font-normal p-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold leading-none truncate">{user.display_name || user.username}</p>
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
                  <p className="text-[11px] text-muted-foreground leading-none">@{user.username}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Desktop reaches the profile from the rail's account chip, so
                  this row is the phone-only path to the same destination. */}
              <div className="lg:hidden">
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                  <Link href={`/profile/${user.username || user.id}`} className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Your profile</span>
                  </Link>
                </DropdownMenuItem>
              </div>

              {/* Theme submenu replaces the bar's theme button. */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-xl">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <span className="ml-2 text-xs font-medium">Theme</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40 rounded-xl p-1">
                  <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                    {THEME_OPTIONS.map((option) => {
                      const Icon = option.icon
                      return (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          className="gap-2 rounded-xl text-xs font-medium"
                        >
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </DropdownMenuRadioItem>
                      )
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Settings</span>
                </Link>
              </DropdownMenuItem>

              {/* Account, workspace and staff tools live here instead of
                  repeating a second navigation list in the sidebar rail. */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Tools
              </DropdownMenuLabel>
              <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                <Link href="/collections" className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Collections</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                <Link href="/earnings" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Creator Studio</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                <Link href="/developers" className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Developer Hub</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                <Link href="/invite" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Invite friends</span>
                </Link>
              </DropdownMenuItem>

              {user.is_premium ? (
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                  <Link href="/lounge" className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Pro Lounge</span>
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {user.is_organization ? (
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                  <Link href="/organization" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Organization</span>
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {isAdmin ? (
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                  <Link href="/loopadmin" className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-medium">Admin Dashboard</span>
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {isAdmin || user.is_team_member ? (
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                  <Link href="/team" className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium">Team Dashboard</span>
                  </Link>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />

              {/* Account Switcher */}
              <div className="px-1">
                <AccountSwitcher variant="dropdown" />
              </div>

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
