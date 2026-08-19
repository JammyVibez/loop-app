"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  MessageSquare,
  Heart,
  GitBranch,
  Coins,
  ShoppingBag,
  Gift,
  Zap,
  Activity,
  BarChart3,
  Crown,
  Shield,
  Calendar,
  Clock,
  Eye,
  Radio,
  RefreshCw,
  Loader2,
  ArrowUp,
  ArrowDown,
  Globe,
  Layers,
  Swords,
  Vote,
  Timer,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface AnalyticsStats {
  total_users: number
  active_users_7d: number
  active_users_30d: number
  inactive_users_30d: number
  premium_users: number
  verified_users: number
  admin_users: number
  banned_users: number
  recent_signups_7d: number
  recent_signups_30d: number
  total_loops: number
  loops_this_week: number
  total_comments: number
  comments_this_week: number
  total_likes: number
  total_circles: number
  total_circle_members: number
  active_co_loops: number
  published_co_loops: number
  total_duels: number
  active_duels: number
  total_polls: number
  total_moments: number
  active_moments: number
  total_gifts: number
  gifts_today: number
  total_messages: number
  messages_this_week: number
  total_follows: number
  weekly_bonus_claimed: number
  total_coins_distributed: number
  total_shop_purchases: number
  revenue_this_month: number
  total_notifications: number
  livestreams_active: number
  early_users: Array<{
    id: string
    username: string
    display_name?: string
    avatar_url?: string
    created_at?: string
    is_premium?: boolean
    is_verified?: boolean
  }>
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  trend,
}: {
  title: string
  value: string | number
  icon: any
  color: string
  subtitle?: string
  trend?: "up" | "down" | "neutral"
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminAnalyticsTab() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [stats, setStats] = useState<AnalyticsStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/stats", {
        headers: getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load analytics")
      setStats(data.stats)
    } catch (error: any) {
      toast({ title: "Failed to load analytics", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, toast])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading analytics…
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Failed to load analytics. <Button variant="link" onClick={loadStats}>Retry</Button>
      </div>
    )
  }

  const engagementRate = stats.total_users > 0
    ? ((stats.active_users_7d / stats.total_users) * 100).toFixed(1)
    : "0"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">App Analytics</h2>
          <p className="text-sm text-muted-foreground">Full platform overview and real-time metrics.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={loadStats}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Overview Stats */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Overview</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Users" value={stats.total_users} icon={Users} color="bg-indigo-500" />
          <StatCard title="Active (7d)" value={stats.active_users_7d} icon={Activity} color="bg-emerald-500" subtitle={`${engagementRate}% engagement`} />
          <StatCard title="Inactive (30d+)" value={stats.inactive_users_30d} icon={UserX} color="bg-rose-500" subtitle="No activity in 30+ days" />
          <StatCard title="Banned" value={stats.banned_users} icon={Shield} color="bg-slate-500" />
        </div>
      </div>

      {/* User Breakdown */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">User Breakdown</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Pro Users" value={stats.premium_users} icon={Crown} color="bg-amber-500" />
          <StatCard title="Verified Creators" value={stats.verified_users} icon={UserCheck} color="bg-sky-500" />
          <StatCard title="Admins" value={stats.admin_users} icon={Shield} color="bg-violet-500" />
          <StatCard title="New Signups (7d)" value={stats.recent_signups_7d} icon={TrendingUp} color="bg-teal-500" subtitle={`${stats.recent_signups_30d} this month`} />
        </div>
      </div>

      {/* Content & Engagement */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Content & Engagement</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Loops" value={stats.total_loops} icon={GitBranch} color="bg-indigo-500" subtitle={`${stats.loops_this_week} this week`} />
          <StatCard title="Total Comments" value={stats.total_comments} icon={MessageSquare} color="bg-cyan-500" subtitle={`${stats.comments_this_week} this week`} />
          <StatCard title="Total Likes" value={stats.total_likes} icon={Heart} color="bg-rose-500" />
          <StatCard title="Total Follows" value={stats.total_follows} icon={Users} color="bg-purple-500" />
        </div>
      </div>

      {/* Communities */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Circles & Communities</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Circles" value={stats.total_circles} icon={Globe} color="bg-violet-500" />
          <StatCard title="Circle Memberships" value={stats.total_circle_members} icon={Layers} color="bg-indigo-400" />
          <StatCard title="Active Co-Loops" value={stats.active_co_loops} icon={Zap} color="bg-emerald-500" subtitle={`${stats.published_co_loops} published`} />
          <StatCard title="Active Livestreams" value={stats.livestreams_active} icon={Radio} color="bg-red-500" />
        </div>
      </div>

      {/* Battles & Polls */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Duels, Polls & Moments</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Duels" value={stats.total_duels} icon={Swords} color="bg-orange-500" subtitle={`${stats.active_duels} active`} />
          <StatCard title="Total Polls" value={stats.total_polls} icon={Vote} color="bg-sky-500" />
          <StatCard title="Total Moments" value={stats.total_moments} icon={Timer} color="bg-pink-500" subtitle={`${stats.active_moments} active`} />
          <StatCard title="Notifications" value={stats.total_notifications} icon={Zap} color="bg-amber-400" />
        </div>
      </div>

      {/* Economy */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Economy & Coins</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Coins Distributed" value={stats.total_coins_distributed} icon={Coins} color="bg-yellow-500" subtitle="Total coins minted" />
          <StatCard title="Shop Purchases" value={stats.total_shop_purchases} icon={ShoppingBag} color="bg-teal-500" />
          <StatCard title="Revenue (Month)" value={`$${stats.revenue_this_month.toLocaleString()}`} icon={BarChart3} color="bg-emerald-600" />
          <StatCard title="Gifts Sent" value={stats.total_gifts} icon={Gift} color="bg-pink-500" subtitle={`${stats.gifts_today} today`} />
        </div>
      </div>

      {/* Messaging */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Messaging</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Messages" value={stats.total_messages} icon={MessageSquare} color="bg-blue-500" subtitle={`${stats.messages_this_week} this week`} />
          <StatCard title="Weekly Bonus Claims" value={stats.weekly_bonus_claimed} icon={Coins} color="bg-green-500" />
        </div>
      </div>

      {/* Early Users Table */}
      {stats.early_users && stats.early_users.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
            Early Users (First {stats.early_users.length})
          </h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Username</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.early_users.map((u, idx) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={u.avatar_url} />
                              <AvatarFallback className="text-xs">{(u.display_name || u.username || "U").charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{u.display_name || u.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">@{u.username}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            {u.is_verified && <Badge className="bg-sky-500 text-[10px]">Creator</Badge>}
                            {u.is_premium && <Badge className="bg-amber-500 text-[10px] text-slate-900">Pro</Badge>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
