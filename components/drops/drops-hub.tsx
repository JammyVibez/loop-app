"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight, CalendarDays, CircleDot, Clock3, Flame, Gift, Radio, RefreshCw, Search, Users, Zap } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { rustApiRequest } from "@/lib/rust-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ProxyImg } from "@/components/ui/proxy-img"
import { AnimatedIconView } from "@/components/icons/animated/animated-icon-view"
import FlameIcon from "@/components/icons/animated/flame-icon"

type DropKind = "event" | "challenge"
type DropFilter = "all" | "live" | "upcoming" | "event" | "challenge"

interface DropItem {
  id: string
  kind: DropKind
  source: string
  title: string
  description: string
  category: string
  starts_at: string | null
  ends_at: string | null
  status: "live" | "upcoming" | "active" | "ended"
  is_live: boolean
  image_url: string | null
  participants_count: number
  reward_coins: number
  circle_id: string | null
  circle_name: string | null
  action_url: string
  created_at: string
}

interface DropsResponse {
  success: boolean
  items: DropItem[]
  total: number
  live_count: number
  challenge_count: number
  event_count: number
}

const FILTERS: Array<{ value: DropFilter; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "live", label: "Live now" },
  { value: "upcoming", label: "Coming up" },
  { value: "challenge", label: "Challenges" },
  { value: "event", label: "Events" },
]

function formatDropTime(value: string | null, status: DropItem["status"]): string {
  if (status === "live") return "Live now"
  if (status === "active") return "Open now"
  if (!value) return "Time to be announced"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Time to be announced"

  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString() === date.toDateString()
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  if (sameDay) return `Today · ${time}`
  if (tomorrow) return `Tomorrow · ${time}`
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`
}

function DropCard({ item }: { item: DropItem }) {
  const isChallenge = item.kind === "challenge"
  const sourceLabel = item.source === "official_event"
    ? "LOOP official"
    : item.source === "circle_challenge"
      ? "Circle challenge"
      : item.circle_name || "Community activity"

  return (
    <Card className="group overflow-hidden rounded-2xl border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-black/5">
      {item.image_url ? (
        <div className="relative aspect-[16/7] overflow-hidden bg-muted">
          <ProxyImg
            src={item.image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge className={item.is_live ? "border-0 bg-rose-500 text-white" : "border border-white/20 bg-black/55 text-white"}>
              {item.is_live ? <Radio className="mr-1 h-3 w-3" /> : isChallenge ? <Zap className="mr-1 h-3 w-3" /> : <CalendarDays className="mr-1 h-3 w-3" />}
              {item.is_live ? "LIVE" : isChallenge ? "CHALLENGE" : "EVENT"}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="relative flex h-24 items-start justify-between overflow-hidden bg-gradient-to-br from-primary/15 via-muted/60 to-cyan-500/10 p-4">
          <div className="absolute -right-5 -top-8 h-32 w-32 rounded-full border border-current/10" />
          <div className="absolute -right-1 -top-2 h-20 w-20 rounded-full border border-current/10" />
          <Badge variant="secondary" className="relative z-10 rounded-full">
            {item.is_live ? "LIVE" : isChallenge ? "CHALLENGE" : "EVENT"}
          </Badge>
          <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-background/75 text-primary shadow-sm">
            {isChallenge ? <Zap className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
          </span>
        </div>
      )}

      <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{sourceLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{item.category}</span>
          </div>
          <h2 className="line-clamp-2 text-lg font-semibold tracking-tight">{item.title}</h2>
          {item.description ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isChallenge ? "Join the Circle and add your contribution." : "Open the activity to see details and take part."}
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {isChallenge
              ? item.ends_at
                ? `Closes ${formatDropTime(item.ends_at, "upcoming")}`
                : "Open challenge"
              : formatDropTime(item.starts_at, item.status)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {item.participants_count} {isChallenge ? "entries" : "participants"}
          </span>
          {item.reward_coins > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Gift className="h-3.5 w-3.5" />
              {item.reward_coins.toLocaleString()} Loop Coins
            </span>
          ) : null}
        </div>

        <Link
          href={item.action_url}
          className="loop-tactile inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isChallenge ? "View challenge" : "Open activity"}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}

export function DropsHub() {
  const { user, loading: authLoading, getAuthHeader } = useAuth()
  const router = useRouter()
  const [response, setResponse] = useState<DropsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<DropFilter>("all")
  const [search, setSearch] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  const loadDrops = useCallback(async (silent = false) => {
    if (!user) {
      setResponse(null)
      setLoading(false)
      return
    }

    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const data = await rustApiRequest<DropsResponse>("drops?limit=60", {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      setResponse(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Drops.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getAuthHeader, user])

  useEffect(() => {
    if (!authLoading) void loadDrops()
  }, [authLoading, loadDrops])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()

    return (response?.items || []).filter((item) => {
      if (activeFilter === "live" && !item.is_live) return false
      if (activeFilter === "upcoming" && item.status !== "upcoming") return false
      if (activeFilter === "event" && item.kind !== "event") return false
      if (activeFilter === "challenge" && item.kind !== "challenge") return false
      if (!query) return true

      return [
        item.title,
        item.description,
        item.category,
        item.circle_name || "",
        item.source,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [activeFilter, response?.items, search])

  if (authLoading || loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-[310px] animate-pulse rounded-2xl border border-border/60 bg-muted/35" />
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Flame className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Drops are better with your Circles</h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Sign in to see activity from your communities, join challenges and keep up with events.
            </p>
          </div>
          <Button onClick={() => router.push("/login?redirect=/drops")}>Sign in to explore Drops</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-cyan-500/10 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border border-primary/10" />
        <div className="pointer-events-none absolute -right-3 -top-7 h-36 w-36 rounded-full border border-primary/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <AnimatedIconView component={FlameIcon} size={16} />
              Participate in something
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">There’s always something happening.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Live stages, upcoming events and community challenges from the Circles you’re part of — all in one place.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/communities" className="loop-tactile inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background/80 px-4 text-sm font-medium hover:bg-background">
              <CircleDot className="h-4 w-4" />
              Find Circles
            </Link>
            <Link href="/events" className="loop-tactile inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Browse events
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
          {response ? (
            <div className="flex flex-wrap gap-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{response.live_count}</strong> live</span>
              <span><strong className="text-foreground">{response.event_count}</strong> events</span>
              <span><strong className="text-foreground">{response.challenge_count}</strong> challenges</span>
            </div>
          ) : null}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={activeFilter === filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeFilter === filter.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find something…"
              className="h-10 rounded-xl pl-9"
              aria-label="Search Drops"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => void loadDrops(true)} disabled={refreshing} aria-label="Refresh Drops">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="rounded-2xl border-destructive/30">
          <CardContent className="flex flex-col items-start gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold">Drops couldn’t load</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => void loadDrops()}>Try again</Button>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Zap className="h-5 w-5" />
            </span>
            <h3 className="font-semibold">{search || activeFilter !== "all" ? "No matching Drops" : "Nothing on the board yet"}</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {search || activeFilter !== "all"
                ? "Try another filter or search term."
                : "Join a Circle or check back later. New events and challenges will show up here automatically."}
            </p>
            <Link href="/communities" className="text-sm font-semibold text-primary hover:underline">Explore Circles</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => <DropCard key={`${item.source}:${item.id}`} item={item} />)}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{filteredItems.length} {filteredItems.length === 1 ? "activity" : "activities"} shown</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Synced from Events and Circle Challenges
        </span>
      </div>
    </div>
  )
}
