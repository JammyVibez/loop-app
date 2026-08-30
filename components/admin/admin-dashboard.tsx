"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  BadgeCheck,
  Ban,
  BarChart3,
  Crown,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Zap,
  Users,
  Coins,
  Flag,
  Calendar,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminCatalogPanel } from "@/components/admin/admin-catalog-panel"
import { AdminBroadcastPanel } from "@/components/admin/admin-broadcast-panel"
import { AdminSupportPanel } from "@/components/admin/admin-support-panel"
import { AdminGifsPanel } from "@/components/admin/admin-gifs-panel"
import { AdminEmojisPanel } from "@/components/admin/admin-emojis-panel"
import { AdminFeaturedPanel } from "@/components/admin/admin-featured-panel"
import { ContentModerationControl } from "@/components/admin/content-moderation-control"
import { EconomyControl } from "@/components/admin/economy-control"
import { WithdrawalsControl } from "@/components/admin/withdrawals-control"
import { RefundsControl } from "@/components/admin/refunds-control"
import { SettingsTabContent } from "@/components/admin/settings-tab-content"
import { EventManagement } from "@/components/admin/event-management"
import { MaintenanceModeControl } from "@/components/admin/maintenance-mode-control"
import { ShopControl } from "@/components/admin/shop-control"
import { ProLoungeSettings } from "@/components/admin/pro-lounge-settings"
import { LogoControl } from "@/components/admin/logo-control"
import { CacheManagementPanel } from "@/components/admin/cache-management-panel"
import { OrgManagementPanel } from "@/components/admin/org-management-panel"
import { AdsAdminPanel } from "@/components/admin/ads-admin-panel"
import { AwardsAdminPanel } from "@/components/admin/awards-admin-panel"
import { ProCirclePanel } from "@/components/admin/pro-circle-panel"
import { VerificationBadgesAdminPanel } from "@/components/admin/verification-badges-admin-panel"
import { SystemHealthPanel } from "@/components/admin/system-health-panel"
import { BanAppealsPanel } from "@/components/admin/ban-appeals-panel"
import { AdminAccountManagement } from "@/components/admin/admin-account-management"
import { AdminTeamPermissions } from "@/components/admin/admin-team-permissions"
import { CoLoopSessionsPanel } from "@/components/admin/co-loop-sessions-panel"
import { AdminAnalyticsTab } from "@/components/admin/admin-analytics-tab"
import { ThemePresetManager } from "@/components/admin/theme-preset-manager"
import { AdminFramesTab } from "@/components/admin/admin-frames-tab"
import { AdminRevenueTab } from "@/components/admin/admin-revenue-tab"
import { AuditLogPanel } from "@/components/admin/audit-log-panel"
import { AdminCommandPalette } from "@/components/admin/admin-command-palette"
import { UserBadges } from "@/components/user-badge"

interface AdminUser {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  email?: string
  is_verified?: boolean
  is_team_member?: boolean
  is_sponsor?: boolean
  is_premium?: boolean
  is_admin?: boolean
  is_banned?: boolean
  ban_reason?: string | null
  premium_expires_at?: string | null
  loop_coins?: number
  created_at?: string
  last_active?: string
}

