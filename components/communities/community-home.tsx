"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import NextImage from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/skeletons"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bookmark,
  CalendarDays,
  Check,
  Clock,
  FolderOpen,
  Globe2,
  Hash,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  Pin,
  Plus,
  Reply,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react"
import { CreateInCommunity } from "@/components/communities/create-in-community"
import { CommunityManagement } from "@/components/communities/community-management"
import { ThreadsBoard } from "@/components/communities/threads-board"
import { CommunityChat } from "@/components/communities/community-chat"
import { WorldMembers } from "@/components/communities/world-members"
import { WorldEvents } from "@/components/communities/world-events"
import { WorldProjects } from "@/components/communities/world-projects"
import { WorldChallenges } from "@/components/communities/world-challenges"
import { WorldMemory } from "@/components/communities/world-memory"
import { CommunityBookmarks } from "@/components/communities/community-bookmarks"
import { WelcomeOnboarding } from "@/components/communities/welcome-onboarding"
import { spaceIcon } from "@/components/communities/world-spaces"
import { getCategoryConfig } from "@/lib/community-categories"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { cn } from "@/lib/utils"

interface DiscussionItem {
  key: string
  source: "post" | "loop"
  id: string
  title: string
  excerpt: string
  post_type: string
  author: any
  space: { id: string | number; name: string; icon?: string | null } | null
  created_at: string
  last_activity_at: string
  reply_count: number
  like_count: number
  is_pinned: boolean
  locked: boolean
  shared_to_feed: boolean
  can_manage_share: boolean
  href: string
  media_url: string | null
  media_type: string | null
  status: string | null
}

type Panel = "chat" | "threads" | "members" | "events" | "projects" | "challenges" | "memory" | "saved"

const TYPE_META: Record<string, { label: string; icon: any; className: string }> = {
  discussion: { label: "Discussion", icon: MessageSquare, className: "text-indigo-500" },
  question: { label: "Question", icon: MessagesSquare, className: "text-orange-500" },
  poll: { label: "Poll", icon: Zap, className: "text-amber-500" },
  coloop: { label: "Co-Loop", icon: Sparkles, className: "text-fuchsia-500" },
  duel: { label: "Duel", icon: Swords, className: "text-rose-500" },
  media: { label: "Media", icon: ImageIcon, className: "text-purple-500" },
  announcement: { label: "Announcement", icon: Pin, className: "text-red-500" },
  resource: { label: "Resource", icon: Layers, className: "text-cyan-500" },
}

