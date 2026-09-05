"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { LAYOUT_PRESETS } from "@/lib/community-categories"
import { Loader2, Trash2, Save, ShieldAlert, Palette, Sliders, Users, Star } from "lucide-react"

const FEATURES = [
  { key: "projects", label: "Projects", description: "Collaborative projects with tasks and contributors" },
  { key: "challenges", label: "Challenges", description: "Missions with entries and community voting" },
  { key: "events", label: "Events", description: "Scheduled community events" },
  { key: "chat", label: "Chat", description: "Live chat rooms" },
  { key: "polls", label: "Polls", description: "Posts with community polls" },
  { key: "qa", label: "Q&A", description: "Questions and answers" },
  { key: "gallery", label: "Gallery", description: "Visual showcase space" },
  { key: "memory", label: "Memory", description: "Community archive and milestones" },
  { key: "moments", label: "Moments", description: "Auto-surfaced highlights" },
  { key: "dna", label: "DNA", description: "Behavior-based community DNA" },
  { key: "evolution", label: "Evolution", description: "Activity-based recommendations" },
]

export function WorldSettings({ communityId, bundle, onSaved }: { communityId: string; bundle: any; onSaved: () => void }) {
  const router = useRouter()
  const c = bundle.community || {}
  const [tab, setTab] = useState("general")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [name, setName] = useState<string>(c.name || "")
  const [description, setDescription] = useState<string>(c.description || "")
  const [handle, setHandle] = useState<string>(c.handle || "")
  const [welcome, setWelcome] = useState<string>(c.welcome_message || "")
  const [tags, setTags] = useState<string>((c.tags || []).join(", "))
  const [isPrivate, setIsPrivate] = useState<boolean>(Boolean(c.is_private))
  const [accent, setAccent] = useState<string>(c.accent_color || "#6366f1")
  const [layout, setLayout] = useState<string>(c.layout_preset || "default")
  const [rules, setRules] = useState<string>(Array.isArray(c.rules?.rules) ? (c.rules.rules as string[]).join("\n") : "")
  const [features, setFeatures] = useState<Record<string, boolean>>({ ...(c.enabled_features || {}) })
  const [roles, setRoles] = useState<any[]>(Array.isArray(c.custom_roles) ? c.custom_roles : [])

  const save = async (fields: Record<string, any>) => {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch(`/api/communities/${communityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteCommunity = async () => {
    if (confirmDelete !== c.name) {
      setError("Type the community name to confirm deletion")
      return
    }
    setDeleting(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      router.push("/communities")
    } catch (e: any) {
      setError(e.message)
      setDeleting(false)
    }
  }

  const tabs = [
    { id: "general", label: "General", icon: Sliders },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "features", label: "Features", icon: Star },
    { id: "roles", label: "Roles", icon: Users },
    { id: "danger", label: "Danger Zone", icon: ShieldAlert },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="space-y-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
            } ${t.id === "danger" ? "text-red-500 hover:bg-red-500/10" : ""}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="md:col-span-3">
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        {saved && <p className="mb-3 text-sm text-emerald-500">Saved ✓</p>}

        {/* GENERAL */}
        {tab === "general" && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-bold">General</h3>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-xl" maxLength={100} />
            </div>
            <div>
              <Label>Handle</Label>
              <Input value={handle} onChange={(e) => setHandle(e.target.value)} className="mt-1 rounded-xl" maxLength={40} placeholder="unique-handle" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 rounded-xl" maxLength={2000} />
            </div>
            <div>
              <Label>Welcome message</Label>
              <Input value={welcome} onChange={(e) => setWelcome(e.target.value)} className="mt-1 rounded-xl" maxLength={300} />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Rules (one per line)</Label>
              <Textarea value={rules} onChange={(e) => setRules(e.target.value)} className="mt-1 rounded-xl min-h-[80px]" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Private community</p>
                <p className="text-[11px] text-muted-foreground">New members require approval</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
            <Button className="rounded-full" disabled={saving} onClick={() => save({ name, description, handle, welcome_message: welcome, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), is_private: isPrivate, is_public: !isPrivate, rules: rules.trim() ? { rules: rules.split("\n").filter(Boolean) } : {} })}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />} Save
            </Button>
          </div>
        )}

        {/* APPEARANCE */}
        {tab === "appearance" && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-bold">Appearance</h3>
            <div>
              <Label>Accent color</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-background" />
                <span className="text-xs text-muted-foreground font-mono">{accent}</span>
              </div>
            </div>
            <div>
              <Label>Layout preset</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {LAYOUT_PRESETS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`rounded-xl border p-2.5 text-center transition ${layout === l.id ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:border-indigo-500/40"}`}
                  >
                    <p className="text-xs font-semibold">{l.label}</p>
                  </button>
                ))}
              </div>
            </div>
            <Button className="rounded-full" disabled={saving} onClick={() => save({ accent_color: accent, layout_preset: layout })}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />} Save appearance
            </Button>
          </div>
        )}

        {/* FEATURES */}
        {tab === "features" && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-bold">Enabled features</h3>
            <p className="text-xs text-muted-foreground -mt-2">Toggle what this world supports. Changes apply instantly.</p>
            {FEATURES.map((f) => (
              <div key={f.key} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-[11px] text-muted-foreground">{f.description}</p>
                </div>
                <Switch
                  checked={Boolean(features[f.key])}
                  onCheckedChange={(v) => {
                    const next = { ...features, [f.key]: v }
                    setFeatures(next)
                    save({ enabled_features: next })
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* ROLES */}
        {tab === "roles" && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-bold">Custom roles</h3>
            <p className="text-xs text-muted-foreground -mt-2">
              Recognition-style roles with name, color and permissions. They don't grant admin powers automatically.
            </p>
            <div className="flex gap-2">
              <Input placeholder="New role name (e.g. Curator)" id="new-role-name" className="rounded-xl" />
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => {
                  const input = document.getElementById("new-role-name") as HTMLInputElement
                  if (!input?.value.trim()) return
                  const next = [...roles, { name: input.value.trim(), color: "#8b5cf6", icon: "star", permissions: [] }]
                  setRoles(next)
                  save({ custom_roles: next })
                  input.value = ""
                }}
              >
                Add role
              </Button>
            </div>
            {roles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No custom roles yet.</p>
            ) : (
              <div className="space-y-2">
                {roles.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-border p-3">
                    <span className="h-3 w-3 rounded-full" style={{ background: r.color || "#8b5cf6" }} />
                    <span className="text-sm font-medium flex-1">{r.name}</span>
                    <input
                      type="color"
                      value={r.color || "#8b5cf6"}
                      className="h-7 w-10 cursor-pointer rounded border border-border bg-background"
                      onChange={(e) => {
                        const next = roles.map((x, j) => (j === i ? { ...x, color: e.target.value } : x))
                        setRoles(next)
                      }}
                      onBlur={() => save({ custom_roles: roles })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 text-red-500"
                      onClick={() => {
                        const next = roles.filter((_, j) => j !== i)
                        setRoles(next)
                        save({ custom_roles: next })
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DANGER ZONE */}
        {tab === "danger" && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/[0.03] p-5 space-y-4">
            <h3 className="font-bold text-red-500">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">
              Deleting a community permanently removes its spaces, projects, challenges, memory and posts. Members, posts and
              messages in the wider Loop app are not affected.
            </p>
            <div className="space-y-2">
              <Label>Type <strong>{c.name}</strong> to confirm</Label>
              <Input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className="rounded-xl border-red-500/40" placeholder={c.name} />
            </div>
            <Button variant="destructive" className="rounded-full" disabled={deleting || confirmDelete !== c.name} onClick={deleteCommunity}>
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Permanently delete community
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}