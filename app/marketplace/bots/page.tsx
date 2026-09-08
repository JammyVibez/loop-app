"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  Bot,
  Loader2,
  Search,
  Star,
  Coins,
  Check,
  Copy,
  Store,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Server,
  Code2,
} from "lucide-react"

const CATEGORY_META: Record<string, { label: string; color: string; chip: string }> = {
  moderation: { label: "Moderation", color: "text-rose-500", chip: "bg-rose-500/10 border-rose-500/25" },
  welcome: { label: "Welcome", color: "text-emerald-500", chip: "bg-emerald-500/10 border-emerald-500/25" },
  notification: { label: "Notifications", color: "text-amber-500", chip: "bg-amber-500/10 border-amber-500/25" },
  ecommerce: { label: "Store", color: "text-orange-500", chip: "bg-orange-500/10 border-orange-500/25" },
  utility: { label: "Utility", color: "text-sky-500", chip: "bg-sky-500/10 border-sky-500/25" },
  ai: { label: "AI", color: "text-violet-500", chip: "bg-violet-500/10 border-violet-500/25" },
  games: { label: "Games", color: "text-fuchsia-500", chip: "bg-fuchsia-500/10 border-fuchsia-500/25" },
  custom: { label: "Custom", color: "text-slate-400", chip: "bg-slate-400/10 border-slate-400/25" },
}

interface MarketplaceBot {
  id: string
  community_id: string
  community_name?: string | null
  owner_id: string
  name: string
  description?: string | null
  avatar_url?: string | null
  category: string
  status: string
  deployment_type: string
  webhook_url?: string | null
  invite_link?: string | null
  source_url?: string | null
  commands: string[]
  price_coins: number
  allows_hosted: boolean
  allows_source: boolean
  rating_avg: number
  rating_count: number
  purchase_count: number
  purchased_types?: string[]
  installed?: boolean
  owner?: { id: string; username: string; display_name?: string; avatar_url?: string | null; is_verified?: boolean } | null
}

function Stars({ rating, count }: { rating: number; count: number }) {
  return (
    <span className="flex items-center gap-1 text-[11px]">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="font-bold text-foreground">{rating || "—"}</span>
      <span className="text-muted-foreground">({count})</span>
    </span>
  )
}

function RatingStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} type="button" onClick={() => onChange(v)} className="transition hover:scale-110">
          <Star className={cn("h-6 w-6", v <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  )
}

