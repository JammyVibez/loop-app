"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, Reorder, motion } from "framer-motion"
import {
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Layout,
  Layers3,
  Lock,
  MonitorSmartphone,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { TactileButton } from "@/components/ui/tactile-button"
import { MAX_PROFILE_CUSTOM_CSS_BYTES, profileCustomCssByteLength } from "@/lib/profile-custom-css-limits"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  buildProfileLayoutCss,
  DEFAULT_PROFILE_LAYOUT,
  normalizeProfileLayout,
  type ProfileLayout,
} from "@/lib/profile-layout"

const SECTION_LABELS: Record<string, string> = {
  cover: "Cover image",
  profile: "Profile column",
  content: "Posts and tabs",
  "avatar-actions": "Avatar and actions",
  identity: "Name and identity",
  bio: "Bio and circles",
  details: "Links and details",
  stats: "Profile statistics",
  awards: "Awards",
  progress: "Level and progress",
  organization: "Organization",
  cosmetics: "Equipped cosmetics",
  about: "About",
  loops: "Loops",
  branches: "Branches",
  media: "Media",
  work: "Creative work",
}

const SECTION_DESCRIPTIONS: Record<string, string> = {
  cover: "Your profile banner and cover controls",
  profile: "The identity and details column",
  content: "About, loops, branches, media and work",
  "avatar-actions": "Avatar, follow, share and edit actions",
  identity: "Display name, badges and pronouns",
  bio: "Your introduction and community tags",
  details: "Location, website and joined date",
  stats: "Followers, loops, likes and level",
  awards: "Community recognition",
  progress: "Experience and next-level progress",
  organization: "Partnership information",
  cosmetics: "Frames, auras, fonts and effects",
  about: "Profile introduction and activity",
  loops: "Published loops",
  branches: "Branches",
  media: "Photo and video media",
  work: "Creative work and portfolio",
}

function moveItem(items: string[], id: string, direction: -1 | 1) {
  const index = items.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function saveTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const area = document.createElement("textarea")
  area.value = value
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand("copy")
  area.remove()
  return copied ? Promise.resolve() : Promise.reject(new Error("Clipboard unavailable"))
}

