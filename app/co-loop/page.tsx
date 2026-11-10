"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  Users,
  
  ExternalLink,
  Plus,
  ArrowLeft,
  Clock,
  CheckCircle2,
  StopCircle,
  Zap,
  Globe,
} from "@/components/icons/lucide-compat"
import { formatDistanceToNow } from "date-fns"
import { Spinner } from "@/components/ui/skeletons"

interface CoLoopSession {
  session_id: string
  created_at: string
  updated_at: string
  open_invite_topic?: string
  max_collaborators: number
  status: string
  is_open_invite: boolean
  co_authors: Array<{
    user_id: string
    joined_at: string
    profiles: {
      id: string
      username: string
      display_name: string
      avatar_url?: string
    }
  }>
}

export default function CoLoopSessionsPage() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [sessions, setSessions] = useState<CoLoopSession[]>([])
  const [loading, setLoading] = useState(true)
  const [endingSession, setEndingSession] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Fetch sessions where user is owner
      const { data: owned, error: e1 } = await supabase
        .from("co_loop_sessions")
        .select(`
          session_id,
          created_at,
          updated_at,
          max_collaborators,
          status,
          is_open_invite,
          open_invite_topic,
          co_authors:open_co_loop_participants(
            user_id,
            joined_at,
            profiles:user_id(id, username, display_name, avatar_url)
          )
        `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)

      if (e1) console.error("Error loading sessions:", e1)

      // Fetch sessions where user is a co-author
      const { data: joined, error: e2 } = await supabase
        .from("open_co_loop_participants")
        .select(`
          session_id,
          joined_at,
          session:session_id(
            session_id,
            created_at,
            updated_at,
            max_collaborators,
            status,
            is_open_invite,
            open_invite_topic,
            owner_id,
            co_authors:open_co_loop_participants(
              user_id,
              joined_at,
              profiles:user_id(id, username, display_name, avatar_url)
            )
          )
        `)
        .eq("user_id", user.id)

      if (e2) console.error("Error loading joined sessions:", e2)

      const allSessions: CoLoopSession[] = []

      // Add owned sessions
      for (const s of owned || []) {
        allSessions.push(s as unknown as CoLoopSession)
      }

      // Add joined sessions (that aren't already in owned)
      for (const j of joined || []) {
        const sess = j.session as unknown as CoLoopSession
        if (sess && !allSessions.some((s) => s.session_id === sess.session_id)) {
          allSessions.push(sess)
        }
      }

      // Sort by most recent
      allSessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setSessions(allSessions)
    } catch (err) {
      console.error("Failed to load sessions:", err)
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const endSession = async (sessionId: string) => {
    setEndingSession(sessionId)
    try {
      // PATCH is the status route; POST is the join endpoint, so ending never
      // wrote anything no matter what the body said.
      const res = await fetch("/api/co-loop/session-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ session_id: sessionId, status: "ended" }),
      })
      if (res.ok) {
        toast({ title: "Session ended", description: "The Co-Loop session has been closed." })
        setSessions((prev) => prev.map((s) => s.session_id === sessionId ? { ...s, status: "ended" } : s))
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Failed to end session", description: data.error || "Try again", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to end session", variant: "destructive" })
    } finally {
      setEndingSession(null)
    }
  }

  const isActive = (s: CoLoopSession) => s.status === "active" || s.status === "published"
  const isOwned = (s: CoLoopSession) => user && s.co_authors?.some((ca) => ca.user_id === user.id && ca.joined_at <= s.created_at) || !s.co_authors?.length

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="max-w-sm w-full text-center p-8">
          <p className="text-muted-foreground mb-4">Sign in to manage your Co-Loop sessions</p>
          <Button asChild>
            <Link href="/auth?returnTo=/co-loop">Sign In</Link>
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                Co-Loop Sessions
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Your active and past collaborative sessions</p>
            </div>
          </div>

          <Button asChild className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-white hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/25 text-sm">
            <Link href="/create?tab=coloop">
              <Plus className="h-4 w-4 mr-1" />
              New Co-Loop
            </Link>
          </Button>
        </div>

        {/* Sessions List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-8 w-8 text-cyan-400" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="text-center p-12 border-dashed border-2">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20">
                <Zap className="h-8 w-8 text-cyan-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No Co-Loop sessions yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Start a collaborative Co-Loop with other creators or join one from the feed.
            </p>
            <Button asChild className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-white hover:from-cyan-400 hover:to-indigo-500">
              <Link href="/create?tab=coloop">
                <Zap className="h-4 w-4 mr-2" />
                Start Your First Co-Loop
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const coAuthorCount = session.co_authors?.length || 0
              const sessionActive = session.status === "active"
              const sessionEnded = session.status === "ended"
              const sessionPublished = session.status === "published"
              const topic = session.open_invite_topic || "Untitled session"

              return (
                <Card
                  key={session.session_id}
                  className={
                    "relative overflow-hidden border transition-all " +
                    (sessionActive
                      ? "border-cyan-500/30 shadow-lg shadow-cyan-500/5"
                      : sessionEnded
                        ? "border-slate-700/30 opacity-60"
                        : "border-emerald-500/30 shadow-lg shadow-emerald-500/5")
                  }
                >
                  {/* Status bar */}
                  <div
                    className={
                      "h-0.5 w-full " +
                      (sessionActive
                        ? "bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500"
                        : sessionPublished
                          ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                          : "bg-gradient-to-r from-slate-600 to-slate-700")
                    }
                  />

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge
                            variant="outline"
                            className={
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0 " +
                              (sessionActive
                                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                                : sessionPublished
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                  : "border-slate-500/40 bg-slate-500/10 text-slate-400")
                            }
                          >
                            {sessionActive ? "Active" : sessionPublished ? "Published" : "Ended"}
                          </Badge>
                          {session.is_open_invite && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-300 px-2 py-0">
                              <Globe className="h-2.5 w-2.5 mr-1" />
                              Open Invite
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-foreground line-clamp-1">{topic}</h3>

                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {coAuthorCount}/{session.max_collaborators}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Co-author avatars */}
                        {session.co_authors && session.co_authors.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="flex -space-x-1.5">
                              {session.co_authors.slice(0, 4).map((ca) => {
                                const profile = ca.profiles
                                return (
                                  <VideoAvatar key={ca.user_id} src={profile?.avatar_url} videoSrc={(profile as any)?.video_avatar_url} isPremium={(profile as any)?.is_premium} fallback={(profile?.display_name || "?")[0].toUpperCase()} size="sm" className="h-5 w-5 ring-2 ring-background rounded-full" />
                                )
                              })}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {session.co_authors.map((ca) => ca.profiles?.username).filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {sessionActive && (
                          <>
                            <Button
                              asChild
                              size="sm"
                              className="rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-white text-xs shadow-md shadow-cyan-500/20"
                            >
                              <Link href={`/co-loop/studio?session=${session.session_id}`}>
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Enter
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                              onClick={() => endSession(session.session_id)}
                              disabled={endingSession === session.session_id}
                            >
                              {endingSession === session.session_id ? (
                                <Spinner className="h-3.5 w-3.5 mr-1" />
                              ) : (
                                <StopCircle className="h-3.5 w-3.5 mr-1" />
                              )}
                              End
                            </Button>
                          </>
                        )}
                        {sessionPublished && (
                          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs px-3 py-1">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Published
                          </Badge>
                        )}
                        {sessionEnded && (
                          <Badge variant="outline" className="border-slate-500/40 bg-slate-500/10 text-slate-400 text-xs px-3 py-1">
                            Ended
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
