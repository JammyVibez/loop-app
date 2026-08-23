"use client"

/**
 * CircleThemeEditor
 *
 * Circle admin settings panel for customizing the Circle's visual theme.
 * Provides preset selection, individual token overrides, live preview, and publish.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import {
  Palette,
  Type,
  Layout,
  Layers,
  Image,
  RotateCcw,
  Eye,
  Save,
  Check,
  ChevronDown,
} from "lucide-react"
import type {
  CircleThemeConfig,
  ThemeColors,
  ThemeTypography,
  ThemeLayout,
  ThemeComponents,
  ThemeBanner,
} from "@/lib/circle-themes"
import {
  ALLOWED_FONTS,
  LAYOUT_TEMPLATES,
  SIDEBAR_POSITIONS,
  CONTENT_WIDTHS,
  BANNER_SHAPES,
  COMPONENT_KEYS,
  getDefaultTheme,
  themeToCSSVars,
} from "@/lib/circle-themes"

interface CircleThemeEditorProps {
  circleId: string
  isOpen: boolean
  onClose: () => void
}

interface Preset {
  id: string
  name: string
  description: string | null
  theme_config: CircleThemeConfig
}

export function CircleThemeEditor({ circleId, isOpen, onClose }: CircleThemeEditorProps) {
  const [theme, setTheme] = useState<CircleThemeConfig>(getDefaultTheme())
  const [originalTheme, setOriginalTheme] = useState<CircleThemeConfig>(getDefaultTheme())
  const [presets, setPresets] = useState<Preset[]>([])
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Load current theme + presets
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    Promise.all([
      fetch(`/api/circles/${circleId}/theme`).then((r) => r.json()),
      fetch("/api/admin/theme-presets").then((r) => r.json()),
    ])
      .then(([themeRes, presetsRes]) => {
        if (themeRes.success) {
          setTheme(themeRes.theme)
          setOriginalTheme(themeRes.theme)
        }
        if (presetsRes.success) setPresets(presetsRes.presets)
      })
      .catch(() => toast.error("Failed to load theme data"))
      .finally(() => setLoading(false))
  }, [circleId, isOpen])

  const hasChanges = useMemo(() => {
    return JSON.stringify(theme) !== JSON.stringify(originalTheme)
  }, [theme, originalTheme])

  // Update helpers
  const updateColors = useCallback((patch: Partial<ThemeColors>) => {
    setTheme((t) => ({ ...t, colors: { ...t.colors, ...patch } }))
    setDirty(true)
  }, [])

  const updateTypography = useCallback((patch: Partial<ThemeTypography>) => {
    setTheme((t) => ({ ...t, typography: { ...t.typography, ...patch } }))
    setDirty(true)
  }, [])

  const updateLayout = useCallback((patch: Partial<ThemeLayout>) => {
    setTheme((t) => ({ ...t, layout: { ...t.layout, ...patch } }))
    setDirty(true)
  }, [])

  const updateComponents = useCallback((patch: Partial<ThemeComponents>) => {
    setTheme((t) => ({ ...t, components: { ...t.components, ...patch } }))
    setDirty(true)
  }, [])

  const updateBanner = useCallback((patch: Partial<ThemeBanner>) => {
    setTheme((t) => ({ ...t, banner: { ...t.banner, ...patch } }))
    setDirty(true)
  }, [])

  const applyPreset = useCallback((preset: Preset) => {
    setTheme(structuredClone(preset.theme_config))
    setActivePresetId(preset.id)
    setDirty(true)
  }, [])

  const resetToDefault = useCallback(() => {
    setTheme(getDefaultTheme())
    setActivePresetId(null)
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/theme`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_config: theme }),
      })
      const data = await res.json()
      if (data.success) {
        setOriginalTheme(structuredClone(theme))
        setDirty(false)
        toast.success("Theme saved successfully!")
      } else {
        toast.error(data.error || "Failed to save theme")
      }
    } catch {
      toast.error("Failed to save theme")
    } finally {
      setSaving(false)
    }
  }, [circleId, theme])

  const cssVars = useMemo(() => themeToCSSVars(theme), [theme])

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Circle Theme Settings
              </DialogTitle>
              <div className="flex items-center gap-2">
                {dirty && (
                  <Badge variant="secondary" className="text-xs">
                    Unsaved changes
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-80px)]">
            <div className="p-6">
              <Tabs defaultValue="presets">
                <TabsList className="grid w-full grid-cols-5 mb-6">
                  <TabsTrigger value="presets" className="text-xs">
                    <Image className="h-3.5 w-3.5 mr-1" />
                    Presets
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="text-xs">
                    <Palette className="h-3.5 w-3.5 mr-1" />
                    Colors
                  </TabsTrigger>
                  <TabsTrigger value="typography" className="text-xs">
                    <Type className="h-3.5 w-3.5 mr-1" />
                    Typography
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-xs">
                    <Layout className="h-3.5 w-3.5 mr-1" />
                    Layout
                  </TabsTrigger>
                  <TabsTrigger value="components" className="text-xs">
                    <Layers className="h-3.5 w-3.5 mr-1" />
                    Sections
                  </TabsTrigger>
                </TabsList>

                {/* ── Presets Tab ──────────────────────────── */}
                <TabsContent value="presets">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Choose a base preset, then customize individual tokens below.
                      </p>
                      <Button variant="ghost" size="sm" onClick={resetToDefault}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Reset
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {presets.map((preset) => {
                        const pcfg = preset.theme_config
                        const isActive = activePresetId === preset.id
                        return (
                          <button
                            key={preset.id}
                            onClick={() => applyPreset(preset)}
                            className={`relative rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02] ${
                              isActive
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-border hover:border-primary/50"
                            }`}
                            style={{
                              background: pcfg.colors.background,
                              color: pcfg.colors.text,
                            }}
                          >
                            {isActive && (
                              <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            {/* Mini color swatch */}
                            <div className="flex gap-1.5 mb-3">
                              {[pcfg.colors.primary, pcfg.colors.secondary, pcfg.colors.accent].map(
                                (c, i) => (
                                  <div
                                    key={i}
                                    className="w-5 h-5 rounded-full border border-white/20"
                                    style={{ background: c }}
                                  />
                                )
                              )}
                            </div>
                            <p className="font-semibold text-sm">{preset.name}</p>
                            {preset.description && (
                              <p className="text-xs opacity-60 mt-0.5 line-clamp-2">
                                {preset.description}
                              </p>
                            )}
                            <p className="text-[10px] opacity-40 mt-1.5 font-mono">
                              {pcfg.typography.fontFamily}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* ── Colors Tab ───────────────────────────── */}
                <TabsContent value="colors">
                  <div className="space-y-5">
                    {(
                      [
                        ["primary", "Primary Accent"],
                        ["secondary", "Secondary Accent"],
                        ["accent", "Highlight Accent"],
                        ["background", "Page Background"],
                        ["cardBg", "Card Background"],
                        ["text", "Text Color"],
                        ["textSecondary", "Secondary Text"],
                        ["border", "Border Color"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-3">
                        <Label className="w-36 text-sm shrink-0">{label}</Label>
                        <input
                          type="color"
                          value={theme.colors[key]}
                          onChange={(e) => updateColors({ [key]: e.target.value })}
                          className="w-10 h-10 rounded-lg border cursor-pointer shrink-0"
                        />
                        <Input
                          value={theme.colors[key]}
                          onChange={(e) => {
                            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                              updateColors({ [key]: e.target.value })
                            }
                          }}
                          className="w-28 font-mono text-xs"
                          maxLength={7}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* ── Typography Tab ───────────────────────── */}
                <TabsContent value="typography">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm">Font Family</Label>
                      <Select
                        value={theme.typography.fontFamily}
                        onValueChange={(v) => updateTypography({ fontFamily: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALLOWED_FONTS.map((f) => (
                            <SelectItem key={f} value={f}>
                              <span style={{ fontFamily: f }}>{f}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Heading Weight</Label>
                      <Select
                        value={theme.typography.headingWeight}
                        onValueChange={(v) => updateTypography({ headingWeight: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["400", "500", "600", "700", "800", "900"].map((w) => (
                            <SelectItem key={w} value={w}>
                              {w} {w === "700" ? "(Bold)" : w === "600" ? "(Semi-bold)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Body Weight</Label>
                      <Select
                        value={theme.typography.bodyWeight}
                        onValueChange={(v) => updateTypography({ bodyWeight: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["300", "400", "500"].map((w) => (
                            <SelectItem key={w} value={w}>
                              {w} {w === "400" ? "(Regular)" : w === "300" ? "(Light)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Live preview */}
                    <div
                      className="rounded-xl border p-6 space-y-3"
                      style={{
                        background: theme.colors.cardBg,
                        color: theme.colors.text,
                        fontFamily: theme.typography.fontFamily,
                      }}
                    >
                      <p
                        style={{
                          fontWeight: theme.typography.headingWeight,
                          fontSize: "1.25rem",
                        }}
                      >
                        Preview Heading
                      </p>
                      <p style={{ fontWeight: theme.typography.bodyWeight, fontSize: theme.typography.fontSize }}>
                        This is how your Circle&apos;s body text will look with the selected typography settings.
                        Quick brown fox jumps over the lazy dog.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Layout Tab ───────────────────────────── */}
                <TabsContent value="layout">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm">Layout Template</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {LAYOUT_TEMPLATES.map((t) => (
                          <button
                            key={t}
                            onClick={() => updateLayout({ template: t })}
                            className={`rounded-lg border-2 p-3 text-sm transition-all ${
                              theme.layout.template === t
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            {t === "feed-first" && "📰 Feed First"}
                            {t === "grid-gallery" && "🔲 Grid Gallery"}
                            {t === "forum-threaded" && "💬 Forum Threaded"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Sidebar Position</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {SIDEBAR_POSITIONS.map((pos) => (
                          <button
                            key={pos}
                            onClick={() => updateLayout({ sidebarPosition: pos })}
                            className={`rounded-lg border-2 p-3 text-sm capitalize transition-all ${
                              theme.layout.sidebarPosition === pos
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Content Width</Label>
                      <Select
                        value={theme.layout.contentWidth}
                        onValueChange={(v) => updateLayout({ contentWidth: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTENT_WIDTHS.map((w) => (
                            <SelectItem key={w} value={w}>
                              <span className="capitalize">{w}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Show Hero Banner</Label>
                      <Switch
                        checked={theme.layout.showHeroBanner}
                        onCheckedChange={(v) => updateLayout({ showHeroBanner: v })}
                      />
                    </div>

                    {/* Banner settings */}
                    <div className="space-y-4 pt-2 border-t">
                      <p className="text-sm font-medium">Banner Style</p>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Shape</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {BANNER_SHAPES.map((s) => (
                            <button
                              key={s}
                              onClick={() => updateBanner({ shape: s })}
                              className={`rounded-lg border-2 p-2 text-sm capitalize transition-all ${
                                theme.banner.shape === s
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border hover:border-primary/30"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Overlay Opacity: {Math.round(theme.banner.overlayOpacity * 100)}%
                        </Label>
                        <Slider
                          value={[theme.banner.overlayOpacity * 100]}
                          onValueChange={([v]) => updateBanner({ overlayOpacity: v / 100 })}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Components/Sections Tab ───────────────── */}
                <TabsContent value="components">
                  <div className="space-y-5">
                    <p className="text-sm text-muted-foreground">
                      Toggle which sections appear and reorder them by dragging.
                    </p>

                    {/* Visibility toggles */}
                    <div className="space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Section Visibility
                      </p>
                      {COMPONENT_KEYS.map((key) => (
                        <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                          <Label className="text-sm capitalize">{key}</Label>
                          <Switch
                            checked={theme.components.visibility[key] ?? true}
                            onCheckedChange={(v) =>
                              updateComponents({
                                visibility: { ...theme.components.visibility, [key]: v },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>

                    {/* Section order */}
                    <div className="space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Section Order (click arrows to reorder)
                      </p>
                      {theme.components.order.map((key, idx) => (
                        <div key={key} className="flex items-center gap-2 py-1.5">
                          <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="text-sm capitalize flex-1">{key}</span>
                          <div className="flex gap-1">
                            <button
                              disabled={idx === 0}
                              onClick={() => {
                                const newOrder = [...theme.components.order]
                                ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
                                updateComponents({ order: newOrder })
                              }}
                              className="p-1 rounded hover:bg-muted disabled:opacity-30"
                            >
                              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                            </button>
                            <button
                              disabled={idx === theme.components.order.length - 1}
                              onClick={() => {
                                const newOrder = [...theme.components.order]
                                ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
                                updateComponents({ order: newOrder })
                              }}
                              className="p-1 rounded hover:bg-muted disabled:opacity-30"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ──────────────────────────────── */}
      {showPreview && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b" style={{ background: theme.colors.background }}>
              <DialogTitle style={{ color: theme.colors.text }}>Theme Preview</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(85vh-70px)]">
              <div
                className="min-h-[500px] p-6"
                style={{
                  ...cssVars,
                  background: theme.colors.background,
                  color: theme.colors.text,
                  fontFamily: theme.typography.fontFamily,
                }}
              >
                {/* Banner preview */}
                {theme.layout.showHeroBanner && (
                  <div
                    className="mb-6 h-32 relative overflow-hidden"
                    style={{
                      borderRadius: theme.banner.borderRadius,
                      background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        background: theme.colors.background,
                        opacity: theme.banner.overlayOpacity,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-xl font-bold" style={{ color: theme.colors.text }}>
                        Your Circle Name
                      </p>
                    </div>
                  </div>
                )}

                {/* Sample cards in component order */}
                <div className="space-y-4">
                  {theme.components.order.map((key) =>
                    theme.components.visibility[key] ? (
                      <div
                        key={key}
                        className="rounded-xl p-4"
                        style={{
                          background: theme.colors.cardBg,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.banner.borderRadius,
                        }}
                      >
                        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.colors.textSecondary }}>
                          {key}
                        </p>
                        <p style={{ fontWeight: theme.typography.headingWeight }}>
                          Sample {key} content appears here
                        </p>
                        <p
                          className="mt-1 text-sm"
                          style={{ color: theme.colors.textSecondary, fontWeight: theme.typography.bodyWeight }}
                        >
                          This section is visible and positioned at slot {theme.components.order.indexOf(key) + 1}
                        </p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
