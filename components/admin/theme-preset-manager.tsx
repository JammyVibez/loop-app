"use client"

/**
 * ThemePresetManager
 *
 * Platform admin UI for managing the Circle theme preset catalog.
 * Admins add/edit/delete presets through token value forms, not code.
 */

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import {
  Plus,
  Pencil,
  Trash2,
  Palette,
  GripVertical,
} from "lucide-react"
import type {
  CircleThemeConfig,
  ThemeColors,
  ThemeTypography,
  ThemeLayout,
  ThemeBanner,
} from "@/lib/circle-themes"
import {
  ALLOWED_FONTS,
  LAYOUT_TEMPLATES,
  BANNER_SHAPES,
  getDefaultTheme,
} from "@/lib/circle-themes"

interface Preset {
  id: string
  name: string
  description: string | null
  theme_config: CircleThemeConfig
  is_system: boolean
  is_active: boolean
  sort_order: number
  preview_url: string | null
}

const emptyConfig = getDefaultTheme()

export function ThemePresetManager() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formConfig, setFormConfig] = useState<CircleThemeConfig>(structuredClone(emptyConfig))
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const loadPresets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/theme-presets?all=true")
      const data = await res.json()
      if (data.success) setPresets(data.presets)
    } catch {
      toast({ title: "Couldn't load presets", variant: "error" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  const openCreate = () => {
    setEditingPreset(null)
    setFormName("")
    setFormDesc("")
    setFormConfig(structuredClone(emptyConfig))
    setShowEditor(true)
  }

  const openEdit = (preset: Preset) => {
    setEditingPreset(preset)
    setFormName(preset.name)
    setFormDesc(preset.description || "")
    setFormConfig(structuredClone(preset.theme_config))
    setShowEditor(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "warning" })
      return
    }
    setSaving(true)
    try {
      const isEdit = !!editingPreset
      const url = "/api/admin/theme-presets"
      const method = isEdit ? "PUT" : "POST"
      const body = isEdit
        ? { id: editingPreset!.id, name: formName, description: formDesc, theme_config: formConfig }
        : { name: formName, description: formDesc, theme_config: formConfig }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: isEdit ? "Preset updated" : "Preset created", variant: "success" })
        setShowEditor(false)
        loadPresets()
      } else {
        toast({ title: "Couldn't save", description: data.error, variant: "error" })
      }
    } catch {
      toast({ title: "Couldn't save preset", variant: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (preset: Preset) => {
    try {
      const res = await fetch("/api/admin/theme-presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preset.id, is_active: !preset.is_active }),
      })
      const data = await res.json()
      if (data.success) loadPresets()
    } catch {
      toast({ title: "Couldn't update", variant: "error" })
    }
  }

  const handleDelete = async (preset: Preset) => {
    if (
      !(await confirmDialog({
        title: `Deactivate "${preset.name}"?`,
        description: "It stays in the catalog but stops being offered. Nothing already using it changes.",
        confirmLabel: "Deactivate",
        destructive: true,
      }))
    )
      return
    try {
      const res = await fetch(`/api/admin/theme-presets?id=${preset.id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Preset deactivated", variant: "success" })
        loadPresets()
      }
    } catch {
      toast({ title: "Couldn't delete", variant: "error" })
    }
  }

  const updateColors = (patch: Partial<ThemeColors>) =>
    setFormConfig((c) => ({ ...c, colors: { ...c.colors, ...patch } }))
  const updateTypography = (patch: Partial<ThemeTypography>) =>
    setFormConfig((c) => ({ ...c, typography: { ...c.typography, ...patch } }))
  const updateLayout = (patch: Partial<ThemeLayout>) =>
    setFormConfig((c) => ({ ...c, layout: { ...c.layout, ...patch } }))
  const updateBanner = (patch: Partial<ThemeBanner>) =>
    setFormConfig((c) => ({ ...c, banner: { ...c.banner, ...patch } }))

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme Preset Catalog
            </CardTitle>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Preset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {presets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No presets yet. Create the first one!</p>
          ) : (
            <div className="space-y-3">
              {presets.map((preset) => {
                const pcfg = preset.theme_config
                return (
                  <div
                    key={preset.id}
                    className="flex items-center gap-4 p-4 rounded-xl border"
                    style={{ borderLeftColor: pcfg.colors.primary, borderLeftWidth: 4 }}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                    {/* Color preview */}
                    <div className="flex gap-1 shrink-0">
                      {[pcfg.colors.primary, pcfg.colors.secondary, pcfg.colors.accent].map(
                        (c, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full border"
                            style={{ background: c }}
                          />
                        )
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{preset.name}</span>
                        {preset.is_system && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                        {!preset.is_active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                      </div>
                      {preset.description && (
                        <p className="text-xs text-muted-foreground truncate">{preset.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {pcfg.typography.fontFamily} · {pcfg.layout.template} · {pcfg.banner.shape}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={preset.is_active}
                        onCheckedChange={() => handleToggle(preset)}
                        className="scale-75"
                      />
                      <Button variant="ghost" size="sm" onClick={() => openEdit(preset)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!preset.is_system && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(preset)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Preset Editor Dialog ────────────────────────── */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>
              {editingPreset ? `Edit: ${editingPreset.name}` : "Create New Preset"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-80px)]">
            <div className="p-6 space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preset Name</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Midnight" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Brief description"
                    rows={1}
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Colors
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["primary", "Primary"],
                      ["secondary", "Secondary"],
                      ["accent", "Accent"],
                      ["background", "Background"],
                      ["cardBg", "Card BG"],
                      ["text", "Text"],
                      ["textSecondary", "Muted Text"],
                      ["border", "Border"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formConfig.colors[key]}
                        onChange={(e) => updateColors({ [key]: e.target.value })}
                        className="w-8 h-8 rounded border cursor-pointer shrink-0"
                      />
                      <Label className="text-xs w-16">{label}</Label>
                      <Input
                        value={formConfig.colors[key]}
                        onChange={(e) => {
                          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) updateColors({ [key]: e.target.value })
                        }}
                        className="w-24 font-mono text-xs h-8"
                        maxLength={7}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Typography</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Font Family</Label>
                    <Select
                      value={formConfig.typography.fontFamily}
                      onValueChange={(v) => updateTypography({ fontFamily: v as any })}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALLOWED_FONTS.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Layout Template</Label>
                    <Select
                      value={formConfig.layout.template}
                      onValueChange={(v) => updateLayout({ template: v as any })}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LAYOUT_TEMPLATES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Banner */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Banner</p>
                <div className="grid grid-cols-3 gap-2">
                  {BANNER_SHAPES.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateBanner({ shape: s })}
                      className={`rounded-lg border-2 p-2 text-xs capitalize transition-all ${
                        formConfig.banner.shape === s
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Overlay Opacity: {Math.round(formConfig.banner.overlayOpacity * 100)}%
                  </Label>
                  <Slider
                    value={[formConfig.banner.overlayOpacity * 100]}
                    onValueChange={([v]) => updateBanner({ overlayOpacity: v / 100 })}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowEditor(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : editingPreset ? "Update Preset" : "Create Preset"}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
