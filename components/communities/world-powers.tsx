"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ComponentType } from "react"
import {
  Compass,
  Crown,
  Hammer,
  Leaf,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Shield,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { POWER_COLORS, POWER_GROUPS, POWER_ICONS } from "@/lib/community-permissions"

const ICONS: Record<string, ComponentType<{ className?: string; style?: any }>> = {
  shield: Shield,
  star: Star,
  sparkles: Sparkles,
  hammer: Hammer,
  palette: Palette,
  compass: Compass,
  leaf: Leaf,
  crown: Crown,
}

export function PowerIcon({ icon, className, style }: { icon?: string | null; className?: string; style?: any }) {
  const Icon = ICONS[icon || "shield"] || Shield
  return <Icon className={className} style={style} />
}

export interface PowerRecord {
  id: number
  name: string
  description?: string | null
  color: string
  icon?: string | null
  permissions: string[]
  priority?: number
  is_default?: boolean
  member_count?: number
}

/** Small, flat chip — used in the panel and on member rows. */
export function PowerChip({ power, onRemove }: { power: PowerRecord; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ borderColor: `${power.color}55`, color: power.color, background: `${power.color}14` }}
    >
      <PowerIcon icon={power.icon} className="h-3 w-3" />
      {power.name}
      {onRemove ? (
        <button type="button" onClick={onRemove} className="ml-0.5 opacity-60 transition-opacity hover:opacity-100">
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </span>
  )
}

/** Human summary of what a Power actually grants. */
function permissionSummary(keys: string[]) {
  const labels: string[] = []
  for (const group of POWER_GROUPS) {
    for (const item of group.items) if (keys.includes(item.key)) labels.push(item.label)
  }
  return labels
}

export function WorldPowers({ communityId, canManageHint }: { communityId: string; canManageHint?: boolean }) {
  const { toast } = useToast()
  const [powers, setPowers] = useState<PowerRecord[]>([])
  const [byUser, setByUser] = useState<Record<string, number[]>>({})
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [canAssign, setCanAssign] = useState(Boolean(canManageHint))
  const [editing, setEditing] = useState<PowerRecord | "new" | null>(null)
  const [assigningFor, setAssigningFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, membersRes] = await Promise.all([
        fetch(`/api/communities/${communityId}/roles`, { cache: "no-store" }),
        fetch(`/api/communities/${communityId}/members?limit=100`, { cache: "no-store" }),
      ])
      const rolesData = await rolesRes.json()
      if (rolesRes.ok) {
        setPowers(rolesData.roles || [])
        setByUser(rolesData.by_user || {})
        setCanAssign(Boolean(rolesData.can_assign))
      }
      const membersData = await membersRes.json()
      if (membersRes.ok) setMembers(membersData.members || [])
    } catch (e: any) {
      toast({ title: "Couldn't load Powers", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [communityId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const powerById = useMemo(() => new Map(powers.map((p) => [p.id, p])), [powers])

  const assign = async (userId: string, roleId: number, action: "assign" | "revoke") => {
    try {
      const res = await fetch(`/api/communities/${communityId}/roles/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role_id: roleId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      await load()
    } catch (e: any) {
      toast({ title: "Couldn't change that Power", description: e.message, variant: "destructive" })
    }
  }

  const removePower = async (power: PowerRecord) => {
    try {
      const res = await fetch(`/api/communities/${communityId}/roles?id=${power.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast({ title: `"${power.name}" deleted` })
      await load()
    } catch (e: any) {
      toast({ title: "Couldn't delete that Power", description: e.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight">Powers</h1>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            What members can do here. Anyone can hold several at once — a Power is a capability, not a rank badge.
          </p>
        </div>
        {canAssign ? (
          <Button size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={() => setEditing("new")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Power
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Powers */}
          <div className="space-y-3 lg:col-span-2">
            {powers.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-xs text-muted-foreground">
                No Powers yet. {canAssign ? "Create the first one." : "An admin can set these up."}
              </p>
            ) : (
              powers.map((p) => {
                const labels = permissionSummary(p.permissions)
                const holders = Object.entries(byUser).filter(([, ids]) => ids.includes(p.id))
                return (
                  <div key={p.id} className="rounded-2xl border border-border bg-card">
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                        style={{ borderColor: `${p.color}44`, background: `${p.color}14`, color: p.color }}
                      >
                        <PowerIcon icon={p.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-semibold text-foreground">{p.name}</h2>
                          {p.is_default ? (
                            <span className="rounded border border-border bg-muted px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                              Everyone
                            </span>
                          ) : null}
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {holders.length} {holders.length === 1 ? "member" : "members"}
                          </span>
                        </div>
                        {p.description ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {labels.slice(0, 4).map((l) => (
                            <span
                              key={l}
                              className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {l}
                            </span>
                          ))}
                          {labels.length > 4 ? (
                            <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{labels.length - 4}
                            </span>
                          ) : null}
                          {labels.length === 0 ? (
                            <span className="text-[10px] italic text-muted-foreground">No abilities yet</span>
                          ) : null}
                        </div>
                      </div>

                      {canAssign ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => setEditing(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => void removePower(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {holders.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5">
                        <div className="flex -space-x-1.5">
                          {holders.slice(0, 8).map(([userId]) => {
                            const m = members.find((x) => x.user_id === userId)
                            return (
                              <Avatar key={userId} className="h-6 w-6 ring-2 ring-card">
                                <AvatarImage src={m?.user?.avatar_url || ""} alt="" />
                                <AvatarFallback className="text-[9px]">
                                  {(m?.user?.display_name || m?.user?.username || "?").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )
                          })}
                        </div>
                        {holders.length > 8 ? (
                          <span className="text-[10px] text-muted-foreground">+{holders.length - 8}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>

          {/* Members */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Who holds what</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Tap a member to hand out or take back a Power.</p>
            </div>
            <div className="divide-y divide-border/60">
              {members.slice(0, 25).map((m) => {
                const held = (byUser[m.user_id] || []).map((id) => powerById.get(id)).filter(Boolean) as PowerRecord[]
                return (
                  <div key={m.user_id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={m.user?.avatar_url || ""} alt="" />
                        <AvatarFallback className="text-[10px]">
                          {(m.user?.display_name || m.user?.username || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {m.user?.display_name || m.user?.username}
                        </p>
                        {["owner", "admin", "moderator"].includes(m.role) ? (
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.role}</p>
                        ) : null}
                      </div>
                      {canAssign ? (
                        <button
                          type="button"
                          title="Give a Power"
                          onClick={() => setAssigningFor(assigningFor === m.user_id ? null : m.user_id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>

                    {held.length > 0 || assigningFor === m.user_id ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {held.map((p) => (
                          <PowerChip
                            key={p.id}
                            power={p}
                            onRemove={canAssign ? () => void assign(m.user_id, p.id, "revoke") : undefined}
                          />
                        ))}
                        {assigningFor === m.user_id
                          ? powers
                              .filter((p) => !held.some((h) => h.id === p.id))
                              .map((p) => (
                                <button key={p.id} type="button" onClick={() => void assign(m.user_id, p.id, "assign")}>
                                  <PowerChip power={{ ...p, color: "#64748b" }} />
                                </button>
                              ))
                          : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
              {members.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">No members yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {editing ? (
        <PowerEditor
          power={editing === "new" ? null : editing}
          communityId={communityId}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      ) : null}
    </div>
  )
}

/** Create or edit one Power. */
function PowerEditor({
  power,
  communityId,
  onClose,
  onSaved,
}: {
  power: PowerRecord | null
  communityId: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const { toast } = useToast()
  const [name, setName] = useState(power?.name || "")
  const [description, setDescription] = useState(power?.description || "")
  const [color, setColor] = useState(power?.color || POWER_COLORS[0])
  const [icon, setIcon] = useState(power?.icon || POWER_ICONS[0])
  const [permissions, setPermissions] = useState<string[]>(power?.permissions || [])
  const [isDefault, setIsDefault] = useState(Boolean(power?.is_default))
  const [saving, setSaving] = useState(false)

  const toggle = (key: string) =>
    setPermissions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const save = async () => {
    if (name.trim().length < 2) {
      toast({ title: "Give the Power a name", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/roles`, {
        method: power ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(power ? { id: power.id } : {}),
          name: name.trim(),
          description: description.trim(),
          color,
          icon,
          permissions,
          is_default: isDefault,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      toast({ title: power ? "Power updated" : `"${name.trim()}" created` })
      await onSaved()
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{power ? "Edit Power" : "New Power"}</DialogTitle>
          <DialogDescription>
            Name it after what people actually do here, then tick exactly the abilities it grants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Workshop lead"
                maxLength={32}
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">What it is for</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional, shown to members"
                maxLength={240}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Colour</label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {POWER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    color === c ? "border-foreground" : "border-transparent hover:scale-105",
                  )}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <span className="ml-1 flex items-center gap-1">
                {POWER_ICONS.slice(0, 6).map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg border transition-colors",
                      icon === i ? "border-foreground/40 bg-muted text-foreground" : "border-border text-muted-foreground",
                    )}
                    aria-label={i}
                  >
                    <PowerIcon icon={i} className="h-3.5 w-3.5" />
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-foreground">Give it to everyone</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Every member gets this automatically, including people who join later.
              </p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <div className="space-y-3">
            {POWER_GROUPS.map((group) => (
              <div key={group.group} className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border/60 bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.group}</p>
                  <p className="text-[10px] text-muted-foreground/80">{group.hint}</p>
                </div>
                <div className="divide-y divide-border/60">
                  {group.items.map((item) => {
                    const on = permissions.includes(item.key)
                    return (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
                      >
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-foreground">{item.label}</span>
                          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                            {item.hint}
                          </span>
                        </span>
                        <Switch checked={on} onCheckedChange={() => toggle(item.key)} />
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {power ? "Save Power" : "Create Power"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