function timeAgo(value?: string | null) {
  if (!value) return "just now"
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatNumber(n: number | null | undefined) {
  const num = Number(n || 0)
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return String(num)
}

/**
 * The community experience: one page, discussion-first.
 *
 * There is no tab bar. Identity and purpose are a single compact header,
 * pinned information sits right under it, and everything else (chat, threads,
 * members, events, projects, challenges, memory, saved) opens in a sheet from
 * the header. Management lives behind one settings button that only admins
 * see.
 */
function CommunityView({
  communityId,
  bundle,
  onRefresh,
}: {
  communityId: string
  bundle: any
  onRefresh: () => void
}) {
  const { user, getAuthHeader } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [items, setItems] = useState<DiscussionItem[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [counts, setCounts] = useState({ discussions: 0, replies: 0, unanswered: 0, shared_to_feed: 0 })
  const [sort, setSort] = useState("active")
  const [topic, setTopic] = useState("all")
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [justJoined, setJustJoined] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [busyShare, setBusyShare] = useState<string | null>(null)
  const [justShared, setJustShared] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [managing, setManaging] = useState(false)
  const [rooms, setRooms] = useState<any[]>([])
  const [copied, setCopied] = useState(false)

  const c = bundle?.community || {}
  const spaces = (bundle?.spaces || []).filter((s: any) => !s.is_archived)
  const isMember = Boolean(bundle?.is_member)
  const isModerator = Boolean(bundle?.is_moderator)
  const isAdmin = Boolean(bundle?.is_admin)
  // Private communities can never reach the public Loop feed.
  const canShareToFeed = !c.is_private
  const memberCount = bundle?.member_count || 0
  const pulse = bundle?.pulse || {}
  const membership = bundle?.membership || null
  const cfg = getCategoryConfig(c.category)
  const featureOn = (key: string) => (c.enabled_features || {})[key] !== false

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 320)
    return () => clearTimeout(t)
  }, [query])

  // Existing deep links (notifications, mentions, recaps) still point at
  // ?tab=threads / chat / members and so on. They now open the matching sheet
  // instead of a tab.
  useEffect(() => {
    const raw = searchParams?.get("panel") || searchParams?.get("tab")
    if (!raw) return
    const map: Record<string, Panel> = {
      threads: "threads",
      chat: "chat",
      members: "members",
      events: "events",
      projects: "projects",
      challenges: "challenges",
      memory: "memory",
      saved: "saved",
      bookmarks: "saved",
    }
    if (map[raw]) setPanel(map[raw])
  }, [searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ sort, topic, limit: "25" })
      if (debounced) params.set("q", debounced)
      const res = await fetch(`/api/communities/${communityId}/discussions?${params.toString()}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load discussions")
      setItems(data.discussions || [])
      setTopics(data.topics || [])
      setCounts(data.counts || { discussions: 0, replies: 0, unanswered: 0, shared_to_feed: 0 })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId, sort, topic, debounced])

  useEffect(() => {
    void load()
  }, [load])

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch(`/api/circles/${communityId}/coloop`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setRooms((data.sessions || []).filter((s: any) => s.status === "active").slice(0, 3))
    } catch {
      /* rooms are optional */
    }
  }, [communityId])

  useEffect(() => {
    if (isMember) void loadRooms()
  }, [isMember, loadRooms])

  // After a fresh join, run the existing welcome onboarding once.
  useEffect(() => {
    if (!justJoined) return
    const m = bundle?.membership
    if (!m || (m.status !== "active" && m.status !== "approved")) return
    if (!m.welcome_completed_at) {
      const t = setTimeout(() => setWelcomeOpen(true), 400)
      return () => clearTimeout(t)
    }
  }, [justJoined, bundle])

  const join = async () => {
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}`)
      return
    }
    setJoining(true)
    try {
      const res = await fetch(`/api/circles/${communityId}/join`, { method: "POST", headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to join")
      setJustJoined(true)
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  const toggleFeedShare = async (item: DiscussionItem) => {
    setBusyShare(item.key)
    try {
      const res =
        item.source === "post"
          ? await fetch(`/api/circles/${communityId}/posts/${item.id}/feed-share`, {
              method: item.shared_to_feed ? "DELETE" : "POST",
              headers: getAuthHeader(),
            })
          : await fetch(`/api/loops/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", ...getAuthHeader() },
              body: JSON.stringify({ visibility: item.shared_to_feed ? "private" : "public" }),
            })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't update sharing")
      }
      const next = !item.shared_to_feed
      setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, shared_to_feed: next } : i)))
      setJustShared(next ? item.key : null)
      if (next) setTimeout(() => setJustShared(null), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyShare(null)
    }
  }

  const pinnedThread = useMemo(() => (bundle?.threads || []).find((t: any) => t.is_pinned) || (bundle?.threads || [])[0] || null, [bundle])
  const focus = useMemo(() => {
    const happening = bundle?.happening || []
    if (happening.length > 0) return happening[0]
    if (pinnedThread) return { title: "Open thread", description: pinnedThread.title, emoji: "🧵" }
    return null
  }, [bundle, pinnedThread])

  const moreItems: Array<{ id: Panel; label: string; icon: any; show: boolean }> = [
    { id: "threads", label: "Threads", icon: Layers, show: true },
    { id: "chat", label: "Chat", icon: MessageCircle, show: featureOn("chat") },
    { id: "members", label: "Members", icon: Users, show: true },
    { id: "events", label: "Events", icon: CalendarDays, show: featureOn("events") },
    { id: "projects", label: "Projects", icon: FolderOpen, show: featureOn("projects") },
    { id: "challenges", label: "Challenges", icon: Trophy, show: featureOn("challenges") },
    { id: "memory", label: "Memory", icon: Clock, show: featureOn("memory") },
    { id: "saved", label: "Saved", icon: Bookmark, show: isMember },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6 lg:pb-12">
      {/* ── Compact header ── */}
      <header className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-3.5 sm:flex-nowrap sm:items-center">
        <Avatar className="h-12 w-12 shrink-0 rounded-xl border border-border">
          <AvatarImage src={c.avatar_url || ""} alt={c.name} />
          <AvatarFallback
            className="rounded-xl text-lg font-bold text-white"
            style={{ background: c.accent_color || cfg.accent }}
          >
            {(c.name || "?").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{c.name}</h1>
            {c.is_verified ? <VerifiedSeal size={15} variant="emerald" title="Official community" /> : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {c.is_private ? <Lock className="h-2.5 w-2.5" /> : <Globe2 className="h-2.5 w-2.5" />}
              {c.is_private ? "Private" : "Public"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {cfg.emoji} {cfg.label}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {c.description || "Open a discussion to get this community moving."}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{formatNumber(memberCount)} members</span>
            <span className="tabular-nums">{formatNumber(counts.discussions)} discussions</span>
            <span className="tabular-nums">{formatNumber(counts.replies)} replies</span>
            {pulse.active_now > 0 ? (
              <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{pulse.active_now} active now</span>
            ) : null}
          </div>
        </div>

        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          {isMember ? (
            <Button size="sm" className="h-9 flex-1 rounded-full px-3.5 sm:flex-none" onClick={() => setCreating(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Create in this community
            </Button>
          ) : (
            <Button size="sm" className="h-9 flex-1 rounded-full px-3.5 sm:flex-none" onClick={join} disabled={joining}>
              {joining ? <Spinner className="mr-1.5 h-4 w-4" /> : <Users className="mr-1.5 h-4 w-4" />}
              {c.is_private ? "Request to join" : "Join community"}
            </Button>
          )}

          {featureOn("chat") && isMember ? (
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0 rounded-full"
              title="Chat"
              onClick={() => setPanel("chat")}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          ) : null}

          {isModerator ? (
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0 rounded-full"
              title="Manage community"
              onClick={() => setManaging(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 rounded-full" title="More">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Community
              </DropdownMenuLabel>
              {moreItems
                .filter((m) => m.show)
                .map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => setPanel(m.id)} className="cursor-pointer">
                    <m.icon className="mr-2 h-3.5 w-3.5" /> {m.label}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void copyLink()} className="cursor-pointer">
                {copied ? (
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Share2 className="mr-2 h-3.5 w-3.5" />
                )}
                {copied ? "Link copied" : "Copy link"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Pinned welcome + current focus ── */}
      {c.welcome_message || focus ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {c.welcome_message ? (
            <div className="rounded-2xl border border-border bg-card px-3.5 py-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Pin className="h-3 w-3" /> Welcome
              </p>
              <p className="mt-0.5 line-clamp-3 text-xs text-foreground/90">{c.welcome_message}</p>
            </div>
          ) : null}
          {focus ? (
            <div className="rounded-2xl border border-border bg-card px-3.5 py-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Zap className="h-3 w-3" /> Current focus
              </p>
              <p className="mt-0.5 line-clamp-3 text-xs text-foreground/90">
                <span className="font-semibold">{focus.title}</span>
                {focus.description ? ` — ${focus.description}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* ── Discussions ── */}
        <section className="space-y-3">
          {/* Topic chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {topics.map((t) => {
              const Icon = t.id === "general" ? Hash : spaceIcon(t.icon)
              const active = topic === String(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(String(t.id))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    active
                      ? "border-foreground/20 bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t.name}
                  {typeof t.count === "number" ? <span className="tabular-nums opacity-60">{t.count}</span> : null}
                </button>
              )
            })}
          </div>

          {/* Sort + search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
              {[
                { id: "active", label: "Active" },
                { id: "recent", label: "Newest" },
                { id: "replies", label: "Top" },
                { id: "unanswered", label: "Unanswered" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    sort === s.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[150px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search discussions"
                className="h-8 rounded-full pl-8 text-xs"
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3.5 py-2.5">
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
              <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {loading ? (
              <div className="divide-y divide-border/60">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3.5">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <MessagesSquare className="mx-auto mb-2.5 h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm font-semibold">
                  {debounced ? `Nothing matches “${debounced}”.` : "No discussions yet"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  {isMember
                    ? "Start one — ask a question, share work, or open a Co-Loop together."
                    : "Join this community to start the first discussion."}
                </p>
                {isMember ? (
                  <Button size="sm" className="mt-3 h-8 rounded-full px-3 text-xs" onClick={() => setCreating(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Start a discussion
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {items.map((item) => (
                  <DiscussionRow
                    key={item.key}
                    item={item}
                    busy={busyShare === item.key}
                    justShared={justShared === item.key}
                    onToggleShare={() => void toggleFeedShare(item)}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPanel("threads")}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Threads — work with an outcome
            </span>
            <span className="text-[11px] text-muted-foreground">
              {(bundle?.threads || []).filter((t: any) => (t.state || "open") === "open").length} open
            </span>
          </button>
        </section>

        {/* ── Context rail ── */}
        <aside className="space-y-2.5">
          {/* Membership */}
          <div className="rounded-2xl border border-border bg-card p-3.5">
            {isMember ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Member
                  </p>
                  <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                    {bundle?.role && bundle.role !== "guest" ? bundle.role : "member"}
                    {membership?.joined_at ? ` · joined ${new Date(membership.joined_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-7 rounded-full px-2.5 text-[11px]" onClick={() => setPanel("members")}>
                  Members
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold">{c.is_private ? "Membership is approved" : "Join to take part"}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {c.is_private
                    ? "The community team approves requests before you can post."
                    : "Open discussions, reply, and start Co-Loops or Duels."}
                </p>
              </div>
            )}
          </div>

          {isMember && rooms.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3 text-fuchsia-500" /> Co-Loop rooms
              </p>
              <div className="mt-1.5 space-y-1">
                {rooms.map((room: any) => (
                  <Link
                    key={room.id}
                    href={`/co-loop/studio?session=${encodeURIComponent(room.session_id || "")}&circle=${communityId}`}
                    className="block rounded-xl border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:bg-muted/50"
                  >
                    <span className="line-clamp-1">{room.title || "Untitled Co-Loop"}</span>
                    <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                      {room.creator?.display_name || room.creator?.username || "A member"} · join
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* Members preview */}
          {(bundle?.recent_members || []).length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Members</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(bundle.recent_members || []).slice(0, 8).map((m: any) => {
                  const u = m.user || {}
                  return (
                    <Link key={m.user_id} href={u.username ? `/profile/${u.username}` : "#"} title={u.display_name || u.username}>
                      <Avatar className="h-7 w-7 border border-border">
                        <AvatarImage src={u.avatar_url || ""} alt="" />
                        <AvatarFallback className="text-[9px]">
                          {(u.display_name || u.username || "?").slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setPanel("members")}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  See all
                </button>
              </div>
            </div>
          ) : null}

          {/* Guidelines */}
          {Array.isArray(c.rules?.rules) && c.rules.rules.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Guidelines</p>
              <ul className="mt-1.5 space-y-1">
                {c.rules.rules.slice(0, 5).map((r: string, i: number) => (
                  <li key={i} className="flex gap-1.5 text-[11px] text-muted-foreground">
                    <span className="text-foreground/40">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {/* ── Secondary surfaces (sheets — never tabs) ── */}
      <Sheet open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="text-base capitalize">{panel === "saved" ? "Saved" : panel}</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-4 sm:px-5">
            {panel === "chat" ? <CommunityChat communityId={communityId} spaces={spaces} canModerate={isModerator} /> : null}
            {panel === "threads" ? (
              <ThreadsBoard communityId={communityId} spaces={spaces} isMember={isMember} />
            ) : null}
            {panel === "members" ? (
              <WorldMembers
                communityId={communityId}
                initial={bundle?.recent_members || []}
                viewerRole={bundle?.role}
                viewerId={bundle?.viewer}
                powers={bundle?.powers || []}
                powerAssignments={bundle?.power_assignments || {}}
              />
            ) : null}
            {panel === "events" ? (
              <WorldEvents communityId={communityId} isMember={isMember} canManage={isModerator} />
            ) : null}
            {panel === "projects" ? (
              <WorldProjects communityId={communityId} initial={bundle?.projects || []} isMember={isMember} isModerator={isModerator} />
            ) : null}
            {panel === "challenges" ? (
              <WorldChallenges communityId={communityId} initial={bundle?.challenges || []} isMember={isMember} isModerator={isModerator} />
            ) : null}
            {panel === "memory" ? (
              <WorldMemory communityId={communityId} initial={bundle?.memory} canModerate={isModerator} />
            ) : null}
            {panel === "saved" ? <CommunityBookmarks communityId={communityId} /> : null}
          </div>
        </SheetContent>
      </Sheet>

      <CreateInCommunity
        open={creating}
        onOpenChange={setCreating}
        communityId={communityId}
        spaces={spaces}
        canShareToFeed={canShareToFeed}
        onCreated={() => {
          void load()
          void loadRooms()
        }}
      />

      {isModerator ? (
        <CommunityManagement
          open={managing}
          onOpenChange={setManaging}
          communityId={communityId}
          bundle={bundle}
          onSaved={onRefresh}
        />
      ) : null}

      {isMember ? (
        <WelcomeOnboarding
          open={welcomeOpen}
          onOpenChange={setWelcomeOpen}
          communityId={communityId}
          communityName={c.name}
          spaces={spaces}
          initialInterests={Array.isArray(membership?.interests) ? membership.interests : []}
          initialSpaces={Array.isArray(membership?.followed_spaces) ? membership.followed_spaces : []}
          onDone={() => {
            setWelcomeOpen(false)
            setJustJoined(false)
            onRefresh()
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * The one community experience.
 *
 * `/communities/[id]` renders this and nothing else: it loads the community
 * bundle, then shows the unified discussion-first page. The old tabbed world
 * (Canvas / Feed / Threads / Chat / Events / Members / Powers / Moderation /
 * Settings) is gone rather than hidden.
 */
export function CommunityHome({ communityId }: { communityId: string }) {
  const router = useRouter()
  const [bundle, setBundle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [locked, setLocked] = useState(false)
  const [joining, setJoining] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError("")
      setLocked(false)
      try {
        const res = await fetch(`/api/communities/${communityId}`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) {
          if (data.locked) setLocked(true)
          throw new Error(data.error || "Failed to load community")
        }
        if (!cancelled) setBundle(data)
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [communityId, refreshKey])

  const requestJoin = async () => {
    setJoining(true)
    try {
      const res = await fetch(`/api/circles/${communityId}/join`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to join")
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading && !bundle) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3 px-4 py-4 sm:px-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3 rounded-full" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (locked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
            <Lock className="h-6 w-6 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold">This community is private</h1>
          <p className="text-sm text-muted-foreground">
            Membership is approved by the community team before you can see anything.
          </p>
          <Button onClick={requestJoin} disabled={joining} className="rounded-full">
            {joining ? <Spinner className="mr-1.5 h-4 w-4" /> : null}
            Request to join
          </Button>
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
        </div>
      </div>
    )
  }

  if (error && !bundle) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="space-y-3 text-center">
          <p className="text-base font-semibold text-rose-500">{error}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setRefreshKey((k) => k + 1)}>
              Try again
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => router.push("/communities")}>
              All communities
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <CommunityView
      communityId={communityId}
      bundle={bundle}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    />
  )
}

function DiscussionRow({
  item,
  busy,
  justShared,
  onToggleShare,
}: {
  item: DiscussionItem
  busy: boolean
  justShared: boolean
  onToggleShare: () => void
}) {
  const meta = TYPE_META[item.post_type] || TYPE_META.discussion
  const TypeIcon = meta.icon
  const authorName = item.author?.display_name || item.author?.username || "Someone"

  return (
    <div className="group relative flex gap-3 p-3.5 transition-colors hover:bg-muted/30">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={item.author?.avatar_url || ""} alt="" />
        <AvatarFallback className="text-[10px] font-bold">{authorName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <Link href={item.href} className="block">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className={cn("inline-flex items-center gap-1 font-bold uppercase tracking-wide", meta.className)}>
              <TypeIcon className="h-2.5 w-2.5" /> {meta.label}
            </span>
            {item.space?.name ? (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <Hash className="h-2.5 w-2.5" /> {item.space.name}
              </span>
            ) : null}
            {item.is_pinned ? (
              <span className="inline-flex items-center gap-0.5 font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                <Pin className="h-2.5 w-2.5" /> Pinned
              </span>
            ) : null}
            {item.locked ? (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            ) : null}
            {item.status === "pending" ? (
              <span className="font-bold uppercase tracking-wide text-muted-foreground">Awaiting review</span>
            ) : null}
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-indigo-500">
            {item.title}
          </h3>
          {item.excerpt && item.excerpt !== item.title ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.excerpt}</p>
          ) : null}
        </Link>

        {item.media_url && item.media_type === "image" ? (
          <Link href={item.href} className="mt-2 block overflow-hidden rounded-xl border border-border">
            <NextImage src={item.media_url} alt="" width={640} height={320} className="h-36 w-full object-cover" unoptimized />
          </Link>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{authorName}</span>
          <span>{timeAgo(item.reply_count > 0 ? item.last_activity_at : item.created_at)}</span>
          <Link href={item.href} className="flex items-center gap-1 hover:text-foreground">
            <Reply className="h-3 w-3" /> {item.reply_count}
          </Link>
          {item.like_count > 0 ? <span>{item.like_count} likes</span> : null}
          {item.shared_to_feed && !item.can_manage_share ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Globe2 className="h-3 w-3" /> On feed
            </span>
          ) : null}
          {item.can_manage_share ? (
            <button
              type="button"
              onClick={onToggleShare}
              disabled={busy}
              title={item.shared_to_feed ? "Stop sharing to the Loop feed" : "Share to the Loop feed"}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-semibold transition-colors hover:text-foreground"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : justShared ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Share2 className="h-3 w-3" />
              )}
              {justShared ? "Shared" : item.shared_to_feed ? "On feed" : "Share"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
