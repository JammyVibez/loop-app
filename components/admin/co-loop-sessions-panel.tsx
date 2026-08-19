"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Trash2, RefreshCw, Radio, Users, Globe, CheckCircle2, XCircle } from "lucide-react"

interface CoLoopSession {
  session_id: string
  owner_id: string
  owner_username: string
  co_authors: any[]
  status: string
  is_open_invite: boolean
  max_collaborators: number
  open_invite_topic: string | null
  feed_post_id: string | null
  created_at: string
  updated_at: string
  owner?: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
}

interface SessionCounts {
  active: number
  published: number
  ended: number
  open_invites: number
}

export function CoLoopSessionsPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [sessions, setSessions] = useState<CoLoopSession[]>([])
  const [counts, setCounts] = useState<SessionCounts>({ active: 0, published: 0, ended: 0, open_invites: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const fetchSessions = useCallback(async (status?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      params.set("limit", "100")
      const res = await fetch(`/api/admin/co-loop-sessions?${params}`, {
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (data.success) {
        setSessions(data.sessions || [])
        setCounts(data.counts || { active: 0, published: 0, ended: 0, open_invites: 0 })
      }
    } catch (err: any) {
      toast({ title: "Failed to load sessions", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, toast])

  useEffect(() => {
    fetchSessions(filter || undefined)
  }, [filter, fetchSessions])

  const handleDelete = async (sessionId: string) => {
    setDeleting(sessionId)
    try {
      const res = await fetch("/api/admin/co-loop-sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ session_ids: [sessionId] }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Session deleted", description: `Deleted ${data.deleted} session(s)` })
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  const handleBulkDeleteEnded = async () => {
    setBulkDeleting(true)
    try {
      const res = await fetch("/api/admin/co-loop-sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ delete_all_ended: true }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Bulk delete complete", description: `Deleted ${data.deleted} ended session(s)` })
        fetchSessions(filter || undefined)
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      toast({ title: "Bulk delete failed", description: err.message, variant: "destructive" })
    } finally {
      setBulkDeleting(false)
    }
  }

  const statusColor = (status: string) => {
    if (status === "active") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    if (status === "published") return "bg-blue-500/15 text-blue-400 border-blue-500/30"
    return "bg-slate-500/15 text-slate-400 border-slate-500/30"
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-5 w-5 text-cyan-400" />
            Co-Loop Sessions
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSessions(filter || undefined)}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDeleteEnded}
              disabled={bulkDeleting}
              className="gap-1.5"
            >
              {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete All Ended
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {(["active", "published", "ended", "open_invites"] as const).map((key) => (
            <div
              key={key}
              className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-center"
            >
              <div className="text-lg font-bold">{counts[key]}</div>
              <div className="text-[10px] text-muted-foreground capitalize">
                {key === "open_invites" ? "Open Invites" : key}
              </div>
            </div>
          ))}
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 mt-3">
          {["", "active", "published", "ended"].map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
              className="text-xs"
            >
              {s || "All"}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No sessions found</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">
                      @{session.owner_username || session.owner?.username || "unknown"}
                    </span>
                    <Badge variant="outline" className={`text-[9px] ${statusColor(session.status)}`}>
                      {session.status}
                    </Badge>
                    {session.is_open_invite && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-400">
                        <Globe className="h-2.5 w-2.5 mr-0.5" /> Open
                      </Badge>
                    )}
                  </div>
                  {session.open_invite_topic && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {session.open_invite_topic}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {session.co_authors?.length || 0} co-authors
                    </span>
                    <span>{new Date(session.created_at).toLocaleDateString()}</span>
                    {session.is_open_invite && (
                      <span>{session.max_collaborators} max</span>
                    )}
                  </div>
                </div>

                {(session.status === "published" || session.status === "ended") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(session.session_id)}
                    disabled={deleting === session.session_id}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                  >
                    {deleting === session.session_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
