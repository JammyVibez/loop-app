"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, Radio, Search, Tv, Zap } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

interface Stream {
  id: string
  title: string
  description: string
  thumbnail_url: string
  viewer_count: number
  status: string
  category: string
  tags: string[]
  created_at: string
  streamer: {
    id: string
    username: string
    display_name: string
    avatar_url: string
    is_verified: boolean
    is_premium: boolean
  }
}

const CATEGORIES = [
  { id: "all", label: "For You" },
  { id: "gaming", label: "Gaming" },
  { id: "music", label: "Music" },
  { id: "art", label: "Art" },
  { id: "tech", label: "Tech" },
  { id: "education", label: "Learn" },
  { id: "lifestyle", label: "Life" },
  { id: "entertainment", label: "Fun" },
]

function formatViewers(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count || 0)
}

export default function StreamsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [activeTab, setActiveTab] = useState<"live" | "recent" | "popular">("live")

  useEffect(() => {
    let cancelled = false
    const fetchStreams = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          status: activeTab,
          ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
          limit: "30",
        })
        const response = await fetch(`/api/streams?${params}`, { cache: "no-store" })
        if (response.ok) {
          const data = await response.json()
          if (!cancelled) setStreams(data.data?.streams || [])
        }
      } catch {
        if (!cancelled) toast({ title: "Could not load lives", variant: "destructive" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchStreams()
    // Polling every 20s as a fallback (viewer counts drift, etc.)
    const t = window.setInterval(() => void fetchStreams(), 20000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [activeTab, selectedCategory, toast])

  // Realtime: a creator going live / ending shows up instantly without a poll
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`streams-browse-${activeTab}-${selectedCategory}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_streams" },
        () => {
          // Debounce: a burst of go-live events shouldn't spam the API
          window.setTimeout(() => void (async () => {
            const params = new URLSearchParams({
              status: activeTab,
              ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
              limit: "30",
            })
            const response = await fetch(`/api/streams?${params}`, { cache: "no-store" })
            if (response.ok) {
              const data = await response.json()
              setStreams(data.data?.streams || [])
            }
          })(), 400)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_streams" },
        () => {
          // Status flips (preparing -> live, live -> ended), viewer count
          // changes, etc. — debounce a refetch so the tab always reflects
          // the current state (e.g. ended streams leave the Live tab).
          window.setTimeout(() => void (async () => {
            const params = new URLSearchParams({
              status: activeTab,
              ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
              limit: "30",
            })
            const response = await fetch(`/api/streams?${params}`, { cache: "no-store" })
            if (response.ok) {
              const data = await response.json()
              setStreams(data.data?.streams || [])
            }
          })(), 400)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeTab, selectedCategory])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return streams
    return streams.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.streamer?.username?.toLowerCase().includes(q) ||
        s.streamer?.display_name?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q),
    )
  }, [streams, searchQuery])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              LIVE NOW
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Audio Rooms</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Listen in real time — chat, react, send gifts, and join the conversation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/channels">
              <Button
                variant="outline"
                className="h-11 rounded-full border-border bg-card px-5 font-semibold text-foreground hover:bg-accent hover:text-foreground"
              >
                <Tv className="mr-2 h-4 w-4" />
                Channels
              </Button>
            </Link>
            <Link href={user ? "/create/stream" : "/login"}>
              <Button className="h-11 rounded-full px-6 font-bold">
                <Radio className="mr-2 h-4 w-4" />
                Go Live
              </Button>
            </Link>
          </div>
        </div>

        <form
          className="relative mb-4"
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lives, creators, categories…"
            className="h-11 rounded-full border-border bg-card pl-10 text-foreground placeholder:text-muted-foreground"
          />
        </form>

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {(["live", "popular", "recent"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold capitalize",
                activeTab === tab ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold",
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            <Spinner className="mr-2 h-5 w-5" /> Loading audio rooms…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
            <Zap className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-lg font-semibold">No audio rooms right now</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Be the first to open a room — talk with listeners, take questions and send gifts.
            </p>
            <Link href={user ? "/create/stream" : "/login"}>
              <Button className="rounded-full">Start an audio room</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((stream) => (
              <Link
                key={stream.id}
                href={`/streams/${stream.id}`}
                className={`group relative aspect-[9/14] overflow-hidden rounded-2xl ${stream.thumbnail_url ? "bg-zinc-900" : "border border-border bg-card"}`}
              >
                {stream.thumbnail_url ? (
                  <img
                    src={stream.thumbnail_url}
                    alt={stream.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-card">
                    <Radio className="h-10 w-10 text-primary/60" />
                  </div>
                )}
                {stream.thumbnail_url ? (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
                ) : null}
                <div className="absolute left-2 top-2 flex items-center gap-1.5">
                  {stream.status === "live" ? (
                    <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-black tracking-wide">
                      LIVE
                    </span>
                  ) : (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {stream.status}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur ${stream.thumbnail_url ? "bg-black/50 text-white" : "border border-border bg-background/80 text-muted-foreground"}`}>
                    <Eye className="h-3 w-3" />
                    {formatViewers(stream.viewer_count)}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="line-clamp-2 text-sm font-bold leading-snug">{stream.title}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <VideoAvatar
                      src={stream.streamer?.avatar_url}
                      videoSrc={(stream.streamer as any)?.video_avatar_url}
                      isPremium={(stream.streamer as any)?.is_premium}
                      fallback={stream.streamer?.display_name?.[0] || "?"}
                      size="sm"
                      className="h-6 w-6 border border-white/20 rounded-full"
                    />
                    <p className={`truncate text-xs ${stream.thumbnail_url ? "text-white/80" : "text-muted-foreground"}`}>
                      {stream.streamer?.display_name || stream.streamer?.username}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
