"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  Crown,
  Filter,
  Layers3,
  Lock,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Upload,
  Wallet,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TactileButton } from "@/components/ui/tactile-button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { normalizeProfileLayout, type ProfileLayout } from "@/lib/profile-layout"

type Listing = {
  id: string
  title: string
  summary: string
  description: string
  category: string
  tags: string[]
  cover_url?: string | null
  price_coins: number
  purchase_count: number
  rating_average: number
  rating_count: number
  status: string
  moderation_note?: string | null
  theme_tokens?: Record<string, string>
  creator?: { id: string; username: string; display_name: string; avatar_url?: string; is_verified?: boolean } | null
  title_snapshot?: string
  listing_id?: string
  layout_snapshot?: unknown
  css_snapshot?: string
}

type Mode = "explore" | "mine" | "purchased" | "review"
type Category = "all" | "minimal" | "editorial" | "creative" | "portfolio" | "gaming" | "community" | "other"

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: "all", label: "All designs" },
  { id: "minimal", label: "Minimal" },
  { id: "editorial", label: "Editorial" },
  { id: "creative", label: "Creative" },
  { id: "portfolio", label: "Portfolio" },
  { id: "gaming", label: "Gaming" },
  { id: "community", label: "Community" },
  { id: "other", label: "Other" },
]

const PRICE_LABELS: Record<string, string> = {
  minimal: "Minimal",
  editorial: "Editorial",
  creative: "Creative",
  portfolio: "Portfolio",
  gaming: "Gaming",
  community: "Community",
  other: "Other",
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString()
}

function cardGradient(item: Listing) {
  const primary = item.theme_tokens?.primary || "#6475df"
  const secondary = item.theme_tokens?.secondary || "#9d72d6"
  return `linear-gradient(135deg, ${primary}, ${secondary})`
}