export function ProfileDesigner({
  open,
  onOpenChange,
  initialLayout,
  initialCss = "",
  isPremium = false,
  displayName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLayout?: unknown
  initialCss?: string | null
  isPremium?: boolean
  displayName: string
  onSaved?: (layout: ProfileLayout) => void
}) {
  const { getAuthHeader, applyServerProfile, refreshUser } = useAuth()
  const { toast } = useToast()
  const [layout, setLayout] = useState<ProfileLayout>(() => normalizeProfileLayout(initialLayout))
  const [css, setCss] = useState(initialCss || "")
  const [savedCss, setSavedCss] = useState(initialCss || "")
  const [tab, setTab] = useState<"layout" | "css">("layout")
  const [saving, setSaving] = useState(false)
  const layoutDirty = JSON.stringify(layout) !== JSON.stringify(normalizeProfileLayout(initialLayout))
  const cssDirty = css !== savedCss
  const pageSections = useMemo(() => layout.sections, [layout.sections])
  const sidebarSections = useMemo(() => layout.sidebar, [layout.sidebar])
  const tabSections = useMemo(() => layout.tabs, [layout.tabs])
  const cssBytes = useMemo(() => profileCustomCssByteLength(css), [css])
  const cssTooLarge = cssBytes > MAX_PROFILE_CUSTOM_CSS_BYTES
  const hidden = new Set(layout.hidden)

  useEffect(() => {
    if (!open) return
    setLayout(normalizeProfileLayout(initialLayout))
    setCss(initialCss || "")
    setSavedCss(initialCss || "")
    setTab("layout")
  }, [open, initialLayout, initialCss])

  const updateOrder = (key: "sections" | "sidebar" | "tabs", value: string[]) => {
    setLayout((current) => ({ ...current, [key]: value }))
  }

  const toggleHidden = (id: string) => {
    setLayout((current) => ({
      ...current,
      hidden: current.hidden.includes(id)
        ? current.hidden.filter((item) => item !== id)
        : [...current.hidden, id],
    }))
  }

  const restoreDefaults = () => {
    setLayout({
      ...DEFAULT_PROFILE_LAYOUT,
      sections: [...DEFAULT_PROFILE_LAYOUT.sections],
      sidebar: [...DEFAULT_PROFILE_LAYOUT.sidebar],
      tabs: [...DEFAULT_PROFILE_LAYOUT.tabs],
      hidden: [],
    })
  }

  const copyCss = async () => {
    const output = [buildProfileLayoutCss(layout), css.trim()].filter(Boolean).join("\n\n")
    try {
      await saveTextToClipboard(output)
      toast({ title: "CSS copied", description: "Paste it into Custom profile CSS." })
    } catch {
      toast({ title: "Could not copy CSS", description: "Select the CSS and copy it manually.", variant: "destructive" })
    }
  }

  const finish = async () => {
    if (saving || (isPremium && cssTooLarge)) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { profile_layout: layout }
      if (isPremium && cssDirty) payload.custom_profile_css = css
      const response = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not save your profile design.")
      const savedLayout = normalizeProfileLayout(data.profile?.profile_layout || layout)
      setLayout(savedLayout)
      if (isPremium && cssDirty) {
        const saved = typeof data.profile?.custom_profile_css === "string" ? data.profile.custom_profile_css : css
        setCss(saved)
        setSavedCss(saved)
        applyServerProfile({ custom_profile_css: saved })
      }
      applyServerProfile({ profile_layout: savedLayout })
      await refreshUser()
      onSaved?.(savedLayout)
      toast({ title: "Design saved", description: "Your profile layout is live." })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Could not finish design",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const renderReorderList = (
    items: string[],
    key: "sections" | "sidebar" | "tabs",
  ) => (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={(next) => updateOrder(key, next)}
      className="space-y-2"
    >
      {items.map((id, index) => {
        const isHidden = hidden.has(id)
        const canHide = key !== "tabs" && id !== "profile" && id !== "content" && id !== "identity" && id !== "avatar-actions"
        return (
          <Reorder.Item
            key={id}
            value={id}
            className="group flex touch-pan-y items-center gap-2 rounded-xl border border-border/80 bg-card p-2.5 shadow-sm transition-colors data-[dragging]:border-primary/50 data-[dragging]:bg-primary/5"
            whileDrag={{ scale: 1.015, boxShadow: "0 16px 42px rgba(0,0,0,.16)" }}
          >
            <span className="grid h-8 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors group-active:bg-muted">
              <GripVertical className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={isHidden ? "truncate text-sm font-medium text-muted-foreground line-through" : "truncate text-sm font-semibold"}>
                {SECTION_LABELS[id] || id}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{SECTION_DESCRIPTIONS[id] || "Profile section"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg"
                aria-label={"Move " + id + " up"}
                disabled={index === 0}
                onClick={() => updateOrder(key, moveItem(items, id, -1))}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg"
                aria-label={"Move " + id + " down"}
                disabled={index === items.length - 1}
                onClick={() => updateOrder(key, moveItem(items, id, 1))}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              {canHide ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-lg"
                  aria-label={(isHidden ? "Show " : "Hide ") + id}
                  onClick={() => toggleHidden(id)}
                >
                  {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              ) : null}
            </div>
          </Reorder.Item>
        )
      })}
    </Reorder.Group>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94dvh] w-[calc(100vw-16px)] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 sm:h-[90dvh] sm:w-[calc(100vw-32px)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-6">
          <DialogHeader className="min-w-0 space-y-1 text-left">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Layout className="h-4 w-4" />
              </span>
              <DialogTitle className="truncate text-base sm:text-lg">Profile Design Studio</DialogTitle>
              <Badge variant="secondary" className="hidden sm:inline-flex">Live layout</Badge>
            </div>
            <DialogDescription className="hidden sm:block">Arrange each profile section. Drag on touchscreens or use the arrows.</DialogDescription>
          </DialogHeader>
          <div className="mr-8 hidden items-center gap-2 sm:flex">
            <span className="text-xs text-muted-foreground">Preview</span>
            <span className="max-w-36 truncate text-xs font-semibold">{displayName}</span>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 px-3 py-2 sm:px-6">
          <Button type="button" size="sm" variant={tab === "layout" ? "secondary" : "ghost"} className="rounded-full" onClick={() => setTab("layout")}>
            <Layers3 className="mr-1.5 h-3.5 w-3.5" /> Layout
          </Button>
          <Button type="button" size="sm" variant={tab === "css" ? "secondary" : "ghost"} className="rounded-full" onClick={() => setTab("css")}>
            <Code2 className="mr-1.5 h-3.5 w-3.5" /> CSS
          </Button>
          <span className="ml-auto flex items-center gap-1 whitespace-nowrap px-2 text-[10px] text-muted-foreground">
            <MonitorSmartphone className="h-3.5 w-3.5" /> Mobile-ready
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
            <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3 lg:hidden">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Mobile preview</span>
                <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {layout.sections.filter((id) => !hidden.has(id)).map((id) => (
                  <Badge key={id} variant="secondary" className="text-[10px]">{SECTION_LABELS[id] || id}</Badge>
                ))}
                {layout.sidebar.filter((id) => !hidden.has(id)).map((id) => (
                  <Badge key={id} variant="outline" className="text-[10px]">{SECTION_LABELS[id] || id}</Badge>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1 border-t border-border/70 pt-2">
                {tabSections.map((id) => <span key={id} className="rounded-md bg-background px-2 py-1 text-[9px] capitalize">{id}</span>)}
              </div>
            </div>
            <AnimatePresence mode="wait">
              {tab === "layout" ? (
                <motion.div
                  key="layout"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-5"
                >
                  <div>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold">Page arrangement</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Move the cover, profile column and content area.</p>
                      </div>
                      <Badge variant="outline">{pageSections.length} sections</Badge>
                    </div>
                    {renderReorderList(pageSections, "sections")}
                  </div>
                  <div className="border-t border-border/70 pt-5">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold">Profile elements</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Reorder and show or hide every profile block.</p>
                      </div>
                      <Badge variant="outline">{sidebarSections.length} blocks</Badge>
                    </div>
                    {renderReorderList(sidebarSections, "sidebar")}
                  </div>
                  <div className="border-t border-border/70 pt-5">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold">Profile tabs</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Arrange the views visitors see on your profile.</p>
                      </div>
                      <Badge variant="outline">{tabSections.length} tabs</Badge>
                    </div>
                    {renderReorderList(tabSections, "tabs")}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
                    <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={restoreDefaults}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore default
                    </Button>
                    <p className="text-[11px] text-muted-foreground">Changes are only public after Finish.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="css"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-3"
                >
                  <div>
                    <h3 className="text-sm font-bold">Generated layout CSS</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Export your current arrangement as scoped CSS. The layout itself is saved by Finish, so CSS is optional.
                    </p>
                  </div>
                  <Textarea
                    value={[buildProfileLayoutCss(layout), css].filter(Boolean).join("\n\n")}
                    readOnly
                    spellCheck={false}
                    className="min-h-[220px] resize-y font-mono text-[11px] leading-5"
                  />
                  <div className="flex flex-wrap gap-2">
                    <TactileButton size="sm" onClick={() => void copyCss()}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy CSS
                    </TactileButton>
                    {isPremium ? (
                      <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setCss((current) => [buildProfileLayoutCss(layout), current].filter(Boolean).join("\n\n"))}>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Add layout CSS to Pro CSS
                      </Button>
                    ) : (
                      <Button asChild type="button" size="sm" variant="outline" className="rounded-full">
                        <a href="/premium?plan=monthly"><Lock className="mr-1.5 h-3.5 w-3.5" /> Pro CSS</a>
                      </Button>
                    )}
                  </div>
                  {isPremium ? (
                    <>
                      <Textarea
                        value={css}
                        onChange={(event) => setCss(event.target.value)}
                        spellCheck={false}
                        className="min-h-[180px] resize-y font-mono text-xs leading-5"
                        placeholder="Add optional profile-only CSS…"
                      />
                      <div className="flex justify-between gap-3 text-[11px]">
                        <span className={cssTooLarge ? "text-destructive" : "text-muted-foreground"}>{cssBytes.toLocaleString()} / {MAX_PROFILE_CUSTOM_CSS_BYTES.toLocaleString()} bytes</span>
                        {cssTooLarge ? <span className="text-destructive">Reduce CSS before finishing.</span> : <span className="text-muted-foreground">UTF-8 byte limit</span>}
                      </div>
                    </>
                  ) : (
                    <p className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      Custom CSS is a Pro feature. You can still save the visual arrangement without writing code.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <aside className="hidden min-h-0 flex-col border-l border-border/70 bg-muted/20 p-4 lg:flex">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Preview</span>
              <Badge variant="outline" className="text-[10px]">Desktop</Badge>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-background p-3">
              <motion.div layout className="overflow-hidden rounded-xl border border-border">
                <div className="h-20 bg-gradient-to-r from-primary/40 via-primary/10 to-muted" />
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-12 rounded-full border-4 border-background bg-muted shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{displayName}</p>
                      <p className="text-[10px] text-muted-foreground">@your-loop-profile</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {layout.sidebar.filter((id) => !hidden.has(id) && id !== "avatar-actions").map((id, index) => (
                      <motion.div key={id} layout className="h-7 rounded-lg border border-dashed border-border bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
                        {SECTION_LABELS[id] || id}
                      </motion.div>
                    ))}
                    <div className="mt-3 flex gap-1 border-t border-border pt-2">
                      {layout.tabs.slice(0, 4).map((id) => <span key={id} className="rounded-md bg-muted px-2 py-1 text-[9px] capitalize">{id}</span>)}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{layout.hidden.length} hidden</span>
              <span>{layout.sections.length + layout.sidebar.length} movable parts</span>
            </div>
          </aside>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-background px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {layoutDirty || cssDirty ? "Unsaved changes" : "All changes saved"}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <TactileButton onClick={() => void finish()} disabled={saving || (isPremium && cssTooLarge)}>
              <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Finish"}
              <Check className="ml-1.5 h-3.5 w-3.5" />
            </TactileButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
