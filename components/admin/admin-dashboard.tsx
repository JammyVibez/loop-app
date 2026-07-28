"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Crown,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Sparkles,
  Users,
  Coins,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AdminUser {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  email?: string
  is_verified?: boolean
  is_premium?: boolean
  is_admin?: boolean
  premium_expires_at?: string | null
  loop_coins?: number
  created_at?: string
  last_active?: string
}

export function AdminDashboard() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState({ total_users: 0, verified: 0, premium: 0 })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("all")
  const [live, setLive] = useState(false)

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

      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={filter} onValueChange={setFilter} className="w-full lg:w-auto">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unverified">Unverified</TabsTrigger>
            <TabsTrigger value="verified">Verified</TabsTrigger>
            <TabsTrigger value="premium">Premium</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
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
                      {u.is_verified && <Badge className="bg-sky-500">Verified</Badge>}
                      {u.is_premium && <Badge className="bg-amber-500 text-slate-900">Premium</Badge>}
                      {u.is_admin && <Badge variant="secondary">Admin</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      @{u.username} · {Number(u.loop_coins || 0).toLocaleString()} coins
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === `${u.id}:verify` || busyId === `${u.id}:unverify`}
                    onClick={() => runAction(u.id, u.is_verified ? "unverify" : "verify")}
                  >
                    <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                    {u.is_verified ? "Unverify" : "Verify"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === `${u.id}:grant_premium` || busyId === `${u.id}:revoke_premium`}
                    onClick={() =>
                      runAction(u.id, u.is_premium ? "revoke_premium" : "grant_premium", { months: 1 })
                    }
                  >
                    <Crown className="mr-1.5 h-3.5 w-3.5" />
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
                    onClick={() => runAction(u.id, "add_coins", { amount: 500 })}
                  >
                    <Coins className="mr-1.5 h-3.5 w-3.5" /> +500
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 py-5 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 text-sky-500" />
          Changes sync live across open admin sessions. Recipients also get an in-app notification.
        </CardContent>
      </Card>
    </div>
  )
}