export function ProfileMarketplace({
  currentLayout,
  currentCss = "",
  designCss = "",
  themeTokens = {},
}: {
  currentLayout?: unknown
  currentCss?: string
  designCss?: string
  themeTokens?: Record<string, string>
}) {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>("explore")
  const [category, setCategory] = useState<Category>("all")
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [selected, setSelected] = useState<Listing | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [moderating, setModerating] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [earnings, setEarnings] = useState(0)
  const [sales, setSales] = useState(0)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState("")
  const [listingForm, setListingForm] = useState({
    title: "",
    summary: "",
    description: "",
    category: "creative",
    price_coins: "500",
    tags: "",
    cover_url: "",
  })

  const ownedIds = useMemo(() => new Set(items.filter((item) => item.listing_id).map((item) => item.listing_id as string)), [items])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const params = new URLSearchParams({ mode })
      if (category !== "all" && mode === "explore") params.set("category", category)
      if (search.trim() && mode === "explore") params.set("q", search.trim())
      const response = await fetch("/api/profile-marketplace?" + params.toString(), {
        headers: user ? getAuthHeader() : undefined,
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Marketplace unavailable.")
      setItems(Array.isArray(data.items) ? data.items : [])
      setEarnings(Number(data.earnings || 0))
      setSales(Number(data.sales || 0))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Marketplace unavailable.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [mode, category, search, user, getAuthHeader])

  useEffect(() => {
    void load()
  }, [load])

  const buy = async (item: Listing) => {
    if (!user) {
      toast({ title: "Sign in to purchase", description: "Your design library is tied to your Loop account." })
      return
    }
    setPurchasing(item.id)
    try {
      const response = await fetch("/api/profile-marketplace/" + item.id + "/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Purchase failed.")
      await refreshUser()
      toast({ title: "Design unlocked", description: item.price_coins > 0 ? "The creator has received their share." : "Added to your design library." })
      await load()
      setMode("purchased")
      setSelected(null)
    } catch (error) {
      toast({ title: "Purchase failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" })
    } finally {
      setPurchasing(null)
    }
  }

  const apply = async (item: Listing) => {
    const id = item.listing_id || item.id
    setApplying(id)
    try {
      const response = await fetch("/api/profile-marketplace/" + id + "/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not apply this design.")
      await refreshUser()
      toast({ title: "Design applied", description: "Your layout and profile styling are now active." })
    } catch (error) {
      toast({ title: "Could not apply design", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" })
    } finally {
      setApplying(null)
    }
  }

  const submitListing = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const response = await fetch("/api/profile-marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          ...listingForm,
          price_coins: Number(listingForm.price_coins),
          tags: listingForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          design_layout: normalizeProfileLayout(currentLayout),
          design_css: [currentCss, designCss].filter(Boolean).join("\n\n"),
          theme_tokens: themeTokens,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not submit this design.")
      setCreateOpen(false)
      setMode("mine")
      toast({ title: "Submitted for review", description: "Your design will appear in the marketplace after moderation." })
      await load()
    } catch (error) {
      toast({ title: "Submission failed", description: error instanceof Error ? error.message : "Check the details and try again.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const moderate = async (item: Listing, status: "published" | "rejected") => {
    setModerating(item.id)
    try {
      const response = await fetch("/api/profile-marketplace/" + item.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ status }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not moderate listing.")
      toast({ title: status === "published" ? "Design published" : "Design rejected" })
      await load()
    } catch (error) {
      toast({ title: "Moderation failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" })
    } finally {
      setModerating(null)
    }
  }

  const sendReview = async () => {
    if (!selected) return
    try {
      const response = await fetch("/api/profile-marketplace/" + selected.id + "/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ rating: reviewRating, review: reviewText }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not save review.")
      setReviewText("")
      toast({ title: "Review saved", description: "Thanks for helping other creators choose." })
      await load()
    } catch (error) {
      toast({ title: "Review not saved", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" })
    }
  }

  const title = mode === "explore" ? "Profile Design Market" : mode === "mine" ? "Your creations" : mode === "purchased" ? "Your design library" : "Review queue"

  return (
    <div className="space-y-6 pb-24 sm:pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Loop creator economy
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-4xl">Profiles, reimagined.</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Discover profile layouts, visual systems and CSS crafted by the Loop community. Buy once, keep forever.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TactileButton onClick={() => setCreateOpen(true)} disabled={!user}>
              <Upload className="mr-2 h-4 w-4" /> Publish a design
            </TactileButton>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/shop"><Palette className="mr-2 h-4 w-4" /> Browse cosmetics</Link>
            </Button>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Designs", value: mode === "mine" ? items.length : "Community", icon: Layers3 },
            { label: "Creator sales", value: mode === "mine" ? money(sales) : "85%", icon: Wallet },
            { label: "Earned coins", value: mode === "mine" ? money(earnings) : "Creator share", icon: Sparkles },
            { label: "Ownership", value: "Forever", icon: Check },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"><Icon className="h-3 w-3" /> {stat.label}</div>
                <p className="mt-1 truncate text-base font-bold tabular-nums sm:text-lg">{stat.value}</p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ["explore", "Explore", Store],
          ["purchased", "Owned", Layers3],
          ["mine", "My designs", Palette],
          ...(user?.is_admin || user?.is_moderator ? [["review", "Review queue", ShieldCheck] as const] : []),
        ] as Array<[Mode, string, typeof Store]>).map(([id, label, Icon]) => (
          <Button
            key={id}
            type="button"
            variant={mode === id ? "secondary" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => setMode(id)}
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" /> {label}
          </Button>
        ))}
        <span className="ml-auto hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
          <Wallet className="h-3.5 w-3.5" /> {money(user?.loop_coins)} Loop Coins
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search designs, styles or creators…" className="h-11 rounded-2xl pl-9" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {CATEGORIES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={category === item.id ? "secondary" : "ghost"}
              className="shrink-0 rounded-full"
              onClick={() => setCategory(item.id)}
              disabled={mode !== "explore"}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {mode === "review" ? "Submissions waiting for moderation" : mode === "mine" ? "Your listings and creator performance" : mode === "purchased" ? "Designs you own and can apply again" : "Community-made profile systems"}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => void load()}>
          <Filter className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl border border-border bg-muted/40" />)}
        </div>
      ) : loadError ? (
        <Card><CardContent className="p-8 text-center"><p className="text-sm text-muted-foreground">{loadError}</p><Button className="mt-3 rounded-full" onClick={() => void load()}>Retry</Button></CardContent></Card>
      ) : items.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-muted"><Palette className="h-6 w-6 text-muted-foreground" /></div>
          <h3 className="font-semibold">{mode === "explore" ? "The first designs are waiting" : "Nothing here yet"}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{mode === "mine" ? "Publish your current profile design and build your creator catalogue." : mode === "purchased" ? "Designs you purchase will live here, ready to reapply." : mode === "review" ? "The review queue is clear." : "Try another category or search for a different style."}</p>
          {mode === "mine" || mode === "explore" ? <TactileButton className="mt-4" onClick={() => setCreateOpen(true)}>Publish a design</TactileButton> : null}
        </CardContent></Card>
      ) : (
        <motion.div layout className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const purchased = ownedIds.has(item.id)
              const previewCss = item.theme_tokens || {}
              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
                >
                  <button type="button" className="relative block aspect-[16/9] w-full overflow-hidden text-left" onClick={() => setSelected(item)}>
                    {item.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.cover_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="h-full w-full" style={{ background: cardGradient(item) }}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,.36),transparent_42%)]" />
                        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white">
                          <span className="text-2xl font-black tracking-tight">{item.title.slice(0, 18)}</span>
                          <Layers3 className="h-8 w-8 opacity-70" />
                        </div>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">{PRICE_LABELS[item.category] || "Profile design"}</span>
                    {item.featured ? <span className="absolute right-3 top-3 rounded-full bg-amber-300 px-2.5 py-1 text-[10px] font-bold text-black">FEATURED</span> : null}
                  </button>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold">{item.title_snapshot || item.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.summary || "A creator-made profile layout."}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{item.price_coins === 0 ? "Free" : money(item.price_coins) + " ◈"}</Badge>
                    </div>
                    {item.creator ? <p className="text-[11px] text-muted-foreground">by <span className="font-semibold text-foreground">{item.creator.display_name || "Creator"}</span> · @{item.creator.username}</p> : null}
                    <div className="flex items-center justify-between border-t border-border/70 pt-3">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {Number(item.rating_average || 0).toFixed(1)}</span>
                        <span>{money(item.purchase_count)} installs</span>
                        {item.status === "pending" ? <Badge variant="outline">Pending</Badge> : null}
                        {item.status === "rejected" ? <Badge variant="destructive">Needs edits</Badge> : null}
                      </div>
                      {mode === "purchased" ? (
                        <TactileButton size="sm" onClick={() => void apply(item)} disabled={applying === item.listing_id}>
                          {applying === item.listing_id ? "Applying…" : "Apply"}
                        </TactileButton>
                      ) : mode === "review" ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="rounded-full" disabled={moderating === item.id} onClick={() => void moderate(item, "rejected")}>Reject</Button>
                          <TactileButton size="sm" disabled={moderating === item.id} onClick={() => void moderate(item, "published")}>Approve</TactileButton>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setSelected(item)}>
                          {purchased ? "Owned" : "Details"} <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-24px)] max-w-xl overflow-y-auto rounded-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title_snapshot || selected.title}</DialogTitle>
                <DialogDescription>{selected.summary}</DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="h-36" style={{ background: cardGradient(selected) }} />
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{selected.category}</Badge>
                    <span className="text-sm font-bold tabular-nums">{Number(selected.price_coins) === 0 ? "Free" : money(selected.price_coins) + " Loop Coins"}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
                  {selected.creator ? <p className="text-xs text-muted-foreground">Created by {selected.creator.display_name} · @{selected.creator.username}</p> : null}
                  <p className="text-xs text-muted-foreground">{money(selected.purchase_count)} purchases · {Number(selected.rating_average || 0).toFixed(1)} / 5 rating</p>
                </div>
              </div>
              {ownedIds.has(selected.id) ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <TactileButton className="flex-1" onClick={() => { void apply(selected); setSelected(null) }} disabled={applying === selected.id}>Apply design</TactileButton>
                  <Button variant="outline" className="rounded-full" onClick={() => { setReviewRating(5); setReviewText("") }}>Close</Button>
                </div>
              ) : (
                <TactileButton block={true} onClick={() => void buy(selected)} disabled={purchasing === selected.id}>
                  <Wallet className="mr-2 h-4 w-4" /> {purchasing === selected.id ? "Purchasing…" : "Unlock design"}
                </TactileButton>
              )}
              {ownedIds.has(selected.id) ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold">Rate this design</p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((rating) => (
                      <button key={rating} type="button" onClick={() => setReviewRating(rating)} aria-label={rating + " stars"} className="rounded-md p-1.5 transition-colors hover:bg-muted">
                        <Star className={rating <= reviewRating ? "h-5 w-5 fill-amber-400 text-amber-400" : "h-5 w-5 text-muted-foreground"} />
                      </button>
                    ))}
                  </div>
                  <Textarea rows={3} maxLength={1000} value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="Share how the design works for you…" />
                  <Button type="button" size="sm" className="rounded-full" onClick={() => void sendReview()}>Submit review</Button>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-24px)] max-w-xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Publish a profile design</DialogTitle>
            <DialogDescription>Your current layout and profile CSS become the design package. Submissions are reviewed before going live.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold">Design name</label>
                <Input value={listingForm.title} onChange={(event) => setListingForm((state) => ({ ...state, title: event.target.value }))} maxLength={72} placeholder="Midnight editorial" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold">Short summary</label>
                <Input value={listingForm.summary} onChange={(event) => setListingForm((state) => ({ ...state, summary: event.target.value }))} maxLength={180} placeholder="A sharp, type-led creator profile." />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold">What makes it useful?</label>
                <Textarea rows={4} maxLength={1600} value={listingForm.description} onChange={(event) => setListingForm((state) => ({ ...state, description: event.target.value }))} placeholder="Describe the layout, sections, responsive behaviour and styling…" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Category</label>
                <select value={listingForm.category} onChange={(event) => setListingForm((state) => ({ ...state, category: event.target.value }))} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  {CATEGORIES.filter((entry) => entry.id !== "all").map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Price in Loop Coins</label>
                <Input type="number" min={0} max={100000} value={listingForm.price_coins} onChange={(event) => setListingForm((state) => ({ ...state, price_coins: event.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold">Tags (comma separated)</label>
                <Input value={listingForm.tags} onChange={(event) => setListingForm((state) => ({ ...state, tags: event.target.value }))} placeholder="minimal, monochrome, portfolio" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold">Preview image URL (optional)</label>
                <Input value={listingForm.cover_url} onChange={(event) => setListingForm((state) => ({ ...state, cover_url: event.target.value }))} placeholder="https://…" />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
              Creators receive 85% of each paid sale as Loop Coins. The platform keeps 15% for marketplace operations.
            </div>
            <TactileButton block onClick={() => void submitListing()} disabled={submitting}>
              <Upload className="mr-2 h-4 w-4" /> {submitting ? "Submitting…" : "Submit for review"}
            </TactileButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
