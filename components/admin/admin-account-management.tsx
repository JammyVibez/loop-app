"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Trash2, Search, AlertTriangle, UserX } from "lucide-react"

export function AdminAccountManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const searchUsers = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(searchQuery)}`, {
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (data.users) {
        setSearchResults(data.users.slice(0, 10))
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" })
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
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username or email..."
            onKeyDown={(e) => e.key === "Enter" && searchUsers()}
            className="flex-1"
          />
          <Button onClick={searchUsers} disabled={searching} size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                    {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.display_name || u.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                  {u.is_admin && <Badge className="text-[10px]">Admin</Badge>}
                  {u.is_premium && <Badge className="text-[10px] bg-amber-500/20 text-amber-400">Pro</Badge>}
                </div>

                {confirmDeleteId === u.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Textarea
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="h-8 w-32 text-xs resize-none"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(u.id)}
                      disabled={deletingUserId === u.id || u.is_admin}
                    >
                      {deletingUserId === u.id ? "..." : "Confirm"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDeleteId(u.id)}
                    disabled={u.is_admin}
                    className="shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
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
