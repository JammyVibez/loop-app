"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Users, RefreshCw, Save, ChevronDown, ChevronUp } from "lucide-react"

interface TeamMember {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  email: string | null
  is_team_member: boolean
  created_at: string
  permissions: string[]
}

interface PermissionDef {
  key: string
  label: string
  description: string
}

export function AdminTeamPermissions() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [availablePerms, setAvailablePerms] = useState<PermissionDef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string[]>>({})
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/team-permissions", {
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (data.members) {
        setMembers(data.members)
        setAvailablePerms(data.available_permissions || [])
        // Initialize edits with current permissions
        const init: Record<string, string[]> = {}
        for (const m of data.members) {
          init[m.id] = [...m.permissions]
        }
        setEdits(init)
      }
    } catch (err: any) {
      toast({ title: "Failed to load", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const togglePermission = (userId: string, permKey: string) => {
    setEdits(prev => {
      const current = prev[userId] || []
      const updated = current.includes(permKey)
        ? current.filter(k => k !== permKey)
        : [...current, permKey]
      return { ...prev, [userId]: updated }
    })
  }

  const savePermissions = async (userId: string) => {
    setSaving(userId)
    try {
      const res = await fetch("/api/admin/team-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: userId, permissions: edits[userId] || [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "Permissions saved", description: data.message })
      // Update local state
      setMembers(prev => prev.map(m =>
        m.id === userId ? { ...m, permissions: edits[userId] || [] } : m
      ))
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  const hasChanges = (userId: string) => {
    const original = members.find(m => m.id === userId)?.permissions || []
    const current = edits[userId] || []
    return JSON.stringify([...original].sort()) !== JSON.stringify([...current].sort())
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-blue-400" /> Team Permissions
          <Badge variant="outline" className="ml-auto">{members.length} member{members.length !== 1 ? "s" : ""}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Assign specific dashboard sections to each team member. They will only see the sections you grant.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No team members found. Grant &quot;Team&quot; role to users from the Members tab first.
          </p>
        ) : (
          members.map((member) => {
            const expanded = expandedId === member.id
            const changed = hasChanges(member.id)
            const perms = edits[member.id] || []

            return (
              <div key={member.id} className="rounded-lg border border-border overflow-hidden">
                {/* Member Header */}
                <button
                  onClick={() => setExpandedId(expanded ? null : member.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {(member.display_name || member.username || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{member.display_name || member.username}</p>
                    <p className="text-xs text-muted-foreground">@{member.username}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{perms.length} section{perms.length !== 1 ? "s" : ""}</Badge>
                    {changed && <Badge className="text-[10px] bg-amber-500/20 text-amber-400">Unsaved</Badge>}
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Permissions Editor */}
                {expanded && (
                  <div className="border-t border-border p-3 space-y-3 bg-muted/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availablePerms.map((perm) => (
                        <label
                          key={perm.key}
                          className="flex items-start gap-2.5 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                          <Checkbox
                            checked={perms.includes(perm.key)}
                            onCheckedChange={() => togglePermission(member.id, perm.key)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">{perm.label}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{perm.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => savePermissions(member.id)}
                        disabled={saving === member.id || !changed}
                      >
                        {saving === member.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Save Permissions
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
