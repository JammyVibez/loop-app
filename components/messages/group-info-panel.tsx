"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { useAuth } from "@/hooks/use-auth"

import { Spinner } from "@/components/ui/skeletons"
import { cn } from "@/lib/utils"
import {
  Users, Shield, Crown, Settings, Pin, Link2, Lock, LockOpen,
  ChevronLeft, UserMinus, Copy, Check, X, ChevronDown, ChevronUp, Bell, BellOff,
} from "@/components/icons/lucide-compat"

const ROLE_LABELS: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  owner: { label: "Admin", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Crown },
  admin: { label: "Admin", color: "bg-violet-500/10 text-violet-600 border-violet-500/30", icon: Shield },
  moderator: { label: "Mod", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: Shield },
  member: { label: "Member", color: "bg-muted text-muted-foreground border-border", icon: Users },
}

interface GroupInfoPanelProps {
  conversationId: string
  onClose: () => void
  onMemberRemoved?: (userId: string) => void
}

export function GroupInfoPanel({ conversationId, onClose, onMemberRemoved }: GroupInfoPanelProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [membersExpanded, setMembersExpanded] = useState(true)
  const [pinnedExpanded, setPinnedExpanded] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [actOnMember, setActOnMember] = useState<any>(null)
  const [showRolePicker, setShowRolePicker] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/group`, {
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (data.success) setInfo(data)
    } catch (e: any) {
      console.error("Failed to load group info:", e)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => { load() }, [load])

  const myRole = info?.my_role || "member"
  const isMod = ["owner", "admin", "moderator"].includes(myRole)
  const isAdmin = ["owner", "admin"].includes(myRole)
  const isOwner = myRole === "owner"
  const conv = info?.conversation

  const saveSettings = async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/group`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ name: editName, description: editDesc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "Group updated" })
      setEditing(false)
      load()
    } catch (e: any) {
      toast({ title: "Couldn't update", description: e.message, variant: "destructive" })
    }
  }

  const toggleLock = async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/group`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ is_locked: !conv?.is_locked }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: conv?.is_locked ? "Group unlocked" : "Group locked" })
      load()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const generateInvite = async () => {
    setGeneratingInvite(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/group/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "Invite link created" })
      load()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setGeneratingInvite(false)
    }
  }

  const copyInvite = () => {
    if (!conv?.invite_link) return
    const url = `${window.location.origin}/conversations/join/${conv.invite_link}`
    navigator.clipboard.writeText(url)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
    toast({ title: "Invite link copied" })
  }

  const changeMemberRole = async (userId: string, role: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/group/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: userId, role }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: "Role updated" })
      setShowRolePicker(false)
      load()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/group/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: "Member removed" })
      onMemberRemoved?.(userId)
      load()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const leaveGroup = async () => {
    if (
      !(await confirmDialog({
        title: "Leave this group?",
        description: "You stop receiving its messages and it disappears from your chat list. You can be added back later.",
        confirmLabel: "Leave group",
        destructive: true,
      }))
    )
      return
    try {
      const res = await fetch(`/api/conversations/${conversationId}/group/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: "Left the group" })
      onClose()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!info) return <p className="p-4 text-sm text-muted-foreground">Could not load group info.</p>

  const members = info.members || []
  const pinned = info.pinned_messages || []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-bold flex-1">Group info</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group avatar + name */}
        <div className="flex flex-col items-center py-6 border-b border-border">
          <div className="relative h-20 w-20 mb-3">
            {members.slice(0, 4).map((m: any, i: number) => (
              <Avatar
                key={m.user_id}
                className="h-11 w-11 absolute border-2 border-background"
                style={{ top: i * 6, left: i * 6, zIndex: 4 - i }}
              >
                <AvatarImage src={m.user?.avatar_url} />
                <AvatarFallback className="text-[10px] font-bold">
                  {(m.user?.display_name || m.user?.username || "?")[0]}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>

          {editing ? (
            <div className="w-full max-w-xs space-y-2 px-4">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value.slice(0, 100))}
                placeholder="Group name"
                className="h-8 text-center text-sm"
              />
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value.slice(0, 500))}
                placeholder="Description (optional)"
                className="h-8 text-center text-xs"
              />
              <div className="flex gap-1.5 justify-center">
                <Button size="sm" variant="outline" className="rounded-full text-[10px]" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" className="rounded-full text-[10px]" onClick={saveSettings}>Save</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold">{conv?.name || "Group Chat"}</p>
              {conv?.description && <p className="text-[11px] text-muted-foreground mt-0.5">{conv.description}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">{info.member_count} members</p>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 text-[10px] text-muted-foreground"
                  onClick={() => {
                    setEditName(conv?.name || "")
                    setEditDesc(conv?.description || "")
                    setEditing(true)
                  }}
                >
                  <Settings className="h-3 w-3 mr-1" /> Edit
                </Button>
              )}
            </>
          )}
        </div>

        {/* Admin controls */}
        {isAdmin && (
          <div className="border-b border-border px-4 py-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admin controls</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-[10px] h-7"
                onClick={toggleLock}
              >
                {conv?.is_locked ? <LockOpen className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                {conv?.is_locked ? "Unlock chat" : "Lock chat"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-[10px] h-7"
                onClick={generateInvite}
                disabled={generatingInvite}
              >
                <Link2 className="h-3 w-3 mr-1" />
                {conv?.invite_link ? "Regenerate invite" : "Create invite link"}
              </Button>
            </div>
            {conv?.invite_link && (
              <div className="flex items-center gap-1.5">
                <code className="flex-1 truncate text-[9px] bg-muted rounded px-2 py-1">
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/conversations/join/${conv.invite_link}`}
                </code>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copyInvite}>
                  {inviteCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Pinned messages */}
        {pinned.length > 0 && (
          <div className="border-b border-border">
            <button
              onClick={() => setPinnedExpanded(!pinnedExpanded)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold"
            >
              <Pin className="h-4 w-4 text-muted-foreground" />
              Pinned messages ({pinned.length})
              {pinnedExpanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </button>
            {pinnedExpanded && (
              <div className="px-4 pb-3 space-y-1.5">
                {pinned.map((msg: any) => (
                  <div key={msg.id} className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs line-clamp-2">{msg.content}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{msg.author_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members */}
        <div>
          <button
            onClick={() => setMembersExpanded(!membersExpanded)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            Members ({members.length})
            {membersExpanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </button>
          {membersExpanded && (
            <div className="px-2 pb-3 space-y-0.5">
              {members.map((m: any) => {
                const roleDef = ROLE_LABELS[m.role] || ROLE_LABELS.member
                const RoleIcon = roleDef.icon
                return (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/40"
                  >
                    <Link href={`/profile/${m.user?.username}`}>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={m.user?.avatar_url} />
                        <AvatarFallback className="text-xs font-bold">
                          {(m.user?.display_name || m.user?.username || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/profile/${m.user?.username}`} className="text-xs font-semibold truncate hover:underline">
                          {m.user?.display_name || m.user?.username}
                        </Link>
                        {m.user?.is_verified && (
                          <span className="h-3 w-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Check className="h-2 w-2 text-blue-500" />
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={cn("text-[9px] gap-0.5", roleDef.color)}>
                      <RoleIcon className="h-2.5 w-2.5" /> {roleDef.label}
                    </Badge>
                    {isAdmin && m.user_id !== user?.id && m.role !== "owner" && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-[9px]"
                          title="Change role"
                          onClick={() => setActOnMember(m)}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500"
                          title="Remove"
                          onClick={() => {
                            void (async () => {
                              const name = m.user?.display_name || m.user?.username || "this member"
                              const ok = await confirmDialog({
                                title: `Remove ${name}?`,
                                description: "They are removed from the group and a notice is posted for everyone.",
                                confirmLabel: "Remove",
                                destructive: true,
                              })
                              if (ok) void removeMember(m.user_id)
                            })()
                          }}
                        >
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mute toggle */}
        <div className="border-t border-border px-4 py-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notifications</p>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/conversations/" + conversationId + "/group/members", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...getAuthHeader() },
                  body: JSON.stringify({ user_id: user?.id, mute: !(info as any).members?.find((m: any) => m.user_id === user?.id)?.is_muted }),
                })
                if (res.ok) {
                  toast({ title: (info as any).members?.find((m: any) => m.user_id === user?.id)?.is_muted ? "Notifications unmuted" : "Notifications muted" })
                  load()
                }
              } catch {}
            }}
            className="flex items-center gap-2 text-xs text-foreground w-full py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {(info as any).members?.find((m: any) => m.user_id === user?.id)?.is_muted ? (
              <><BellOff className="h-4 w-4 text-muted-foreground" /> Unmute notifications</>
            ) : (
              <><Bell className="h-4 w-4 text-emerald-500" /> Mute notifications</>
            )}
          </button>
        </div>

        {/* Shared media */}
        {(() => {
          const mediaMsgs = (info as any).members || []
          return null // Placeholder for shared media grid
        })()}

        {/* Leave */}
        {myRole !== "owner" && (
          <div className="px-4 py-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full rounded-full text-red-500 border-red-500/30 hover:bg-red-500/10 text-xs"
              onClick={leaveGroup}
            >
              Leave group
            </Button>
          </div>
        )}
      </div>

      {/* Role picker dialog */}
      {actOnMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActOnMember(null)}>
          <div className="bg-card rounded-2xl border border-border p-4 w-64 space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold">Change role for {actOnMember.user?.display_name || actOnMember.user?.username}</p>
            {["member", "moderator", "admin"].map((role) => (
              <button
                key={role}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2 text-xs font-medium hover:bg-muted/60 transition-colors",
                  actOnMember.role === role && "bg-primary/10 text-primary",
                )}
                onClick={() => changeMemberRole(actOnMember.user_id, role)}
              >
                {role === "admin" ? "Admin" : role === "moderator" ? "Moderator" : "Member"}
                {actOnMember.role === role && " (current)"}
              </button>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-[10px]" onClick={() => setActOnMember(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
