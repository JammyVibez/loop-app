"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Ban,
  CircleSlash,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/skeletons"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface AdminCircle {
  id: number | string
  name: string
  handle?: string | null
  description?: string | null
  category?: string | null
  avatar_url?: string | null
  is_private?: boolean | null
  is_active?: boolean | null
  is_verified?: boolean | null
  created_at?: string | null
  member_count?: number | Array<{ count: number }> | null
  owner?: {
    id?: string
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "banned", label: "Paused" },
  { id: "private", label: "Private" },
] as const

type FilterId = (typeof FILTERS)[number]["id"]

function memberCount(circle: AdminCircle) {
  const raw = circle.member_count
  if (Array.isArray(raw)) return Number(raw[0]?.count || 0)
  return Number(raw || 0)
}

function PausedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
      <CircleSlash className="h-2.5 w-2.5" /> Paused
    </span>
  )
}

/**
 * Site-staff view of every community. Pausing is the reversible half of
 * moderation: the world keeps its threads and members, but closes to everyone
 * outside the staff until it is switched back on. Delete stays separate and
 * explicitly destructive.
 */
export function AdminCommunitiesPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [circles, setCircles] = useState<AdminCircle[]>([])
  const [filter, setFilter] = useState<FilterId>("all")
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(
    async (search = q, nextFilter: FilterId = filter) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: "30", offset: "0" })
        if (search.trim()) params.set("search", search.trim())
        if (nextFilter !== "all") params.set("status", nextFilter)
        const res = await fetch(`/api/admin/circles?${params}`, { headers: getAuthHeader() })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load communities")
        setCircles(data.circles || [])
        setHasMore(Boolean(data.hasMore))
      } catch (error: any) {
        toast({
          title: "Could not load communities",
          description: error.message,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    },
    [filter, getAuthHeader, q, toast],
  )

  useEffect(() => {
    void load("", "all")
    // Only on mount — searching and filtering run from the controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({ limit: "30", offset: String(circles.length) })
      if (q.trim()) params.set("search", q.trim())
      if (filter !== "all") params.set("status", filter)
      const res = await fetch(`/api/admin/circles?${params}`, { headers: getAuthHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load more")
      setCircles((prev) => [...prev, ...(data.circles || [])])
      setHasMore(Boolean(data.hasMore))
    } catch (error: any) {
      toast({ title: "Could not load more", description: error.message, variant: "destructive" })
    } finally {
      setLoadingMore(false)
    }
  }

  const paused = useMemo(
    () => circles.filter((c) => c.is_active === false).length,
    [circles],
  )

  const togglePaused = async (circle: AdminCircle) => {
    const nextPaused = circle.is_active !== false
    const ok = await confirmDialog({
      title: nextPaused ? `Pause ${circle.name}?` : `Reactivate ${circle.name}?`,
      description: nextPaused
        ? "Members outside the staff lose access to the community and its threads. Nothing is deleted — you can switch it back on at any time."
        : "The community opens up again for its members exactly as it was before.",
      confirmLabel: nextPaused ? "Pause community" : "Reactivate",
      destructive: nextPaused,
    })
    if (!ok) return

    setBusyId(String(circle.id))
    try {
      const res = await fetch("/api/admin/circles", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ circleId: circle.id, banned: nextPaused }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update community")
      setCircles((prev) =>
        prev.map((c) =>
          String(c.id) === String(circle.id)
            ? { ...c, is_active: !nextPaused }
            : c,
        ),
      )
      toast({ title: nextPaused ? "Community paused" : "Community reactivated" })
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (circle: AdminCircle) => {
    const ok = await confirmDialog({
      title: `Delete ${circle.name}?`,
      description:
        "Every thread, reply, and membership in this community is removed for good. Pause it instead if you only need to stop new activity.",
      confirmLabel: "Delete community",
      destructive: true,
    })
    if (!ok) return

    setBusyId(String(circle.id))
    try {
      const res = await fetch(
        `/api/admin/circles?circleId=${encodeURIComponent(String(circle.id))}`,
        { method: "DELETE", headers: getAuthHeader() },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete community")
      setCircles((prev) => prev.filter((c) => String(c.id) !== String(circle.id)))
      toast({ title: "Community deleted" })
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void load()}
                placeholder="Search communities by name or description…"
                className="rounded-full pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => void load()}>
                Search
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => void load()}
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id)
                  void load(q, f.id)
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === f.id
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
            {paused > 0 && filter === "all" && (
              <span className="ml-1 text-[11px] text-muted-foreground">
                {paused} paused on this page
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border bg-card py-20">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : circles.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <Users className="mx-auto h-9 w-9 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-bold">No communities match</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {q.trim() ? "Try a different phrase." : "Nothing has been created here yet."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {circles.map((circle) => {
            const owner = circle.owner
            const ownerName = owner?.display_name || owner?.username || "Unknown owner"
            const isPaused = circle.is_active === false
            const busy = busyId === String(circle.id)
            return (
              <li key={String(circle.id)}>
                <Card className={cn("transition-colors", isPaused && "border-amber-500/30 bg-amber-500/[0.03]")}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <Avatar className="h-11 w-11 shrink-0 rounded-xl">
                      <AvatarImage src={circle.avatar_url || undefined} alt="" />
                      <AvatarFallback className="rounded-xl text-xs">
                        {(circle.name || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/communities/${circle.id}`}
                          className="truncate text-sm font-bold hover:underline"
                        >
                          {circle.name}
                        </Link>
                        {isPaused && <PausedBadge />}
                        {circle.is_private && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" /> Private
                          </span>
                        )}
                        {circle.is_verified && (
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {circle.description || "No description"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {memberCount(circle).toLocaleString()} member
                          {memberCount(circle) === 1 ? "" : "s"}
                        </span>
                        <span className="inline-flex items-center gap-1 truncate">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={owner?.avatar_url || undefined} alt="" />
                            <AvatarFallback className="text-[8px]">
                              {ownerName.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {ownerName}
                        </span>
                        {circle.category && <span>{circle.category}</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button variant="outline" size="sm" className="rounded-full" asChild>
                        <Link href={`/communities/${circle.id}`}>
                          Open
                          <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={busy}
                        onClick={() => void togglePaused(circle)}
                      >
                        {isPaused ? (
                          <>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reactivate
                          </>
                        ) : (
                          <>
                            <Ban className="mr-1 h-3.5 w-3.5" /> Pause
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                        disabled={busy}
                        onClick={() => void remove(circle)}
                        aria-label={`Delete ${circle.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="rounded-full"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? <Spinner className="mr-2 h-4 w-4" /> : null}
            Load more communities
          </Button>
        </div>
      )}
    </div>
  )
}
