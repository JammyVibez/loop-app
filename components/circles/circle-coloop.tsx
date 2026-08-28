"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Video,
  Plus,
  Users,
  Clock,
  Play,
  Sparkles,
  Loader2,
  X,
} from "lucide-react"

interface CircleColoopProps {
  circleId: string
  isMember: boolean
}

interface CoLoopSession {
  id: string
  session_id: string
  title: string
  description?: string
  max_collaborators: number
  status: "active" | "completed" | "cancelled"
  loop_id?: string
  created_at: string
  creator: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_premium?: boolean
    is_verified?: boolean
  }
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

export function CircleColoop({ circleId, isMember }: CircleColoopProps) {
  const [sessions, setSessions] = useState<CoLoopSession[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [maxCollab, setMaxCollab] = useState(5)
  const [creating, setCreating] = useState(false)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`/api/circles/${circleId}/coloop`, {
          headers: getAuthHeader(),
        })
        const data = await res.json()
        if (data.success) setSessions(data.sessions || [])
      } catch (err) {
        console.error("Failed to load co-loop sessions:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [circleId, getAuthHeader])

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Give your Co-Loop a title", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/coloop`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), max_collaborators: maxCollab }),
      })
      const data = await res.json()
      if (data.success) {
        setSessions((prev) => [data.session, ...prev])
        setCreateOpen(false)
        setTitle("")
        setDescription("")
        setMaxCollab(5)
        toast({ title: "Co-Loop started! 🎬", description: "Invite circle members to collaborate." })
      } else {
        toast({ title: "Failed", description: data.error || "Could not start Co-Loop", variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const activeSessions = sessions.filter((s) => s.status === "active")
  const completedSessions = sessions.filter((s) => s.status === "completed")

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-orange-400" />
          <h3 className="text-sm font-bold">Co-Loop Sessions</h3>
          {activeSessions.length > 0 && (
            <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 text-[10px]">
              {activeSessions.length} live
            </Badge>
          )}
        </div>
        {isMember && (
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Start Co-Loop
          </Button>
        )}
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div className="space-y-2">
          {activeSessions.map((session) => (
            <Card key={session.id} className="rounded-2xl border-orange-500/30 bg-orange-500/5 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <VideoAvatar
                      src={session.creator.avatar_url}
                      className="h-10 w-10 border border-orange-400/40"
                      fallback={session.creator.display_name?.charAt(0) || "?"}
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${session.creator.username}`} className="text-xs font-bold hover:text-cyan-400 truncate">
                        {session.creator.display_name}
                      </Link>
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px]">
                        ● LIVE
                      </Badge>
                    </div>
                    <p className="text-sm font-bold mt-0.5">{session.title}</p>
                    {session.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{session.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> Max {session.max_collaborators}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTimeAgo(session.created_at)}
                      </span>
                    </div>
                  </div>
                  <Link href={`/co-loop/${session.session_id}`}>
                    <Button size="sm" className="rounded-xl bg-orange-500 text-black font-bold text-xs">
                      <Play className="h-3.5 w-3.5 mr-1" /> Join
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Past Sessions</h4>
          {completedSessions.slice(0, 5).map((session) => (
            <div key={session.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
              <VideoAvatar
                src={session.creator.avatar_url}
                className="h-8 w-8 opacity-70"
                fallback={session.creator.display_name?.charAt(0) || "?"}
                fallbackClassName="text-[10px]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{session.title}</p>
                <p className="text-[10px] text-muted-foreground">{formatTimeAgo(session.created_at)}</p>
              </div>
              {session.loop_id && (
                <Link href={`/loop/${session.loop_id}`}>
                  <Badge className="bg-cyan-500/10 text-cyan-400 border-0 text-[9px]">View Loop</Badge>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && sessions.length === 0 && (
        <div className="text-center py-8 space-y-3">
          <Video className="mx-auto h-10 w-10 text-orange-400 opacity-40" />
          <p className="text-xs font-bold text-foreground">No Co-Loop sessions yet</p>
          <p className="text-[10px] text-muted-foreground max-w-xs mx-auto">
            Start a collaborative loop with your circle members to create content together in real-time.
          </p>
          {isMember && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Start First Co-Loop
            </Button>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-card border-border rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Video className="h-5 w-5 text-orange-400" /> Start Co-Loop
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Create a collaborative session where circle members can loop together in real-time.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Together we build the next feature"
                className="mt-1 bg-background border-input rounded-xl"
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Description (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will you create together?"
                className="mt-1 bg-background border-input rounded-xl min-h-[80px]"
                maxLength={300}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Max Collaborators</label>
              <div className="flex gap-2 mt-1">
                {[3, 5, 8, 10, 15].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxCollab(n)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      maxCollab === n
                        ? "bg-orange-500 text-black"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {creating ? "Starting..." : "Start Co-Loop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
