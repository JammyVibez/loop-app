"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bot,
  Coins,
  Loader2,
  Palette,
  Plus,
  Search,
  ShoppingBag,
  Zap,
  Wand2,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ListingType = "design" | "styling" | "bot"

interface MarketplaceListing {
  id: string
  listing_type: ListingType
  title: string
  description?: string | null
  price_coins: number
  tags?: string[]
  payload?: Record<string, any>
  sales_count?: number
  is_owned?: boolean
  is_seller?: boolean
  seller?: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
  } | null
}

const TYPE_META: Record<ListingType | "all", { label: string; icon: typeof Palette; blurb: string }> = {
  all: { label: "All", icon: Zap, blurb: "Community designs, styling packs, and bot logic" },
  design: { label: "Designs", icon: Palette, blurb: "Full community look & layout packs" },
  styling: { label: "Styling", icon: Wand2, blurb: "Component tokens, fonts, and UI accents" },
  bot: { label: "Bots", icon: Bot, blurb: "Automation logic for seamless circle activity" },
}

function defaultPayload(type: ListingType) {
  if (type === "bot") {
    return {
      bot_type: "welcome",
      name: "Community Host Bot",
      configuration: { tone: "warm", auto_reply: true },
      triggers: ["member_join", "daily_checkin"],
      messages: {
        welcome: "Welcome to the circle — introduce yourself and pick a role!",
        checkin: "Drop your daily win below 👇",
      },
      logic: { cooldown_minutes: 30, max_replies_per_hour: 20 },
    }
  }
  if (type === "styling") {
    return {
      css_variables: {
        "--circle-accent": "#22d3ee",
        "--circle-surface": "#0b1220",
        "--circle-radius": "1rem",
        "--circle-font": "Space Grotesk",
      },
      button_style: "pill",
      card_style: "glass",
    }
  }
  return {
    layout: "immersive-hero",
    colors: { primary: "#7c3aed", secondary: "#22d3ee", background: "#030712" },
    header_style: "gradient-blur",
    components: { feed: "timeline", sidebar: "activity-rail" },
  }
}

