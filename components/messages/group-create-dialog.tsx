"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

import { Spinner } from "@/components/ui/skeletons"
import { Search, X, Users, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface UserResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  is_verified?: boolean
}

interface GroupCreateDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (conversationId: string) => void
}

export function GroupCreateDialog({ open, onClose, onCreated }: GroupCreateDialogProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [step, setStep] = useState<"select" | "details">("select")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [creating, setCreating] = useState(false)

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}&limit=10`, {
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      const users = (data.users || data.results || []).filter(
        (u: UserResult) => u.id !== user?.id && !selectedUsers.some((s) => s.id === u.id),
      )
      setSearchResults(users)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [user?.id, selectedUsers])

  const toggleUser = (u: UserResult) => {
    setSelectedUsers((prev) =>
      prev.some((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u],
    )
    setSearchQuery("")
    setSearchResults([])
  }

  const removeUser = (id: string) => {
    setSelectedUsers((prev) => prev.filter((s) => s.id !== id))
  }

  const createGroup = async () => {
    if (selectedUsers.length < 1) {
      toast({ title: "Add at least one person", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          participant_ids: selectedUsers.map((u) => u.id),
          name: groupName.trim() || null,
          is_group: true,
          type: "group",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create group")

      toast({ title: "Group created" })
      const convId = data.conversation?.id
      if (convId) {
        onCreated?.(convId)
        router.push(`/messages?c=${convId}`)
      }
      resetAndClose()
    } catch (e: any) {
      toast({ title: "Couldn't create group", description: e.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const resetAndClose = () => {
    setStep("select")
    setSearchQuery("")
    setSearchResults([])
    setSelectedUsers([])
    setGroupName("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose() }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {step === "select" ? "New group" : "Group details"}
          </DialogTitle>
        </DialogHeader>

        {step === "select" ? (
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 pl-1.5 pr-1 text-xs font-medium text-primary"
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-[7px]">{(u.display_name || u.username || "?")[0]}</AvatarFallback>
                    </Avatar>
                    {u.display_name || u.username}
                    <button onClick={() => removeUser(u.id)} className="hover:bg-primary/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchUsers(e.target.value)
                }}
                placeholder="Search people to add..."
                className="pl-9 h-9 text-xs"
              />
              {searching && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" />}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-xs font-bold">
                        {(u.display_name || u.username || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{u.display_name || u.username}</p>
                      <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                    </div>
                    <Check className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </div>
            )}

            <Button
              className="w-full rounded-full"
              disabled={selectedUsers.length < 1}
              onClick={() => setStep("details")}
            >
              Next ({selectedUsers.length} selected)
            </Button>
          </div>
        ) : (
          /* Step 2: Group name */
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative h-16 w-16">
                {selectedUsers.slice(0, 3).map((u, i) => (
                  <Avatar
                    key={u.id}
                    className="h-9 w-9 absolute border-2 border-background"
                    style={{ top: i * 8, left: i * 8, zIndex: 3 - i }}
                  >
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px] font-bold">
                      {(u.display_name || u.username || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>

            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value.slice(0, 100))}
              placeholder="Group name (optional)"
              className="h-10 text-center text-sm"
            />

            <p className="text-[11px] text-muted-foreground text-center">
              {selectedUsers.length} member{selectedUsers.length !== 1 ? "s" : ""} will be added
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button className="flex-1 rounded-full" onClick={createGroup} disabled={creating}>
                {creating ? <Spinner className="h-4 w-4" /> : "Create group"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
