"use client"

import { useMemo, useState } from "react"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  BadgeCheck,
  Check,
  Coins,
  Crown,
  Loader2,
  MoreHorizontal,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  Zap,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/skeletons"
import { UserBadges } from "@/components/user-badge"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */

export interface AdminUser {
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

interface UsersStats {
  total_users: number
  verified: number
  premium: number
  banned: number
  new_this_week?: number
}

type SortKey = "username" | "created_at" | "status" | "loop_coins" | "role"

interface AdminUsersTableProps {
  users: AdminUser[]
  stats: UsersStats
  loading: boolean
  busyId: string | null
  filter: string
  onFilterChange: (f: string) => void
  q: string
  onQueryChange: (q: string) => void
  onSearch: () => void
  onAction: (userId: string, action: string, extra?: Record<string, unknown>) => void
  onRefresh: () => void
  /** Signed-in admin, so their own row never offers deletion. */
  currentUserId?: string
}

/* ------------------------------------------------------------------ */

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unverified", label: "Unverified" },
  { value: "verified", label: "Verified" },
  { value: "premium", label: "Premium" },
  { value: "admin", label: "Admins" },
  { value: "banned", label: "Banned" },
]

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  iconClass,
}: {
  icon: React.ElementType
  label: string
  value: number
  trend?: number | null
  iconClass?: string
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted", iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold tabular-nums tracking-tight">{value.toLocaleString()}</p>
            {trend != null && trend > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
                <TrendingUp className="h-3 w-3" /> +{trend} this week
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; dir: "asc" | "desc" }
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort.key === sortKey
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

function statusRank(u: AdminUser) {
  if (u.is_banned) return 0
  if (u.is_admin) return 3
  if (u.is_premium) return 2
  if (u.is_verified) return 1
  return 1.5
}

/* ------------------------------------------------------------------ */

export function AdminUsersTable({
  users,
  stats,
  loading,
  busyId,
  filter,
  onFilterChange,
  q,
  onQueryChange,
  onSearch,
  onAction,
  onRefresh,
  currentUserId,
}: AdminUsersTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created_at", dir: "desc" })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const sorted = useMemo(() => {
    const arr = [...users]
    const dir = sort.dir === "asc" ? 1 : -1
    arr.sort((a, b) => {
      switch (sort.key) {
        case "username":
          return (a.username || "").localeCompare(b.username || "") * dir
        case "created_at":
          return ((a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0)) * dir
        case "loop_coins":
          return (Number(a.loop_coins || 0) - Number(b.loop_coins || 0)) * dir
        case "role": {
          const rank = (u: AdminUser) => (u.is_admin ? 2 : u.is_team_member ? 1 : 0)
          return (rank(a) - rank(b)) * dir
        }
        case "status":
          return (statusRank(a) - statusRank(b)) * dir
        default:
          return 0
      }
    })
    return arr
  }, [users, sort])

  const handleSort = (key: SortKey) =>
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))

  const allVisibleSelected = sorted.length > 0 && sorted.every((u) => selected.has(u.id))
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) sorted.forEach((u) => next.delete(u.id))
      else sorted.forEach((u) => next.add(u.id))
      return next
    })

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const runBulk = async (action: string, extra: Record<string, unknown> = {}) => {
    if (selected.size === 0) return
    setBulkBusy(true)
    try {
      await onBulkAction([...selected], action, extra)
      setSelected(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  // Bulk handler is injected via prop `onBulk` provided by the dashboard —
  // fall back to sequential single actions if not provided.
  async function onBulkAction(ids: string[], action: string, extra: Record<string, unknown>) {
    for (const id of ids) {
      await onAction(id, action, extra)
    }
  }

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={stats.total_users} trend={stats.new_this_week ?? null} iconClass="text-sky-500 bg-sky-500/10" />
        <StatCard icon={BadgeCheck} label="Verified" value={stats.verified} iconClass="text-sky-500 bg-sky-500/10" />
        <StatCard icon={Crown} label="Premium" value={stats.premium} iconClass="text-amber-500 bg-amber-500/10" />
        <StatCard icon={UserX} label="Banned" value={stats.banned} iconClass="text-red-500 bg-red-500/10" />
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={filter} onValueChange={onFilterChange} className="w-full lg:w-auto">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-6 lg:w-auto lg:rounded-full">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="rounded-full text-xs">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search username, name, email…"
            className="rounded-full pl-9"
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2.5 shadow-md backdrop-blur">
          <span className="ml-1 text-sm font-medium">
            {selected.size} selected
          </span>
          <Button size="sm" variant="outline" className="rounded-full" disabled={bulkBusy} onClick={() => runBulk("add_coins", { amount: 50 })}>
            <Coins className="mr-1 h-3.5 w-3.5" /> +50 coins
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={bulkBusy} onClick={() => runBulk("grant_premium", { months: 1 })}>
            <Crown className="mr-1 h-3.5 w-3.5 text-amber-500" /> Grant Pro
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={bulkBusy} onClick={() => runBulk("verify")}>
            <BadgeCheck className="mr-1 h-3.5 w-3.5 text-sky-500" /> Verify
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={bulkBusy} onClick={() => runBulk("unban")}>
            <UserCheck className="mr-1 h-3.5 w-3.5" /> Unban
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="rounded-full"
            disabled={bulkBusy}
            onClick={() => {
              void (async () => {
                const ok = await confirmDialog({
                  title: `Ban ${selected.size} ${selected.size === 1 ? "user" : "users"}?`,
                  description:
                    "They lose access immediately and are told the reason is a community-guidelines violation.",
                  confirmLabel: "Ban",
                  destructive: true,
                })
                if (ok) runBulk("ban", { reason: "Violated community guidelines" })
              })()
            }}
          >
            <Ban className="mr-1 h-3.5 w-3.5" /> Ban
          </Button>
          {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button size="sm" variant="ghost" className="ml-auto rounded-full" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Spinner className="h-5 w-5" /> Loading users…
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <SortHeader label="User" sortKey="username" sort={sort} onSort={handleSort} />
                  <SortHeader label="Joined" sortKey="created_at" sort={sort} onSort={handleSort} className="hidden md:table-cell" />
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                  <SortHeader label="Coins" sortKey="loop_coins" sort={sort} onSort={handleSort} className="hidden sm:table-cell" />
                  <SortHeader label="Role" sortKey="role" sort={sort} onSort={handleSort} className="hidden lg:table-cell" />
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((u) => (
                  <TableRow key={u.id} data-selected={selected.has(u.id)} className={cn(selected.has(u.id) && "bg-muted/40")}>
                    <TableCell>
                      <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggleOne(u.id)} aria-label={`Select ${u.username}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.avatar_url} />
                          <AvatarFallback>{(u.display_name || u.username || "U").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="max-w-[160px] truncate font-medium">{u.display_name || u.username}</p>
                            <UserBadges
                              is_verified={u.is_verified}
                              is_team_member={u.is_team_member}
                              is_sponsor={u.is_sponsor}
                              username={u.username}
                              size="sm"
                            />
                          </div>
                          <p className="max-w-[200px] truncate text-xs text-muted-foreground">@{u.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell>
                      {u.is_banned ? (
                        <Badge variant="destructive" className="rounded-full text-[10px]">Banned</Badge>
                      ) : u.is_premium ? (
                        <Badge className="rounded-full bg-amber-500 text-slate-900 text-[10px]">Premium</Badge>
                      ) : u.is_verified ? (
                        <Badge variant="outline" className="rounded-full border-sky-500/40 text-sky-500 text-[10px]">Verified</Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">Standard</Badge>
                      )}
                      {u.is_banned && u.ban_reason && (
                        <p className="mt-0.5 max-w-[160px] truncate text-[11px] text-muted-foreground">{u.ban_reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-medium tabular-nums sm:table-cell">
                      {Number(u.loop_coins || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {u.is_admin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-500">
                          <Shield className="h-3.5 w-3.5" /> Admin
                        </span>
                      ) : u.is_team_member ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500">
                          <Zap className="h-3.5 w-3.5" /> Team
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Member</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === `${u.id}:menu`}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions for {u.username}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onAction(u.id, u.is_verified ? "unverify" : "verify")}>
                            <BadgeCheck className="mr-2 h-4 w-4 text-sky-500" />
                            {u.is_verified ? "Remove Creator" : "Add Creator"}
                            {u.is_verified && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAction(u.id, u.is_team_member ? "revoke_team_badge" : "grant_team_badge")}>
                            <Zap className="mr-2 h-4 w-4 text-violet-500" />
                            {u.is_team_member ? "Remove Team" : "Add Team"}
                            {u.is_team_member && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAction(u.id, u.is_sponsor ? "revoke_sponsor_badge" : "grant_sponsor_badge")}>
                            <Crown className="mr-2 h-4 w-4 text-amber-500" />
                            {u.is_sponsor ? "Remove Sponsor" : "Add Sponsor"}
                            {u.is_sponsor && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onAction(u.id, u.is_premium ? "revoke_premium" : "grant_premium", { months: 1 })}>
                            <Crown className="mr-2 h-4 w-4 text-amber-500" />
                            {u.is_premium ? "Revoke Pro" : "Grant Pro (1 mo)"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAction(u.id, u.is_admin ? "remove_admin" : "make_admin")}>
                            {u.is_admin ? (
                              <>
                                <ShieldOff className="mr-2 h-4 w-4 text-red-500" /> Remove admin
                              </>
                            ) : (
                              <>
                                <Shield className="mr-2 h-4 w-4 text-violet-500" /> Make admin
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAction(u.id, "add_coins", { amount: 50 })}>
                            <Coins className="mr-2 h-4 w-4 text-amber-500" /> +50 coins
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.is_banned ? (
                            <DropdownMenuItem onClick={() => onAction(u.id, "unban")}>
                              <UserCheck className="mr-2 h-4 w-4 text-emerald-500" /> Unban user
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => onAction(u.id, "ban", { reason: "Violated community guidelines" })}
                            >
                              <Ban className="mr-2 h-4 w-4" /> Ban user
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            disabled={u.is_admin || u.id === currentUserId}
                            onClick={() => {
                              void (async () => {
                                const ok = await confirmDialog({
                                  title: `Delete @${u.username}?`,
                                  description:
                                    "Their login is revoked and the account disappears from this list. Existing posts stay, attributed to a deleted account.",
                                  confirmLabel: "Delete account",
                                  destructive: true,
                                })
                                if (ok) onAction(u.id, "delete")
                              })()
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
