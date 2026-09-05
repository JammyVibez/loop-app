"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatNumber, timeAgo } from "@/lib/community-engine"
import { Users, Search, BadgeCheck, Loader2, Shield, Crown, Star, Megaphone, Handshake, Brain, Palette, Flame } from "lucide-react"

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  owner: { label: "👑 Founder", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  admin: { label: "🛡️ Admin", className: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
  moderator: { label: "🔨 Moderator", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  member: { label: "Member", className: "bg-muted text-muted-foreground border-border" },
}

const RECOGNITIONS = [
  { kind: "knowledge_keeper", label: "🧠 Knowledge Keeper" },
  { kind: "creator", label: "🎨 Creator" },
  { kind: "connector", label: "🤝 Connector" },
  { kind: "conversation_starter", label: "💬 Conversation Starter" },
  { kind: "organizer", label: "🧭 Organizer" },
  { kind: "top_contributor", label: "🔥 Top Contributor" },
]

export function WorldMembers({ communityId, initial, viewerRole, viewerId }: { communityId: string; initial: any[]; viewerRole?: string | null; viewerId?: string | null }) {
  const { user } = useAuth()
  const [members, setMembers] = useState<any[]>(initial)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeMember, setActiveMember] = useState<any>(null)
  const [recognizing, setRecognizing] = useState(false)

  const isAdmin = viewerRole === "owner" || viewerRole === "admin"
  const isMod = isAdmin || viewerRole === "moderator"

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      if (roleFilter) params.set("role", roleFilter)
      const res = await fetch(`/api/communities/${communityId}/members?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load members")
      setMembers(data.members || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId, search, roleFilter])

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [load])

  const changeRole = async (member: any, role: string) => {
    const res = await fetch(`/api/communities/${communityId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: member.user_id, role }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || "Failed")
      return
    }
    load()
  }

  const recognize = async (kind: string) => {
    if (!activeMember) return
    setRecognizing(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeMember.user_id, kind }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to recognize")
      setActiveMember(null)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRecognizing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="font-bold flex items-center gap-1.5"><Users className="h-4 w-4" /> Members</h2>
          <p className="text-xs text-muted-foreground">Roles, reputation and recognitions earned in this community.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…" className="pl-9 rounded-xl h-9 text-sm" />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-2.5 text-xs"
          >
            <option value="">All roles</option>
            <option value="owner">Founder</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="member">Member</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No members found.
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const roleBadge = ROLE_BADGE[m.role] || ROLE_BADGE.member
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Link href={`/profile/${m.user?.username}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={m.user?.avatar_url || ""} alt="" />
                    <AvatarFallback>{(m.user?.display_name || m.user?.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/profile/${m.user?.username}`} className="text-sm font-semibold truncate hover:underline">
                      {m.user?.display_name || m.user?.username}
                    </Link>
                    {m.user?.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                    <Badge className={`text-[9px] ${roleBadge.className}`}>{roleBadge.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">⭐ {formatNumber(m.contribution_score)} rep</span>
                    {m.recognition_count > 0 && <span>🎖️ {m.recognition_count} recognitions</span>}
                    {m.last_active && <span>active {timeAgo(m.last_active)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isMod && m.user_id !== viewerId && (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value)}
                        className="h-8 rounded-lg border border-input bg-background px-1.5 text-[11px]"
                        disabled={!isAdmin && m.role !== "moderator"}
                      >
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        {isAdmin && <option value="admin">Admin</option>}
                        {isAdmin && <option value="owner">Founder</option>}
                      </select>
                      <Button size="sm" variant="outline" className="rounded-full h-8 text-[11px]" onClick={() => setActiveMember(m)}>
                        <Star className="h-3 w-3 mr-1" /> Recognize
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recognize dialog */}
      <Dialog open={Boolean(activeMember)} onOpenChange={(o) => { if (!o) setActiveMember(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Recognize {activeMember?.user?.display_name || activeMember?.user?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-[11px] text-muted-foreground">Recognitions are community badges of appreciation — they don't grant admin powers.</p>
            {RECOGNITIONS.map((r) => (
              <button
                key={r.kind}
                onClick={() => recognize(r.kind)}
                disabled={recognizing}
                className="w-full rounded-xl border border-border bg-card p-3 text-left text-sm font-medium transition hover:border-indigo-500/50 hover:bg-indigo-500/5"
              >
                {r.label}
              </button>
            ))}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}