export function AdminDashboard() {
  const searchParams = useSearchParams()
  const initialTab = searchParams?.get("tab") || "users"
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState({ total_users: 0, verified: 0, premium: 0, banned: 0 })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("all")
  const [live, setLive] = useState(false)
  const [section, setSection] = useState(initialTab)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const loadUsers = useCallback(async () => {
    if (!user?.is_admin) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ filter, limit: "60" })
      if (q.trim()) params.set("q", q.trim())
      const response = await fetch(`/api/admin/users/manage?${params}`, {
        headers: getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load users")
      setUsers(data.users || [])
      setStats(data.stats || { total_users: 0, verified: 0, premium: 0 })
    } catch (error: any) {
      toast({ title: "Admin load failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user?.is_admin, filter, q, getAuthHeader, toast])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (!user?.is_admin) return
    const channel = supabase.channel("admin:users", {
      config: { broadcast: { self: false } },
    })
    channel
      .on("broadcast", { event: "user_updated" }, ({ payload }) => {
        if (!payload?.user) return
        setUsers((prev) => {
          const exists = prev.some((u) => u.id === payload.user.id)
          if (!exists) return [payload.user, ...prev]
          return prev.map((u) => (u.id === payload.user.id ? { ...u, ...payload.user } : u))
        })
        setLive(true)
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLive(true)
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.is_admin])

  const runAction = async (userId: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusyId(`${userId}:${action}`)
    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: userId, action, ...extra }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Action failed")
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data.user } : u)))
      toast({ title: "Updated", description: `${action.replace(/_/g, " ")} applied.` })
      await loadUsers()
    } catch (error: any) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const filteredLabel = useMemo(() => {
    if (filter === "verified") return "Verified users"
    if (filter === "premium") return "Premium users"
    if (filter === "admin") return "Admins"
    if (filter === "unverified") return "Unverified users"
    if (filter === "banned") return "Banned users"
    return "All users"
  }, [filter])

  if (!user?.is_admin) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          App admin access required.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">App Admin</h1>
          <p className="text-sm text-muted-foreground">
            Grant verification, premium, roles, and coins in realtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={live ? "default" : "outline"} className="rounded-full">
            {live ? "Live" : "Connecting…"}
          </Badge>
          <Button variant="outline" size="sm" className="rounded-full" onClick={loadUsers}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <Tabs value={section} onValueChange={setSection}>
        {/* Command Palette Trigger */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors w-full sm:w-auto"
          >
            <Search className="h-4 w-4" />
            <span>Quick actions...</span>
            <kbd className="ml-auto hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>

        {/* Grouped Tab Navigation */}
        <div className="space-y-2">
          {/* Primary Tabs */}
          <TabsList className="flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="analytics" className="text-xs">
              <BarChart3 className="mr-1 h-3 w-3" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs">
              <Coins className="mr-1 h-3 w-3" /> Revenue
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              <Users className="mr-1 h-3 w-3" /> Users
            </TabsTrigger>
            <TabsTrigger value="moderation" className="text-xs">
              <Shield className="mr-1 h-3 w-3" /> Moderation
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">
              <Clock className="mr-1 h-3 w-3" /> Audit Log
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs">
              <Zap className="mr-1 h-3 w-3" /> Health
            </TabsTrigger>
          </TabsList>

          {/* Secondary Tabs (collapsed by default on mobile) */}
          <TabsList className="flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="economy" className="text-xs">Economy</TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs">Payouts</TabsTrigger>
            <TabsTrigger value="catalog" className="text-xs">Themes</TabsTrigger>
            <TabsTrigger value="featured" className="text-xs">Featured</TabsTrigger>
            <TabsTrigger value="events" className="text-xs">Events</TabsTrigger>
            <TabsTrigger value="broadcast" className="text-xs">Broadcast</TabsTrigger>
            <TabsTrigger value="ads" className="text-xs">Ads</TabsTrigger>
            <TabsTrigger value="support" className="text-xs">Support</TabsTrigger>
            <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
            <TabsTrigger value="organizations" className="text-xs">Orgs</TabsTrigger>
          </TabsList>

          {/* Tertiary Tabs */}
          <TabsList className="flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="gifs" className="text-xs">GIFs</TabsTrigger>
            <TabsTrigger value="emojis" className="text-xs">Emojis</TabsTrigger>
            <TabsTrigger value="awards" className="text-xs">Awards</TabsTrigger>
            <TabsTrigger value="checkmarks" className="text-xs">Checkmarks</TabsTrigger>
            <TabsTrigger value="procircle" className="text-xs">Pro Circle</TabsTrigger>
            <TabsTrigger value="appeals" className="text-xs">Ban Appeals</TabsTrigger>
            <TabsTrigger value="coloops" className="text-xs">Co-Loops</TabsTrigger>
            <TabsTrigger value="circle-themes" className="text-xs">Circle Themes</TabsTrigger>
            <TabsTrigger value="pfp-frames" className="text-xs">PFP Frames</TabsTrigger>
            <TabsTrigger value="maintenance" className="text-xs">Maintenance</TabsTrigger>
          </TabsList>
        </div>

        
        <TabsContent value="revenue" className="mt-6">
          <AdminRevenueTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogPanel />
        </TabsContent>

<TabsContent value="analytics" className="mt-6">
          <AdminAnalyticsTab />
        </TabsContent>

        <TabsContent value="users" className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" /> Total users
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{stats.total_users}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <BadgeCheck className="h-4 w-4" /> Verified
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{stats.verified}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Crown className="h-4 w-4" /> Premium
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{stats.premium}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Ban className="h-4 w-4" /> Banned
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{stats.banned || 0}</CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Tabs value={filter} onValueChange={setFilter} className="w-full lg:w-auto">
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-6">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unverified">Unverified</TabsTrigger>
                <TabsTrigger value="verified">Verified</TabsTrigger>
                <TabsTrigger value="premium">Premium</TabsTrigger>
                <TabsTrigger value="admin">Admins</TabsTrigger>
                <TabsTrigger value="banned">Banned</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search username, name, email…"
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && loadUsers()}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{filteredLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading users…
                </div>
              ) : users.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No users found.</p>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback>{(u.display_name || u.username || "U").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-semibold">{u.display_name || u.username}</p>
                          <UserBadges
                            is_verified={u.is_verified}
                            is_team_member={u.is_team_member}
                            is_sponsor={u.is_sponsor}
                            username={u.username}
                            size="sm"
                          />
                          {u.is_premium && <Badge className="bg-amber-500 text-slate-900">Premium</Badge>}
                          {u.is_admin && <Badge variant="secondary">Admin</Badge>}
                          {u.is_banned && <Badge variant="destructive">Banned</Badge>}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          @{u.username} · {Number(u.loop_coins || 0).toLocaleString()} coins
                          {u.ban_reason ? ` · ${u.ban_reason}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        disabled={busyId === `${u.id}:verify` || busyId === `${u.id}:unverify`}
                        onClick={() => runAction(u.id, u.is_verified ? "unverify" : "verify")}
                        title="Toggle Creator Checkmark"
                      >
                        <BadgeCheck className="mr-1 h-3.5 w-3.5 text-sky-500" />
                        {u.is_verified ? "Rem Creator" : "Add Creator"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        disabled={busyId === `${u.id}:grant_team_badge` || busyId === `${u.id}:revoke_team_badge`}
                        onClick={() => runAction(u.id, u.is_team_member ? "revoke_team_badge" : "grant_team_badge")}
                        title="Toggle Team Badge"
                      >
                        <Shield className="mr-1 h-3.5 w-3.5 text-violet-500" />
                        {u.is_team_member ? "Rem Team" : "Add Team"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        disabled={busyId === `${u.id}:grant_sponsor_badge` || busyId === `${u.id}:revoke_sponsor_badge`}
                        onClick={() => runAction(u.id, u.is_sponsor ? "revoke_sponsor_badge" : "grant_sponsor_badge")}
                        title="Toggle Sponsor Gold Badge"
                      >
                        <Zap className="mr-1 h-3.5 w-3.5 text-amber-500" />
                        {u.is_sponsor ? "Rem Sponsor" : "Add Sponsor"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        disabled={busyId === `${u.id}:grant_premium` || busyId === `${u.id}:revoke_premium`}
                        onClick={() =>
                          runAction(u.id, u.is_premium ? "revoke_premium" : "grant_premium", { months: 1 })
                        }
                      >
                        <Crown className="mr-1 h-3.5 w-3.5 text-amber-500" />
                        {u.is_premium ? "Revoke Pro" : "Grant Pro"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={busyId === `${u.id}:make_admin` || busyId === `${u.id}:remove_admin`}
                        onClick={() => runAction(u.id, u.is_admin ? "remove_admin" : "make_admin")}
                      >
                        {u.is_admin ? (
                          <>
                            <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Remove admin
                          </>
                        ) : (
                          <>
                            <Shield className="mr-1.5 h-3.5 w-3.5" /> Make admin
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={busyId === `${u.id}:add_coins`}
                        onClick={() => runAction(u.id, "add_coins", { amount: 50 })}
                      >
                        <Coins className="mr-1.5 h-3.5 w-3.5" /> +50
                      </Button>
                      <Button
                        size="sm"
                        variant={u.is_banned ? "outline" : "destructive"}
                        className="rounded-full"
                        disabled={busyId === `${u.id}:ban` || busyId === `${u.id}:unban`}
                        onClick={() =>
                          runAction(u.id, u.is_banned ? "unban" : "ban", {
                            reason: "Violated community guidelines",
                          })
                        }
                      >
                        <Ban className="mr-1.5 h-3.5 w-3.5" />
                        {u.is_banned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="flex items-start gap-3 py-5 text-sm text-muted-foreground">
              <Zap className="mt-0.5 h-4 w-4 text-sky-500" />
              Changes sync live across open admin sessions. Recipients also get an in-app notification.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6 space-y-6">
          <ShopControl />
          <MaintenanceModeControl />
          <LogoControl />
          <CacheManagementPanel />
          <ProLoungeSettings />
          <AdminAccountManagement />
        </TabsContent>

        <TabsContent value="organizations" className="mt-6">
          <OrgManagementPanel />
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <EventManagement />
        </TabsContent>

        <TabsContent value="economy" className="mt-6 space-y-6">
          <EconomyControl />
          <SettingsTabContent />
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <WithdrawalsControl />
          <RefundsControl />
        </TabsContent>

        <TabsContent value="catalog" className="mt-6">
          <AdminCatalogPanel />
        </TabsContent>

        <TabsContent value="featured" className="mt-6">
          <AdminFeaturedPanel />
        </TabsContent>

        <TabsContent value="moderation" className="mt-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Flag className="h-4 w-4" /> Review reported content and take action.
          </div>
          <ContentModerationControl />
        </TabsContent>

        <TabsContent value="support" className="mt-6">
          <AdminSupportPanel />
        </TabsContent>

        <TabsContent value="gifs" className="mt-6">
          <AdminGifsPanel />
        </TabsContent>
        <TabsContent value="emojis" className="mt-6">
          <AdminEmojisPanel />
        </TabsContent>

        <TabsContent value="broadcast" className="mt-6">
          <AdminBroadcastPanel />
        </TabsContent>

        <TabsContent value="ads" className="mt-6">
          <AdsAdminPanel />
        </TabsContent>
        <TabsContent value="awards" className="mt-6">
          <AwardsAdminPanel />
        </TabsContent>
        <TabsContent value="procircle" className="mt-6">
          <ProCirclePanel />
        </TabsContent>
        <TabsContent value="checkmarks" className="mt-6">
          <VerificationBadgesAdminPanel />
        </TabsContent>
        <TabsContent value="health" className="mt-6">
          <SystemHealthPanel />
        </TabsContent>
        <TabsContent value="appeals" className="mt-6">
          <BanAppealsPanel />
        </TabsContent>
        <TabsContent value="coloops" className="mt-6">
          <CoLoopSessionsPanel />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <AdminTeamPermissions />
        </TabsContent>
        <TabsContent value="circle-themes" className="mt-6">
          <ThemePresetManager />
        </TabsContent>
        <TabsContent value="pfp-frames" className="mt-6">
          <AdminFramesTab />
        </TabsContent>
      </Tabs>

      <AdminCommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  )
}
