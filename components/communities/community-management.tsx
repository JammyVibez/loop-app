"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/skeletons"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { DeviceMediaPicker, type PickedMedia } from "@/components/communities/device-media-picker"
import { WorldMembers } from "@/components/communities/world-members"
import { WorldModeration } from "@/components/communities/world-moderation"
import { WorldPowers } from "@/components/communities/world-powers"
import { WorldSpaces } from "@/components/communities/world-spaces"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Check,
  Layers,
  Save,
  Settings2,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react"

type Section = "general" | "members" | "moderation" | "topics" | "powers" | "danger"

/**
 * The community management panel.
 *
 * One settings button for authorized admins opens everything, replacing the
 * old permanent Settings / Moderation / Powers tabs. Every section is still
 * gated server-side by the APIs it calls — hiding a section here is never the
 * only guard.
 */
export function CommunityManagement({
  open,
  onOpenChange,
  communityId,
  bundle,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  bundle: any
  onSaved: () => void
}) {
  const router = useRouter()
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const c = bundle?.community || {}
  const isAdmin = Boolean(bundle?.is_admin)
  const isOwner = Boolean(bundle?.is_owner)
  const isModerator = Boolean(bundle?.is_moderator)
  const spaces = (bundle?.spaces || []).filter((s: any) => !s.is_archived)

  const [section, setSection] = useState<Section>("general")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // General
  const [name, setName] = useState(c.name || "")
  const [handle, setHandle] = useState(c.handle || "")
  const [description, setDescription] = useState(c.description || "")
  const [welcome, setWelcome] = useState(c.welcome_message || "")
  const [guidelines, setGuidelines] = useState(
    Array.isArray(c.rules?.rules) ? (c.rules.rules as string[]).join("\n") : "",
  )
  const [tags, setTags] = useState<string>((c.tags || []).join(", "))
  const [accent, setAccent] = useState(c.accent_color || "#6366f1")
  const [isPrivate, setIsPrivate] = useState(Boolean(c.is_private))
  const [avatar, setAvatar] = useState<PickedMedia[]>(c.avatar_url ? [{ url: c.avatar_url, kind: "image" }] : [])
  const [banner, setBanner] = useState<PickedMedia[]>(c.banner_url ? [{ url: c.banner_url, kind: "image" }] : [])
  const [features, setFeatures] = useState<Record<string, boolean>>({ ...(c.enabled_features || {}) })

  // Danger
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSection("general")
    setError("")
    setConfirmName("")
  }, [open])

  const save = async (fields: Record<string, unknown>, message = "Community updated") => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      toast({ title: message })
      onSaved()
    } catch (e: any) {
      setError(e.message)
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const saveGeneral = () => {
    if (name.trim().length < 3) {
      setError("Give the community a name")
      return
    }
    void save({
      name: name.trim(),
      handle: handle.trim() || undefined,
      description: description.trim(),
      welcome_message: welcome.trim(),
      is_private: isPrivate,
      is_public: !isPrivate,
      accent_color: accent,
      avatar_url: avatar[0]?.url || null,
      banner_url: banner[0]?.url || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      rules: guidelines.trim() ? { rules: guidelines.split("\n").map((r) => r.trim()).filter(Boolean) } : {},
    })
  }

  const deleteCommunity = async () => {
    if (confirmName.trim() !== (c.name || "")) {
      setError("Type the community name exactly to confirm")
      return
    }
    if (
      !(await confirmDialog({
        title: "Delete this community?",
        description: "Discussions, members and settings are removed. This cannot be undone.",
        confirmLabel: "Delete community",
        destructive: true,
      }))
    )
      return
    setDeleting(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}`, { method: "DELETE", headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      router.push("/communities")
    } catch (e: any) {
      setError(e.message)
      setDeleting(false)
    }
  }

  const sections: Array<{ id: Section; label: string; icon: any; show: boolean }> = [
    { id: "general", label: "General", icon: Sliders, show: isAdmin },
    { id: "members", label: "Members", icon: Users, show: isModerator },
    { id: "moderation", label: "Moderation", icon: Shield, show: isModerator },
    { id: "topics", label: "Topics", icon: Layers, show: isAdmin },
    { id: "powers", label: "Powers", icon: Sparkles, show: isAdmin },
    { id: "danger", label: "Danger zone", icon: AlertTriangle, show: isOwner },
  ]
  const visible = sections.filter((s) => s.show)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Manage {c.name || "community"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Only community admins see this panel, and every action is checked again by the server.
          </p>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Section rail */}
          <nav className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 sm:w-48 sm:shrink-0 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:py-4">
            {visible.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                  section === s.id
                    ? "bg-foreground text-background"
                    : s.id === "danger"
                      ? "text-rose-500 hover:bg-rose-500/10"
                      : "text-muted-foreground hover:bg-muted",
                )}
              >
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </button>
            ))}
          </nav>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {error ? (
              <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                {error}
              </p>
            ) : null}

            {section === "general" && isAdmin ? (
              <div className="max-w-2xl space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Handle</Label>
                    <Input
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      maxLength={40}
                      placeholder="unique-handle"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <Label>Purpose / description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={600}
                    placeholder="What is this community for?"
                    className="mt-1.5 resize-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Community image</Label>
                    <div className="mt-1.5">
                      <DeviceMediaPicker items={avatar} onChange={setAvatar} maxItems={1} accept="image/*" folder="community-avatar" />
                    </div>
                  </div>
                  <div>
                    <Label>Banner</Label>
                    <div className="mt-1.5">
                      <DeviceMediaPicker items={banner} onChange={setBanner} maxItems={1} accept="image/*" folder="community-banner" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Pinned welcome</Label>
                  <Textarea
                    value={welcome}
                    onChange={(e) => setWelcome(e.target.value)}
                    rows={2}
                    maxLength={600}
                    placeholder="A short welcome shown at the top of the community"
                    className="mt-1.5 resize-none"
                  />
                </div>

                <div>
                  <Label>Guidelines (one per line)</Label>
                  <Textarea
                    value={guidelines}
                    onChange={(e) => setGuidelines(e.target.value)}
                    rows={4}
                    placeholder={"Be kind\nStay on topic"}
                    className="mt-1.5 resize-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Tags</Label>
                    <Input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="design, music"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Accent colour</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-background"
                      />
                      <span className="font-mono text-xs text-muted-foreground">{accent}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <div>
                    <p className="text-sm font-medium">Private community</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Join requests are approved by the team, and nothing here can be shared to the Loop feed.
                    </p>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>

                <div>
                  <p className="text-sm font-semibold">Features</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Turn optional surfaces on or off. Off surfaces leave the community entirely.
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[
                      { key: "chat", label: "Chat" },
                      { key: "events", label: "Events" },
                      { key: "projects", label: "Projects" },
                      { key: "challenges", label: "Challenges" },
                      { key: "memory", label: "Memory" },
                    ].map((f) => (
                      <label
                        key={f.key}
                        className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5"
                      >
                        <span className="text-xs font-medium">{f.label}</span>
                        <Switch
                          checked={features[f.key] !== false}
                          onCheckedChange={(v) => {
                            const next = { ...features, [f.key]: v }
                            setFeatures(next)
                            void save({ enabled_features: next }, `${f.label} ${v ? "enabled" : "disabled"}`)
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <Button className="rounded-full" onClick={saveGeneral} disabled={saving}>
                  {saving ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                  Save changes
                </Button>
              </div>
            ) : null}

            {section === "members" && isModerator ? (
              <WorldMembers
                communityId={communityId}
                initial={bundle?.recent_members || []}
                viewerRole={bundle?.role}
                viewerId={bundle?.viewer}
                powers={bundle?.powers || []}
                powerAssignments={bundle?.power_assignments || {}}
                onOpenPowers={() => setSection("powers")}
              />
            ) : null}

            {section === "moderation" && isModerator ? <WorldModeration communityId={communityId} /> : null}

            {section === "topics" && isAdmin ? (
              <WorldSpaces communityId={communityId} spaces={spaces} canModerate onChanged={onSaved} />
            ) : null}

            {section === "powers" && isAdmin ? <WorldPowers communityId={communityId} canManageHint /> : null}

            {section === "danger" && isOwner ? (
              <div className="max-w-xl space-y-4">
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.03] p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
                    <Trash2 className="h-4 w-4" /> Delete this community
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    All discussions, replies, members and settings are removed permanently. Type the community name to
                    confirm.
                  </p>
                  <Input
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={c.name || ""}
                    className="mt-3"
                  />
                  <Button
                    variant="destructive"
                    className="mt-3 rounded-full"
                    disabled={deleting || confirmName.trim() !== (c.name || "")}
                    onClick={() => void deleteCommunity()}
                  >
                    {deleting ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                    Delete community
                  </Button>
                </div>
              </div>
            ) : null}

            {!visible.some((s) => s.id === section && s.show) ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-emerald-500" /> Nothing to manage here.
              </p>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
