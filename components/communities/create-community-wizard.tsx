"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { COMMUNITY_CATEGORIES, getCategoryConfig, LAYOUT_PRESETS } from "@/lib/community-categories"
import { DeviceMediaPicker, type PickedMedia } from "@/components/communities/device-media-picker"
import { Spinner } from "@/components/ui/skeletons"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutTemplate,
  Globe2,
  ImagePlus,
  Lock,
  Wand2,
  Hash,
} from "lucide-react"

const STEPS = [
  { id: 0, label: "Category" },
  { id: 1, label: "Identity" },
  { id: 2, label: "Template" },
]

export function CreateCommunityWizard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState("general")
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState("")
  const [banner, setBanner] = useState("")
  const [iconItems, setIconItems] = useState<PickedMedia[]>([])
  const [bannerItems, setBannerItems] = useState<PickedMedia[]>([])
  const [accent, setAccent] = useState("")
  const [tags, setTags] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [template, setTemplate] = useState<"accept" | "minimal">("accept")
  const [layout, setLayout] = useState("default")
  const [welcome, setWelcome] = useState("")
  const [rules, setRules] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const cfg = getCategoryConfig(category)

  const startCreate = () => {
    if (!user) {
      router.push("/auth?returnTo=/communities/create")
      return
    }
    setStep(1)
  }

  const next = () => {
    if (step === 1 && !name.trim()) {
      setError("Give your community a name")
      return
    }
    setError("")
    if (step < 2) setStep(step + 1)
  }
  const back = () => (step > 0 ? setStep(step - 1) : router.push("/communities"))

  const submit = async () => {
    if (!name.trim()) return setError("Name is required")
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          handle: handle.trim() || undefined,
          description,
          category,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
          is_private: isPrivate,
          rules: rules.trim() ? { rules: rules.trim().split("\n").filter(Boolean) } : {},
          icon: icon || undefined,
          banner: banner || undefined,
          accent_color: accent || cfg.accent,
          layout_preset: layout,
          template,
          welcome_message: welcome || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create community")
      router.push(`/communities/${data.community.id}`)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 border-b border-border bg-muted/30 px-4 py-4">
        {STEPS.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                step === s.id
                  ? "bg-primary text-primary-foreground"
                  : step > s.id
                  ? "bg-emerald-500 text-white"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id + 1}
            </div>
            <span className={`text-xs font-medium ${step >= s.id ? "text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {s.id < 2 && <div className="h-px w-6 sm:w-10 bg-border mx-1" />}
          </div>
        ))}
      </div>

      <div className="p-6 sm:p-8">
        {/* STEP 1 — CATEGORY */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black tracking-tight">What is your community about?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Categories are blueprints — they recommend spaces, features and roles. You can customize everything.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COMMUNITY_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`group relative rounded-2xl border p-4 text-left transition ${
                    category === c.id
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <div className="text-2xl">{c.emoji}</div>
                  <div className="mt-1.5 text-sm font-bold leading-tight">{c.label}</div>
                  <div className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">{c.tagline}</div>
                  {category === c.id && (
                    <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={back}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={startCreate}>
                {user ? "Continue" : "Sign in to continue"} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — IDENTITY */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black tracking-tight">
                {cfg.emoji} Shape your community
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Name, handle, story and look — the identity your members will know.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="cname">Name *</Label>
                <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jujutsu Society" maxLength={100} className="mt-1.5 h-11 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="chandle">Handle (unique URL)</Label>
                <div className="relative mt-1.5">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="chandle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "your-handle"} className="pl-9 h-11 rounded-xl" maxLength={40} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Leave empty to auto-generate from the name.</p>
              </div>
              <div>
                <Label htmlFor="cdesc">Description</Label>
                <Textarea id="cdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will members build together here?" className="mt-1.5 rounded-xl min-h-[90px]" maxLength={2000} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Community icon</Label>
                  <DeviceMediaPicker
                    items={iconItems}
                    onChange={(items) => {
                      setIconItems(items)
                      setIcon(items[0]?.url || "")
                    }}
                    maxItems={1}
                    accept="image/*"
                    compact
                    folder="community-assets"
                  />
                  <Input value={icon} onChange={(e) => { setIcon(e.target.value); setIconItems([]) }} placeholder="or paste an image URL (optional)" className="mt-1 h-10 rounded-xl text-xs" />
                </div>
                <div className="space-y-2">
                  <Label>Banner image</Label>
                  <DeviceMediaPicker
                    items={bannerItems}
                    onChange={(items) => {
                      setBannerItems(items)
                      setBanner(items[0]?.url || "")
                    }}
                    maxItems={1}
                    accept="image/*"
                    compact
                    folder="community-assets"
                  />
                  <Input value={banner} onChange={(e) => { setBanner(e.target.value); setBannerItems([]) }} placeholder="or paste an image URL (optional)" className="mt-1 h-10 rounded-xl text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Accent color</Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input type="color" value={accent || cfg.accent} onChange={(e) => setAccent(e.target.value)} className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-background" />
                    <span className="text-xs text-muted-foreground font-mono">{accent || cfg.accent}</span>
                  </div>
                </div>
                <div>
                  <Label>Tags (comma separated)</Label>
                  <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="anime, theories, rankings" className="mt-1.5 h-11 rounded-xl" />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Private community</p>
                      <p className="text-[11px] text-muted-foreground">New members must be approved</p>
                    </div>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>
                <div>
                  <Label htmlFor="cwelcome">Welcome message (optional)</Label>
                  <Input id="cwelcome" value={welcome} onChange={(e) => setWelcome(e.target.value)} placeholder="Welcome to the world! Here's how to get started…" className="mt-1 h-10 rounded-xl" maxLength={300} />
                </div>
                <div>
                  <Label htmlFor="crules">Community rules (one per line, optional)</Label>
                  <Textarea id="crules" value={rules} onChange={(e) => setRules(e.target.value)} placeholder={"Be respectful\nNo spoilers without tags\nHave fun"} className="mt-1 rounded-xl min-h-[70px] text-sm" />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={back}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={next}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — TEMPLATE */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black tracking-tight">Choose your starting point</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on <strong>{cfg.label}</strong>, here&apos;s what your world starts with. You can change everything later in settings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setTemplate("accept")}
                className={`rounded-2xl border p-5 text-left transition ${template === "accept" ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:border-primary/40"}`}
              >
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold">Full template</p>
                  {template === "accept" && <Check className="ml-auto h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{cfg.templateHint}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cfg.recommendedSpaces.slice(0, 5).map((s) => (
                    <Badge key={s.name} variant="secondary" className="text-[10px]">{s.icon} {s.name}</Badge>
                  ))}
                </div>
              </button>

              <button
                onClick={() => setTemplate("minimal")}
                className={`rounded-2xl border p-5 text-left transition ${template === "minimal" ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:border-primary/40"}`}
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold">Start minimal</p>
                  {template === "minimal" && <Check className="ml-auto h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Just Home, Discussions and Media. You add everything else manually.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">Home</Badge>
                  <Badge variant="secondary" className="text-[10px]">Discussions</Badge>
                  <Badge variant="secondary" className="text-[10px]">Media</Badge>
                </div>
              </button>
            </div>

            <div>
              <Label>Layout preset</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {LAYOUT_PRESETS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`rounded-xl border p-2.5 text-center transition ${layout === l.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                  >
                    <p className="text-xs font-semibold">{l.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{l.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={back}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={submit} disabled={submitting} className="min-w-[180px]">
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-1.5" /> Building your world…
                  </>
                ) : (
                  <>
                    <Globe2 className="h-4 w-4 mr-1.5" /> Create Community
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}