export default function BotMarketplacePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [bots, setBots] = useState<MarketplaceBot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [category, setCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [buyBot, setBuyBot] = useState<MarketplaceBot | null>(null)
  const [purchaseType, setPurchaseType] = useState<"hosted" | "source">("hosted")
  const [buying, setBuying] = useState(false)
  const [result, setResult] = useState<{ delivery: string; purchase_type: string; price: number; new_balance: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [rateBot, setRateBot] = useState<MarketplaceBot | null>(null)
  const [rateValue, setRateValue] = useState(0)
  const [ratingSent, setRatingSent] = useState(false)
  const [installBot, setInstallBot] = useState<MarketplaceBot | null>(null)
  const [communities, setCommunities] = useState<Array<{ id: string; name: string; user_role?: string }>>([])
  const [communityId, setCommunityId] = useState("")
  const [loadingCommunities, setLoadingCommunities] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState("")
  const [installDone, setInstallDone] = useState<{ communityId: string; communityName?: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (category !== "all") params.set("category", category)
      if (search.trim()) params.set("search", search.trim())
      const res = await fetch(`/api/marketplace/bots?${params}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load marketplace")
      setBots(data.bots || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [category, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load])

  const categories = useMemo(() => ["all", ...Object.keys(CATEGORY_META)], [])

  const openInstall = async (bot: MarketplaceBot) => {
    setInstallBot(bot)
    setInstallDone(null)
    setInstallError("")
    setCommunityId("")
    setBuyBot(null)
    setResult(null)
    setLoadingCommunities(true)
    try {
      const res = await fetch("/api/circles?mine=true&limit=50", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      const list = (data.communities || data.circles || [])
        .map((c: any) => ({ id: String(c.id), name: c.name || c.handle || "Untitled community", user_role: c.user_role }))
      setCommunities(list)
    } catch {
      setCommunities([])
    } finally {
      setLoadingCommunities(false)
    }
  }

  const runInstall = async () => {
    if (!installBot) return
    if (!communityId) return setInstallError("Pick a community to install into")
    setInstalling(true)
    setInstallError("")
    try {
      const res = await fetch(`/api/marketplace/bots/${installBot.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ community_id: communityId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Install failed")
      const target = communities.find((c) => String(c.id) === String(communityId))
      setInstallDone({ communityId, communityName: target?.name })
      load()
    } catch (e: any) {
      setInstallError(e.message)
    } finally {
      setInstalling(false)
    }
  }

  const buy = async () => {
    if (!user) {
      router.push("/auth?returnTo=/marketplace/bots")
      return
    }
    if (!buyBot) return
    setBuying(true)
    try {
      const res = await fetch("/api/marketplace/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: buyBot.id, purchase_type: purchaseType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Purchase failed")
      setResult({ delivery: data.delivery, purchase_type: data.purchase_type, price: data.purchase.price_coins, new_balance: data.new_balance })
    } catch (e: any) {
      setError(e.message)
      setTimeout(() => setError(""), 3500)
    } finally {
      setBuying(false)
    }
  }

  const submitRating = async () => {
    if (!rateBot || !rateValue) return
    const res = await fetch(`/api/bots/${rateBot.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: rateValue }),
    })
    if (res.ok) {
      setRatingSent(true)
      setTimeout(() => { setRateBot(null); setRatingSent(false); setRateValue(0) }, 1200)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-indigo-950/70 via-background to-fuchsia-950/50">
        <div className="pointer-events-none absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-16 right-1/4 h-56 w-56 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 rounded-full text-xs">
            <Link href="/communities">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Communities
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-fuchsia-500/30">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Bot Marketplace</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Buy usage rights and source code with Loop Coins — creators keep ownership, always.
              </p>
            </div>
          </div>
          {user && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-500">
              <Coins className="h-3.5 w-3.5" /> {user.loop_coins ?? 0} Loop Coins
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-5">
        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bots…" className="h-10 rounded-full pl-9 text-sm" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                  category === c ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "all" ? "All" : CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-full" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">Nothing listed here yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Be the first — deploy a bot in your community, then open Manage &gt; Bot Marketplace to list it for Loop Coins.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bots.map((bot) => {
              const meta = CATEGORY_META[bot.category] || CATEGORY_META.custom
              return (
                <div
                  key={bot.id}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-fuchsia-500/40 hover:shadow-xl hover:shadow-fuchsia-500/10"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-start gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/20">
                      {bot.avatar_url ? (
                        <Image src={bot.avatar_url} alt="" fill unoptimized className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white">
                          <Bot className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">{bot.name}</p>
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", bot.status === "online" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-slate-600")} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>by @{bot.owner?.username}</span>
                        {bot.community_name && <span className="truncate">· {bot.community_name}</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Stars rating={bot.rating_avg} count={bot.rating_count} />
                        <span className="text-[10px] text-muted-foreground">· {bot.purchase_count} sold</span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 min-h-[2rem] text-xs text-muted-foreground">
                    {bot.description || "No description yet"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.chip, meta.color)}>{meta.label}</span>
                    {bot.allows_hosted && (
                      <span className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-500">
                        <Server className="h-2.5 w-2.5" /> Hosted
                      </span>
                    )}
                    {bot.allows_source && (
                      <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-500">
                        <Code2 className="h-2.5 w-2.5" /> Source
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-extrabold text-amber-500">
                      <Coins className="h-4 w-4" /> {bot.price_coins.toLocaleString()}
                    </span>
                    {bot.installed ? (
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-500">
                        <Check className="h-3.5 w-3.5" /> Installed
                      </span>
                    ) : bot.purchased_types && bot.purchased_types.length > 0 ? (
                      <Button
                        size="sm"
                        className="h-8 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20"
                        onClick={() => openInstall(bot)}
                      >
                        <Zap className="h-3.5 w-3.5 mr-1" /> Install in a community
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 text-xs text-white hover:from-indigo-400 hover:to-fuchsia-400"
                        onClick={() => { setPurchaseType(bot.allows_hosted ? "hosted" : "source"); setBuyBot(bot); setResult(null) }}
                      >
                        <Zap className="h-3.5 w-3.5 mr-1" /> Buy with Coins
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Buy dialog */}
      <Dialog open={Boolean(buyBot)} onOpenChange={(o) => { if (!o) setBuyBot(null) }}>
        <DialogContent className="max-w-md">
          {result ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-500">
                  <Check className="h-5 w-5" /> Purchase complete!
                </DialogTitle>
                <DialogDescription>
                  {result.purchase_type === "source" ? "Source code delivered" : "Hosted access granted"} — your new balance is{" "}
                  <b className="text-amber-500">{result.new_balance.toLocaleString()} coins</b>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Delivery</p>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="whitespace-pre-wrap text-xs leading-relaxed">{result.delivery}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => { navigator.clipboard.writeText(result.delivery); setCopied(true) }}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copied ? "Copied" : "Copy delivery info"}
                </Button>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <p className="text-xs font-semibold text-emerald-500">Ready to use it?</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Install {buyBot?.name} into one of your communities — it becomes live in its Bots tab instantly.
                </p>
                <Button
                  size="sm"
                  className="mt-2.5 w-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400"
                  onClick={() => buyBot && openInstall(buyBot)}
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" /> Install now
                </Button>
              </div>
              <DialogFooter>
                <Button className="rounded-full" onClick={() => { setBuyBot(null); setResult(null); load() }}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-amber-500" /> Buy {buyBot?.name}
                </DialogTitle>
                <DialogDescription>
                  Buying grants usage/source rights. <b>Ownership stays with the creator</b> — you can never be charged for
                  access that isn&apos;t yours.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <button
                  onClick={() => setPurchaseType("hosted")}
                  disabled={!buyBot?.allows_hosted}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                    purchaseType === "hosted" ? "border-cyan-500/60 bg-cyan-500/10" : "border-border hover:border-cyan-500/30",
                    !buyBot?.allows_hosted && "opacity-40",
                  )}
                >
                  <Server className="h-5 w-5 text-cyan-500" />
                  <div className="flex-1">
                    <p className="text-xs font-bold">Hosted Access</p>
                    <p className="text-[10px] text-muted-foreground">Creator keeps hosting — you use it in your community.</p>
                  </div>
                  {purchaseType === "hosted" && <Check className="h-4 w-4 text-cyan-500" />}
                </button>
                <button
                  onClick={() => setPurchaseType("source")}
                  disabled={!buyBot?.allows_source}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                    purchaseType === "source" ? "border-violet-500/60 bg-violet-500/10" : "border-border hover:border-violet-500/30",
                    !buyBot?.allows_source && "opacity-40",
                  )}
                >
                  <Code2 className="h-5 w-5 text-violet-500" />
                  <div className="flex-1">
                    <p className="text-xs font-bold">Source Code</p>
                    <p className="text-[10px] text-muted-foreground">Get the repo + instructions and self-host it.</p>
                  </div>
                  {purchaseType === "source" && <Check className="h-4 w-4 text-violet-500" />}
                </button>
                <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-500">
                    <Coins className="h-4 w-4" /> {buyBot?.price_coins.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Balance: {user ? (user.loop_coins ?? 0).toLocaleString() : "sign in"}
                  </span>
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <DialogFooter>
                <Button variant="outline" className="rounded-full" onClick={() => setBuyBot(null)} disabled={buying}>Cancel</Button>
                <Button
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white"
                  onClick={buy}
                  disabled={buying || !user}
                >
                  {buying ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />}
                  {user ? "Confirm purchase" : "Sign in to buy"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Rating dialog */}
      <Dialog open={Boolean(rateBot)} onOpenChange={(o) => { if (!o) { setRateBot(null); setRatingSent(false); setRateValue(0) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rate {rateBot?.name}</DialogTitle>
            <DialogDescription>Your rating helps other communities find great bots.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <RatingStars value={rateValue} onChange={setRateValue} />
          </div>
          {ratingSent && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
              <Check className="h-3.5 w-3.5" /> Thanks for rating!
            </p>
          )}
          <DialogFooter>
            <Button className="rounded-full" onClick={submitRating} disabled={!rateValue || ratingSent}>
              Submit rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install dialog — pick a community for the purchased bot */}
      <Dialog open={Boolean(installBot)} onOpenChange={(o) => { if (!o) { setInstallBot(null); setInstallDone(null); setCommunities([]) } }}>
        <DialogContent className="max-w-md">
          {installDone ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-500">
                  <Check className="h-5 w-5" /> {installBot?.name} is live!
                </DialogTitle>
                <DialogDescription>
                  Installed into <b>{installDone.communityName || "your community"}</b>. Members can find it in the Bots tab.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button asChild className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">
                  <Link href={`/communities/${installDone.communityId}?tab=bots`}>
                    <Bot className="h-4 w-4 mr-1.5" /> Open community Bots
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => { setInstallBot(null); setInstallDone(null); setCommunities([]); load() }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-500" /> Install {installBot?.name}
                </DialogTitle>
                <DialogDescription>
                  Pick one of your communities. {installBot?.name} will go live in its Bots tab right away — the original
                  listing and its creator keep full ownership.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {loadingCommunities ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : communities.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
                    <Bot className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 text-xs font-bold">No communities to install into</p>
                    <p className="mx-auto mt-1 max-w-[240px] text-[11px] text-muted-foreground">
                      You need to own or moderate a community first — create one, then come back to install.
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-3 rounded-full">
                      <Link href="/communities/create" onClick={() => setInstallBot(null)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Create a community
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {communities.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCommunityId(String(c.id))}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                          String(c.id) === String(communityId)
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-border hover:border-emerald-500/30",
                        )}
                      >
                        <span className="min-w-0 truncate text-xs font-bold">{c.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {c.user_role === "owner" ? "Owner" : c.user_role === "admin" ? "Admin" : "Mod"}
                          {String(c.id) === String(communityId) && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {installError && <p className="text-xs text-red-500">{installError}</p>}
              <DialogFooter>
                <Button variant="outline" className="rounded-full" onClick={() => setInstallBot(null)} disabled={installing}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
                  onClick={runInstall}
                  disabled={installing || !communityId || communities.length === 0}
                >
                  {installing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />}
                  Install bot
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer hint */}
      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 to-fuchsia-950/30 p-5 text-center sm:flex-row sm:text-left">
          <ShieldCheck className="h-8 w-8 shrink-0 text-emerald-400" />
          <div className="flex-1">
            <p className="text-sm font-bold">Built on trust</p>
            <p className="text-xs text-muted-foreground">
              Creators keep full ownership and a secret management key. Every purchase is an escrow-protected coin transfer —
              you only ever buy usage rights or source code.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/communities">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Find communities
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}