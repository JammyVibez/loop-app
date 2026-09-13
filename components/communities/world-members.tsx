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
import { MemberReputation } from "./member-reputation"
import { useToast } from "@/hooks/use-toast"
import { Users, Search, Shield, Crown, Star, Award, Handshake, Brain, Palette, Flame, UserPlus, Check, X } from "lucide-react"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { Spinner } from "@/components/ui/skeletons"

const ROLE_BADGE: Record<string, { label: string; className: string; icon: typeof Shield }> = {
  owner: { label: "Founder", className: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Crown },
  admin: { label: "Admin", className: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30", icon: Shield },
  moderator: { label: "Moderator", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: Shield },
  member: { label: "Member", className: "bg-muted text-muted-foreground border-border", icon: Users },
}

const RECOGNITIONS = [
  { kind: "knowledge_keeper", label: "Knowledge Keeper", icon: Brain },
  { kind: "creator", label: "Creator", icon: Palette },
  { kind: "connector", label: "Connector", icon: Handshake },
  { kind: "conversation_starter", label: "Conversation Starter", icon: Star },
  { kind: "organizer", label: "Organizer", icon: Award },
  { kind: "top_contributor", label: "Top Contributor", icon: Flame },
]

export function WorldMembers({ communityId, initial, viewerRole, viewerId }: { communityId: string; initial: any[]; viewerRole?: string | null; viewerId?: string | null }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [members, setMembers] = useState<any[]>(initial)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeMember, setActiveMember] = useState<any>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

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
      toast({
        title: "Couldn't update role",
        description: data.error || "Check your permissions and try again.",
        variant: "destructive",
      })
      return
    }
    load()
  }

  const approveJoin = async (member: any) => {
    setBusyId(member.user_id)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: member.user_id, status: "active" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to approve")
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const rejectJoin = async (member: any) => {
    setBusyId(member.user_id)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: member.user_id, status: "rejected" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reject")
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const pendingRequests = members.filter((m) => m.status === "pending")
  const activeMembers = members.filter((m) => m.status !== "pending")

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
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members..." className="pl-9 rounded-xl h-9 text-sm" />
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

      {/* Join requests — moderators approve/reject pending members */}
      {isMod && pendingRequests.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold">Join requests</h3>
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[9px]">{pendingRequests.length} pending</Badge>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.user?.avatar_url || ""} alt="" />
                  <AvatarFallback>{(m.user?.display_name || m.user?.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{m.user?.display_name || m.user?.username}</p>
                  <p className="text-[10px] text-muted-foreground">@{m.user?.username} · requested {m.joined_at ? timeAgo(m.joined_at) : "recently"}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="rounded-full h-8 text-[11px] bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => approveJoin(m)}
                    disabled={busyId === m.user_id}
                  >
                    {busyId === m.user_id ? <Spinner className="h-3 w-3" /> : <Check className="h-3 w-3 mr-1" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full h-8 text-[11px] text-red-500 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => rejectJoin(m)}
                    disabled={busyId === m.user_id || !isAdmin}
                    title={!isAdmin ? "Only admins can reject requests" : "Reject request"}
                  >
                    {busyId === m.user_id ? <Spinner className="h-3 w-3" /> : <X className="h-3 w-3 mr-1" />}
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : activeMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {pendingRequests.length > 0 ? "No approved members yet." : "No members found."}
        </div>
      ) : (
        <div className="space-y-2">
          {activeMembers.map((m) => {
            const roleBadge = ROLE_BADGE[m.role] || ROLE_BADGE.member
            const RoleIcon = roleBadge.icon
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
                    {m.user?.is_verified && <VerifiedSeal size={14} title="Verified Creator" />}
                    <Badge className={`text-[9px] gap-1 ${roleBadge.className}`}>
                      <RoleIcon className="h-2.5 w-2.5" /> {roleBadge.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Star className="h-3 w-3" /> {formatNumber(m.contribution_score)} rep
                    </span>
                    {m.recognition_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3" /> {m.recognition_count} recognitions
                      </span>
                    )}
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
            <p className="text-[11px] text-muted-foreground">Recognitions are community badges of appreciation - they don't grant admin powers.</p>
            {RECOGNITIONS.map((r) => {
              const Icon = r.icon
              return (
                <button
                  key={r.kind}
                  onClick={() => recognize(r.kind)}
                  disabled={recognizing}
                  className="w-full flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-left text-sm font-medium transition hover:border-indigo-500/50 hover:bg-indigo-500/5"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {r.label}
                </button>
              )
            })}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
