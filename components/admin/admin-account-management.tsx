"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Trash2, Search, AlertTriangle, UserX, Calendar, MessageSquare, Users, Coins, Shield, TrendingUp } from "lucide-react"

interface UserResult {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  email: string | null
  is_admin: boolean
  is_premium: boolean
  is_verified: boolean
  is_team_member: boolean
  is_banned: boolean
  created_at: string
  deletion_executed_at: string | null
  loop_coins: number | null
  followers_count: number | null
  following_count: number | null
  loops_count: number | null
  level: number | null
  reputation_score: number | null
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    })
  } catch {
    return dateStr
  }
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function AdminAccountManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const searchUsers = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSelectedUser(null)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(searchQuery)}&limit=20`, {
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (data.users) {
        setSearchResults(data.users)
      } else {
        setSearchResults([])
        toast({ title: "No results", description: data.error || "No users found" })
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" })
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleDelete = async (userId: string) => {
    setDeletingUserId(userId)
    try {
      const res = await fetch("/api/admin/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: userId, reason: deleteReason || "Admin deletion" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete account")
      toast({ title: "Account deleted", description: data.message })
      setConfirmDeleteId(null)
      setDeleteReason("")
      setSelectedUser(null)
      setSearchResults(prev => prev.filter(u => u.id !== userId))
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <Card className="border-rose-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserX className="h-4 w-4 text-rose-400" /> Account Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username, display name, or email..."
            onKeyDown={(e) => e.key === "Enter" && searchUsers()}
            className="flex-1"
          />
          <Button onClick={searchUsers} disabled={searching} size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Results — compact list */}
        {searchResults.length > 0 && !selectedUser && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} — tap a user to view details</p>
            {searchResults.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className="w-full flex items-center gap-3 rounded-lg border border-border hover:border-primary/30 p-3 text-left transition-colors"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{(u.display_name || u.username || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.display_name || u.username}</p>
                  <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {u.is_admin && <Badge className="text-[9px] px-1.5">Admin</Badge>}
                  {u.is_team_member && <Badge className="text-[9px] px-1.5 bg-blue-500/20 text-blue-400">Team</Badge>}
                  {u.is_premium && <Badge className="text-[9px] px-1.5 bg-amber-500/20 text-amber-400">Pro</Badge>}
                  {u.is_banned && <Badge className="text-[9px] px-1.5 bg-red-500/20 text-red-400">Banned</Badge>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected User — detailed view */}
        {selectedUser && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">{(selectedUser.display_name || selectedUser.username || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-base">{selectedUser.display_name || selectedUser.username}</p>
                  <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                  {selectedUser.email && <p className="text-xs text-muted-foreground mt-0.5">{selectedUser.email}</p>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setConfirmDeleteId(null) }} className="text-xs shrink-0">
                Back to search
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md bg-background/50 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3" />
                  <span className="text-[10px] uppercase tracking-wider">Joined</span>
                </div>
                <p className="text-sm font-medium">{formatDate(selectedUser.created_at)}</p>
                <p className="text-[10px] text-muted-foreground">{daysSince(selectedUser.created_at)} days ago</p>
              </div>
              <div className="rounded-md bg-background/50 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <MessageSquare className="h-3 w-3" />
                  <span className="text-[10px] uppercase tracking-wider">Posts</span>
                </div>
                <p className="text-sm font-medium">{selectedUser.loops_count ?? 0}</p>
              </div>
              <div className="rounded-md bg-background/50 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Users className="h-3 w-3" />
                  <span className="text-[10px] uppercase tracking-wider">Followers</span>
                </div>
                <p className="text-sm font-medium">{selectedUser.followers_count ?? 0}</p>
              </div>
              <div className="rounded-md bg-background/50 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Coins className="h-3 w-3" />
                  <span className="text-[10px] uppercase tracking-wider">Coins</span>
                </div>
                <p className="text-sm font-medium">{selectedUser.loop_coins ?? 0}</p>
              </div>
            </div>

            {/* Role & Status */}
            <div className="flex flex-wrap gap-2">
              {selectedUser.is_admin && <Badge className="bg-red-500/20 text-red-400">Admin</Badge>}
              {selectedUser.is_team_member && <Badge className="bg-blue-500/20 text-blue-400">Team</Badge>}
              {selectedUser.is_premium && <Badge className="bg-amber-500/20 text-amber-400">Pro</Badge>}
              {selectedUser.is_verified && <Badge className="bg-emerald-500/20 text-emerald-400">Verified</Badge>}
              {selectedUser.is_banned && <Badge className="bg-red-500/20 text-red-400">Banned</Badge>}
              {selectedUser.deletion_executed_at && <Badge className="bg-red-500/20 text-red-400">Deletion Scheduled</Badge>}
              <Badge variant="outline">Level {selectedUser.level ?? 1}</Badge>
              <Badge variant="outline">Rep: {selectedUser.reputation_score ?? 0}</Badge>
            </div>

            {/* Delete Action */}
            {confirmDeleteId === selectedUser.id ? (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 space-y-2">
                <p className="text-xs text-rose-300 font-medium">⚠ This action is instant and permanent. The user&apos;s posts will remain as &quot;Deleted Account&quot;.</p>
                <Textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Reason for deletion (optional)"
                  className="h-16 text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(selectedUser.id)}
                    disabled={deletingUserId === selectedUser.id || selectedUser.is_admin}
                  >
                    {deletingUserId === selectedUser.id ? "Deleting..." : "Confirm Permanent Delete"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDeleteId(selectedUser.id)}
                disabled={selectedUser.is_admin}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete Account
              </Button>
            )}
          </div>
        )}

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>Admin deletion is instant and permanent. The user&apos;s posts will show &quot;Deleted Account&quot; but remain visible. Admin accounts cannot be deleted.</p>
        </div>
      </CardContent>
    </Card>
  )
}
