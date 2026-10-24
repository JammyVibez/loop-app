"use client"

import { useCallback, useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/skeletons"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Check, Loader2, Lock, Trash2, X } from "lucide-react"

export interface EditableCommunity {
  id: string
  name: string
  description?: string | null
  is_private?: boolean | null
}

/** Edit a community's name, description and privacy (owners/admins only). */
export function EditCommunityDialog({
  community,
  open,
  onOpenChange,
  onSaved,
}: {
  community: EditableCommunity
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description || "")
  const [isPrivate, setIsPrivate] = useState(Boolean(community.is_private))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(community.name)
    setDescription(community.description || "")
    setIsPrivate(Boolean(community.is_private))
  }, [open, community.name, community.description, community.is_private])

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "A name is required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/communities/${community.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          is_private: isPrivate,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to save")
      toast({ title: "Community updated" })
      onOpenChange(false)
      onSaved()
    } catch (error: any) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit community</DialogTitle>
          <DialogDescription>Only owners and admins can change these.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="community-name" className="text-xs font-medium">Name</Label>
            <Input
              id="community-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="community-description" className="text-xs font-medium">Description</Label>
            <Textarea
              id="community-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none rounded-xl text-sm"
              placeholder="What is this community about?"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsPrivate((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-muted/40"
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isPrivate ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>
              <Lock className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Private community</span>
              <span className="block text-xs text-muted-foreground">
                {isPrivate ? "Only members can see the discussions." : "Anyone can read the discussions."}
              </span>
            </span>
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isPrivate ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${isPrivate ? "left-[18px]" : "left-0.5"}`}
              />
            </span>
          </button>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Delete the whole community (owner/admin only). */
export function DeleteCommunityDialog({
  community,
  open,
  onOpenChange,
  onDeleted,
}: {
  community: EditableCommunity
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/communities/${community.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not delete")
      toast({ title: "Community deleted" })
      onOpenChange(false)
      onDeleted()
    } catch (error: any) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{community.name}”?</DialogTitle>
          <DialogDescription>
            This removes the community and everything in it — threads, replies, roles, members and events. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="rounded-full"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            Delete community
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface MemberRow {
  user_id: string
  role: string
  status: string
  user?: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
  } | null
}

/** Approve join requests and remove members. */
export function ManageMembersDialog({
  communityId,
  open,
  onOpenChange,
  onChanged,
}: {
  communityId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/members?limit=100`, {
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load members")
      setMembers(Array.isArray(data.members) ? data.members : [])
    } catch (error: any) {
      toast({ title: "Could not load members", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [communityId, getAuthHeader, toast])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const act = async (member: MemberRow, action: "approve" | "reject" | "remove") => {
    setBusy(`${member.user_id}:${action}`)
    try {
      const res =
        action === "remove"
          ? await fetch(`/api/communities/${communityId}/members?user_id=${member.user_id}`, {
              method: "DELETE",
              headers: getAuthHeader(),
            })
          : await fetch(`/api/communities/${communityId}/members`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", ...getAuthHeader() },
              body: JSON.stringify({
                user_id: member.user_id,
                status: action === "approve" ? "active" : "rejected",
              }),
            })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Action failed")
      setMembers((prev) =>
        action === "remove"
          ? prev.filter((m) => m.user_id !== member.user_id)
          : prev.map((m) =>
              m.user_id === member.user_id
                ? { ...m, status: action === "approve" ? "active" : "rejected" }
                : m,
            ),
      )
      toast({ title: action === "approve" ? "Member approved" : action === "reject" ? "Request declined" : "Member removed" })
      onChanged()
    } catch (error: any) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const pending = members.filter((m) => m.status !== "active" && m.status !== "approved")
  const active = members.filter((m) => m.status === "active" || m.status === "approved")

  const row = (member: MemberRow, isPending: boolean) => (
    <li key={member.user_id} className="flex items-center gap-2.5 py-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={member.user?.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {(member.user?.display_name || member.user?.username || "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.user?.display_name || member.user?.username || "Member"}</p>
        <p className="truncate text-xs text-muted-foreground">
          @{member.user?.username || member.user_id.slice(0, 8)} · {member.role}
        </p>
      </div>
      {isPending ? (
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            className="h-7 rounded-full px-2.5 text-xs"
            disabled={busy === `${member.user_id}:approve`}
            onClick={() => void act(member, "approve")}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-2.5 text-xs"
            disabled={busy === `${member.user_id}:reject`}
            onClick={() => void act(member, "reject")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 rounded-full px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={member.role === "owner" || busy === `${member.user_id}:remove`}
          onClick={() => void act(member, "remove")}
        >
          Remove
        </Button>
      )}
    </li>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>Approve join requests and remove people from the community.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner className="h-5 w-5" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            {pending.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Requests · {pending.length}
                </h4>
                <ul className="mt-1 divide-y divide-border/60">{pending.map((m) => row(m, true))}</ul>
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Members · {active.length}
              </h4>
              {active.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <ul className="mt-1 divide-y divide-border/60">{active.map((m) => row(m, false))}</ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
