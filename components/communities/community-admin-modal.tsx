"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Crown,
  Shield,
  Users,
  Settings,
  Trash2,
  UserX,
  Loader2,
  Search,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Eye,
  Ban,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CommunityAdminProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  communityName: string
}

export function CommunityAdminModal({
  open,
  onOpenChange,
  communityId,
  communityName,
}: CommunityAdminProps) {
  const { user } = useAuth()
  const [tab, setTab] = useState<"overview" | "members" | "moderation" | "settings">("overview")
  const [loading, setLoading] = useState(true)
  const [community, setCommunity] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [role, setRole] = useState("")
  const [search, setSearch] = useState("")
  const [acting, setActing] = useState<string | null>(null)

  // Settings form
  const [communityNameEdit, setCommunityNameEdit] = useState("")
  const [communityDesc, setCommunityDesc] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/communities/${communityId}`)
      const data = await res.json()
      if (res.ok) {
        setCommunity(data.community)
        setMembers(data.members || [])
        setStats(data.stats || {})
        setRole(data.role || "")
        setCommunityNameEdit(data.community?.name || "")
        setCommunityDesc(data.community?.description || "")
        setIsPrivate(Boolean(data.community?.is_private))
      }
    } catch (err) {
      console.error("Failed to load admin data:", err)
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const updateMemberRole = async (userId: string, newRole: string, displayName: string) => {
    if (!confirm(`Change ${displayName}'s role to ${newRole}?`)) return
    setActing(userId)
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      })
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
        )
      }
    } catch {
      /* ignore */
    } finally {
      setActing(null)
    }
  }

  const removeMember = async (userId: string, displayName: string) => {
    if (!confirm(`Remove ${displayName} from this community?`)) return
    setActing(userId)
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.user_id !== userId))
      }
    } catch {
      /* ignore */
    } finally {
      setActing(null)
    }
  }

  const muteMember = async (userId: string, displayName: string, muted: boolean) => {
    const action = muted ? "mute" : "unmute"
    if (!confirm(`${action === "mute" ? "Mute" : "Unmute"} ${displayName}?`)) return
    setActing(userId)
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_muted: muted }),
      })
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, is_muted: muted } : m))
        )
      }
    } catch {
      /* ignore */
    } finally {
      setActing(null)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: communityNameEdit.trim(),
          description: communityDesc.trim(),
          is_private: isPrivate,
        }),
      })
      if (res.ok) {
        setCommunity((prev: any) => ({
          ...prev,
          name: communityNameEdit.trim(),
          description: communityDesc.trim(),
          is_private: isPrivate,
        }))
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  const filteredMembers = members.filter(
    (m) =>
      !search ||
      m.username?.toLowerCase().includes(search.toLowerCase()) ||
      m.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "members", label: "Members", icon: Users },
    { id: "moderation", label: "Moderation", icon: Shield },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Admin Panel — {communityName}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/50 -mx-6 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition border-b-2 -mb-px",
                tab === t.id
                  ? "border-indigo-500 text-indigo-500"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{stats?.member_count || members.length}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Members</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{stats?.post_count || 0}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Posts</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{stats?.space_count || 0}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Spaces</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{stats?.active_today || 0}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Active Today</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
                    <h3 className="text-sm font-semibold">Community Info</h3>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Category:</span> {community?.category || "General"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Visibility:</span>{" "}
                      {community?.is_private ? "Private" : "Public"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Created:</span>{" "}
                      {community?.created_at ? new Date(community.created_at).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                </div>
              )}

              {/* Members Tab */}
              {tab === "members" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search members..."
                        className="pl-9 rounded-xl text-xs h-9"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={load} className="rounded-xl h-9 shrink-0">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>

                  <div className="space-y-1">
                    {filteredMembers.map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={m.avatar_url || ""} />
                          <AvatarFallback className="text-[10px] bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
                            {m.display_name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{m.display_name}</p>
                          <p className="text-[10px] text-muted-foreground">@{m.username}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {m.role === "admin" && (
                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[9px]">
                              <Crown className="h-2.5 w-2.5 mr-0.5" /> Admin
                            </Badge>
                          )}
                          {m.role === "moderator" && (
                            <Badge className="bg-sky-500/10 text-sky-500 border-sky-500/30 text-[9px]">
                              <Shield className="h-2.5 w-2.5 mr-0.5" /> Mod
                            </Badge>
                          )}
                          {m.is_muted && (
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/30 text-[9px]">
                              Muted
                            </Badge>
                          )}
                          {m.user_id !== user?.id && role === "admin" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={acting === m.user_id}
                                onClick={() =>
                                  updateMemberRole(
                                    m.user_id,
                                    m.role === "moderator" ? "member" : "moderator",
                                    m.display_name
                                  )
                                }
                                title={m.role === "moderator" ? "Remove mod" : "Make mod"}
                              >
                                <Shield className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={acting === m.user_id}
                                onClick={() => muteMember(m.user_id, m.display_name, !m.is_muted)}
                                title={m.is_muted ? "Unmute" : "Mute"}
                              >
                                {m.is_muted ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-amber-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600"
                                disabled={acting === m.user_id}
                                onClick={() => removeMember(m.user_id, m.display_name)}
                                title="Remove member"
                              >
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredMembers.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-8">No members found</p>
                    )}
                  </div>
                </div>
              )}

              {/* Moderation Tab */}
              {tab === "moderation" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-indigo-500" />
                      Moderation Settings
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">Require post approval</p>
                        <p className="text-[10px] text-muted-foreground">Posts must be approved before appearing</p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">Auto-moderate links</p>
                        <p className="text-[10px] text-muted-foreground">Flag posts with external links</p>
                      </div>
                      <Switch />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
                    <h3 className="text-sm font-semibold">Blocked Words</h3>
                    <Textarea
                      placeholder="Enter words to block, one per line..."
                      className="text-xs min-h-[80px] rounded-xl"
                    />
                    <Button size="sm" className="rounded-full text-xs">
                      Save Blocked Words
                    </Button>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {tab === "settings" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium">Community Name</Label>
                      <Input
                        value={communityNameEdit}
                        onChange={(e) => setCommunityNameEdit(e.target.value)}
                        className="mt-1 rounded-xl text-sm"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Description</Label>
                      <Textarea
                        value={communityDesc}
                        onChange={(e) => setCommunityDesc(e.target.value)}
                        className="mt-1 rounded-xl text-sm min-h-[80px]"
                        maxLength={500}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/50 p-3">
                      <div>
                        <p className="text-xs font-medium">Private Community</p>
                        <p className="text-[10px] text-muted-foreground">Require approval to join</p>
                      </div>
                      <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                    </div>
                  </div>
                  <Button onClick={saveSettings} disabled={saving} className="rounded-full">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Save Settings
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
