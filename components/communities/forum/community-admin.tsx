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
import { uploadMediaFile } from "@/lib/client-media-upload"
import { POLICY_LABELS, POLICY_ROLES } from "@/lib/community-policy"
import { Check, ImagePlus, Loader2, Lock, Trash2, X } from "lucide-react"

export interface EditableCommunity {
  id: string
  name: string
  description?: string | null
  is_private?: boolean | null
  banner_url?: string | null
  cover_url?: string | null
  moderation_settings?: Record<string, any> | null
}

/** Edit a community's name, description, artwork and privacy (owners/admins only). */
export function EditCommunityDialog({
  community,
  open,
  onOpenChange,
  onSaved,
  onRequestDelete,
}: {
  community: EditableCommunity
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  /** Opens the delete confirmation; omitted when the viewer cannot delete. */
  onRequestDelete?: () => void
}) {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description || "")
  const [isPrivate, setIsPrivate] = useState(Boolean(community.is_private))
  const [bannerUrl, setBannerUrl] = useState(community.banner_url || "")
  const [coverUrl, setCoverUrl] = useState(community.cover_url || "")
  const [uploading, setUploading] = useState<"banner" | "cover" | null>(null)
  const [commentRoles, setCommentRoles] = useState<string[]>([])
  const [visibleRoles, setVisibleRoles] = useState<string[]>([])
  const [mentionRoles, setMentionRoles] = useState<string[]>([])
  const [mentionableRoles, setMentionableRoles] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(community.name)
    setDescription(community.description || "")
    setIsPrivate(Boolean(community.is_private))
    setBannerUrl(community.banner_url || "")
    setCoverUrl(community.cover_url || "")
    const settings = community.moderation_settings || {}
    setCommentRoles(Array.isArray(settings.comment_roles) ? settings.comment_roles : [])
    setVisibleRoles(Array.isArray(settings.visible_roles) ? settings.visible_roles : [])
    setMentionRoles(Array.isArray(settings.mention_roles) ? settings.mention_roles : [])
    setMentionableRoles(Array.isArray(settings.mentionable_roles) ? settings.mentionable_roles : [])
  }, [
    open,
    community.name,
    community.description,
    community.is_private,
    community.banner_url,
    community.cover_url,
    community.moderation_settings,
  ])

  const upload = async (kind: "banner" | "cover", file?: File | null) => {
    if (!file) return
    setUploading(kind)
    try {
      const { url } = await uploadMediaFile(file, {
        type: "image",
        folder: "communities",
        authHeaders: getAuthHeader(),
        maxSizeBytes: 10 * 1024 * 1024,
      })
      if (kind === "banner") setBannerUrl(url)
      else setCoverUrl(url)
      toast({ title: `${kind === "banner" ? "Banner" : "Cover"} ready`, description: "Save changes to apply it." })
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" })
    } finally {
      setUploading(null)
    }
  }

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
          banner_url: bannerUrl || null,
          cover_url: coverUrl || null,
          // Merged, because PATCH replaces this object wholesale.
          moderation_settings: {
            ...(community.moderation_settings || {}),
            comment_roles: commentRoles.length ? commentRoles : null,
            visible_roles: visibleRoles.length ? visibleRoles : null,
            mention_roles: mentionRoles.length ? mentionRoles : null,
            mentionable_roles: mentionableRoles.length ? mentionableRoles : null,
          },
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
      {/* Scrolls inside the viewport: the panel carries artwork, four role
          lists and a danger zone now, and must not overflow on a phone. */}
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto sm:w-auto">
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
          {([
            {
              id: "banner" as const,
              label: "Banner",
              hint: "Wide image across the top of the community.",
              value: bannerUrl,
              set: setBannerUrl,
            },
            {
              id: "cover" as const,
              label: "Cover",
              hint: "Behind the community header.",
              value: coverUrl,
              set: setCoverUrl,
            },
          ]).map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label className="text-xs font-medium">{field.label}</Label>
              <div className="flex items-center gap-2">
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  {field.value ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={field.value} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                  <div className="mt-1 flex gap-1.5">
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted/60">
                      {uploading === field.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3 w-3" />
                      )}
                      {field.value ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          void upload(field.id, e.target.files?.[0])
                          e.currentTarget.value = ""
                        }}
                      />
                    </label>
                    {field.value && (
                      <button
                        type="button"
                        onClick={() => field.set("")}
                        className="rounded-full px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

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
          {([
            {
              id: "comment" as const,
              label: "Who can comment",
              hint: "Leave empty for every member. Staff always keep their voice.",
              value: commentRoles,
              set: setCommentRoles,
            },
            {
              id: "visible" as const,
              label: "Who can see threads",
              hint: "Leave empty for everyone who can reach the community.",
              value: visibleRoles,
              set: setVisibleRoles,
            },
            {
              id: "mention" as const,
              label: "Who can @mention",
              hint: "Leave empty to let every commenter tag people and roles.",
              value: mentionRoles,
              set: setMentionRoles,
            },
            {
              id: "mentionable" as const,
              label: "Roles that can be tagged",
              hint: "Leave empty to let every role be mentioned.",
              value: mentionableRoles,
              set: setMentionableRoles,
            },
          ]).map((group) => (
            <div key={group.id} className="space-y-1.5">
              <Label className="text-xs font-medium">{group.label}</Label>
              <div className="flex flex-wrap gap-1.5">
                {POLICY_ROLES.map((role) => {
                  const on = group.value.includes(role)
                  return (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        group.set(on ? group.value.filter((r) => r !== role) : [...group.value, role])
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        on
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {POLICY_LABELS[role]}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">{group.hint}</p>
            </div>
          ))}

          {onRequestDelete && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-bold text-destructive">Danger zone</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Deleting removes every thread, reply, role and member. It cannot be undone.
              </p>
              <Button
                size="sm"
                variant="destructive"
                className="mt-2 h-7 rounded-full px-3 text-xs"
                onClick={() => {
                  onOpenChange(false)
                  onRequestDelete()
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete community
              </Button>
            </div>
          )}

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