export function CommunityMarketplace() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<"all" | ListingType>("all")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sellOpen, setSellOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState<MarketplaceListing | null>(null)
  const [circles, setCircles] = useState<Array<{ id: string; name: string }>>([])
  const [selectedCircle, setSelectedCircle] = useState("")
  const [draft, setDraft] = useState({
    listing_type: "design" as ListingType,
    title: "",
    description: "",
    price_coins: "150",
    tags: "",
    source_code: "",
    layout: "immersive-hero",
  })

  const loadListings = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type, sortBy })
      if (search.trim()) params.set("search", search.trim())
      const response = await fetch(`/api/marketplace?${params.toString()}`, {
        headers: user ? getAuthHeader() : undefined,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load marketplace")
      setListings(data.listings || [])
    } catch (error: any) {
      toast({ title: "Marketplace unavailable", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadListings()
  }, [type, sortBy, user?.id])

  useEffect(() => {
    const timer = setTimeout(() => loadListings(), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filteredBlurb = useMemo(() => TYPE_META[type].blurb, [type])

  const purchase = async (listing: MarketplaceListing) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Log in to buy marketplace packs." })
      return
    }
    setBusyId(listing.id)
    try {
      const response = await fetch(`/api/marketplace/${listing.id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Purchase failed")
      toast({
        title: data.already_owned ? "Already owned" : "Unlocked!",
        description: data.already_owned
          ? "You already own this pack."
          : `“${listing.title}” is ready to install on a circle.`,
      })
      await refreshUser()
      await loadListings()
      setInstallOpen({ ...listing, is_owned: true })
    } catch (error: any) {
      toast({ title: "Purchase failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const openInstall = async (listing: MarketplaceListing) => {
    if (!user) return
    setInstallOpen(listing)
    setSelectedCircle("")
    try {
      const response = await fetch("/api/circles?mine=true", { headers: getAuthHeader() })
      const data = await response.json()
      const mine = (data.circles || data || [])
        .map((c: any) => ({ id: c.id, name: c.name }))
        .filter((c: any) => c.id && c.name)
      setCircles(mine)
    } catch {
      setCircles([])
    }
  }

  const install = async () => {
    if (!installOpen || !selectedCircle) return
    setBusyId(installOpen.id)
    try {
      const response = await fetch(`/api/marketplace/${installOpen.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ circle_id: selectedCircle }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Install failed")
      toast({
        title: "Installed",
        description: `“${installOpen.title}” is live on your circle.`,
      })
      setInstallOpen(null)
    } catch (error: any) {
      toast({ title: "Install failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const createListing = async () => {
    if (!user) return
    if (!draft.title.trim()) {
      toast({ title: "Title required", variant: "destructive" })
      return
    }
    setBusyId("create")
    try {
      let payload: Record<string, any> = defaultPayload(draft.listing_type)
      if (draft.source_code.trim()) {
        try {
          const parsed = JSON.parse(draft.source_code)
          payload = { ...payload, ...parsed, source_code: draft.source_code }
        } catch {
          payload = { ...payload, source_code: draft.source_code, layout: draft.layout }
        }
      } else if (draft.listing_type === "design") {
        payload = { ...payload, layout: draft.layout }
      }

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          listing_type: draft.listing_type,
          title: draft.title.trim(),
          description: draft.description.trim(),
          price_coins: Number(draft.price_coins) || 0,
          tags: draft.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          payload,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to publish")
      toast({ title: "Listed", description: "Your pack is live in the marketplace." })
      setSellOpen(false)
      setDraft({
        listing_type: "design",
        title: "",
        description: "",
        price_coins: "150",
        tags: "",
        source_code: "",
        layout: "immersive-hero",
      })
      await loadListings()
    } catch (error: any) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
            Community Marketplace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sell & install community packs</h1>
          <p className="max-w-2xl text-muted-foreground">{filteredBlurb}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/developers/community-layouts">Developer docs</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/shop">
              <Coins className="mr-2 h-4 w-4 text-yellow-500" />
              {user ? `${user.loop_coins.toLocaleString()} coins` : "Shop coins"}
            </Link>
          </Button>
          {user && (
            <Button className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white" onClick={() => setSellOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Sell a pack
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={type} onValueChange={(v) => setType(v as any)} className="w-full lg:w-auto">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            {(Object.keys(TYPE_META) as Array<keyof typeof TYPE_META>).map((key) => {
              const Icon = TYPE_META[key].icon
              return (
                <TabsTrigger key={key} value={key} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {TYPE_META[key].label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search designs, styling, bots..."
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="popular">Most installed</SelectItem>
              <SelectItem value="price-low">Price: Low</SelectItem>
              <SelectItem value="price-high">Price: High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading marketplace...
        </div>
      ) : listings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">No packs yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Be the first to publish a community design, styling kit, or bot logic pack.
            </p>
            {user && (
              <Button onClick={() => setSellOpen(true)} className="mt-2 rounded-full">
                Publish your first pack
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => {
            const meta = TYPE_META[listing.listing_type]
            const Icon = meta.icon
            return (
              <Card key={listing.id} className="overflow-hidden border-border/80 bg-card/80 backdrop-blur">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="secondary" className="gap-1">
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Coins className="h-4 w-4 text-yellow-500" />
                      {listing.price_coins === 0 ? "Free" : listing.price_coins.toLocaleString()}
                    </div>
                  </div>
                  <CardTitle className="text-xl leading-tight">{listing.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {listing.description || "Community pack for seamless circle activity."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={listing.seller?.avatar_url || undefined} />
                      <AvatarFallback>{(listing.seller?.display_name || "C").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>@{listing.seller?.username || "creator"}</span>
                    <span className="ml-auto text-xs">{listing.sales_count || 0} sales</span>
                  </div>
                  {!!listing.tags?.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {listing.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="outline" className="font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {listing.is_owned || listing.is_seller ? (
                      <Button className="flex-1 rounded-full" onClick={() => openInstall(listing)}>
                        Install to circle
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
                        disabled={busyId === listing.id}
                        onClick={() => purchase(listing)}
                      >
                        {busyId === listing.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy & unlock"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sell a community pack</DialogTitle>
            <DialogDescription>
              Publish a design, component styling kit, or bot-creation logic pack for other communities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={draft.listing_type}
                onValueChange={(v) => setDraft((d) => ({ ...d, listing_type: v as ListingType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="design">Community design</SelectItem>
                  <SelectItem value="styling">Component styling</SelectItem>
                  <SelectItem value="bot">Bot creation logic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Neon Night Circle Kit"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="What does this pack unlock for a community?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Price (coins)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.price_coins}
                  onChange={(e) => setDraft((d) => ({ ...d, price_coins: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  value={draft.tags}
                  onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                  placeholder="welcome, neon, calm"
                />
              </div>
            </div>
            {draft.listing_type === "design" && (
              <div className="space-y-2">
                <Label>Layout preset</Label>
                <Select value={draft.layout} onValueChange={(v) => setDraft((d) => ({ ...d, layout: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immersive-hero">Immersive hero</SelectItem>
                    <SelectItem value="cinematic">Cinematic</SelectItem>
                    <SelectItem value="forum">Forum</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Upload layout / styling / bot code (JSON or text)</Label>
              <Input
                type="file"
                accept=".json,.js,.ts,.tsx,.css,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const text = await file.text()
                  setDraft((d) => ({ ...d, source_code: text }))
                }}
              />
              <Textarea
                value={draft.source_code}
                onChange={(e) => setDraft((d) => ({ ...d, source_code: e.target.value }))}
                placeholder='Paste JSON payload, e.g. {"layout":"forum","colors":{"primary":"#7c3aed","secondary":"#22d3ee"},"css_variables":{"--circle-accent":"#22d3ee"}}'
                className="min-h-[120px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                See the{" "}
                <Link href="/developers/community-layouts" className="underline">
                  community layout docs
                </Link>{" "}
                for the supported schema.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createListing} disabled={busyId === "create"}>
              {busyId === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish pack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!installOpen} onOpenChange={(open) => !open && setInstallOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install “{installOpen?.title}”</DialogTitle>
            <DialogDescription>
              Choose a circle you admin. Designs/styling update community settings; bots install into circle automation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Circle</Label>
            <Select value={selectedCircle} onValueChange={setSelectedCircle}>
              <SelectTrigger>
                <SelectValue placeholder={circles.length ? "Select a circle" : "No admin circles found"} />
              </SelectTrigger>
              <SelectContent>
                {circles.map((circle) => (
                  <SelectItem key={circle.id} value={circle.id}>
                    {circle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(null)}>
              Cancel
            </Button>
            <Button onClick={install} disabled={!selectedCircle || busyId === installOpen?.id}>
              {busyId === installOpen?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Install"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
