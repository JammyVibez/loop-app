"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { getCategoryConfig } from "@/lib/community-categories"
import { formatNumber } from "@/lib/community-engine"
import { WorldFeed } from "@/components/communities/world-feed"
import { WorldSpaces } from "@/components/communities/world-spaces"
import { WorldProjects } from "@/components/communities/world-projects"
import { WorldChallenges } from "@/components/communities/world-challenges"
import { WorldMemory } from "@/components/communities/world-memory"
import { WorldMembers } from "@/components/communities/world-members"
import { WorldModeration } from "@/components/communities/world-moderation"
import { WorldSettings } from "@/components/communities/world-settings"
import { WorldLoop } from "@/components/communities/world-loop"
import { WelcomeOnboarding } from "@/components/communities/welcome-onboarding"
import { CommunityBookmarks } from "@/components/communities/community-bookmarks"
import { WorldBots } from "@/components/communities/world-bots"
import { CommunityChat } from "@/components/communities/community-chat"
import { CommunityAdminModal } from "@/components/communities/community-admin-modal"
import { iconForSpace, spaceIcon } from "@/components/communities/world-spaces"
import { AdSlot } from "@/components/ads/ad-slot"
import { Spinner } from "@/components/ui/skeletons"
import {
  Users,
  Share2,
  Lock,
  BadgeCheck,
  MessageSquare,
  Palette,
  Vote,
  Flame,
  Globe2,
  ArrowLeft,
  Activity,
  Sparkles,
  FolderOpen,
  Trophy,
  History,
  UsersRound,
  ShieldCheck,
  Settings,
  Link as LinkIcon,
  Check,
  
  Menu,
  Sprout,
  Home,
  ExternalLink,
  X,
  Bookmark,
  Bot,
  Crown,
  MessageCircle,
} from "lucide-react"
import Link from "next/link"
import { VerifiedSeal } from "@/components/ui/verified-seal"

const PULSE_EMOJI: Record<string, string> = {
  quiet: "Moon",
  growing: "Sprout",
  active: "Zap",
  very_active: "Zap",
  exploding: "Flame",
}

/** Map the category/happening emoji tokens to real Lucide icons (no emoji in UI). */
function emojiToIcon(emoji?: string | null) {
  const map: Record<string, typeof Sparkles> = {
    "🌸": Palette,
    "🎮": Gamepad2,
    "💻": Code2,
    "📚": BookOpen,
    "🎨": Paintbrush,
    "⚽": Trophy,
    "🎬": Clapperboard,
    "🎵": Music,
    "📖": BookOpen,
    "💬": MessageSquare,
    "🔥": Flame,
    "✨": Sparkles,
    "🚀": Rocket,
    "⭐": Star,
    "❤️": Heart,
    "🧠": Brain,
    "💡": Lightbulb,
    "🗳️": Vote,
    "🛠️": Wrench,
    "🤝": Handshake,
    "🏆": Trophy,
    "👾": Gamepad2,
    "🖥️": Monitor,
    "📰": Newspaper,
    "🌍": Globe2,
  }
  return map[emoji || ""] || Sparkles
}

import { Gamepad2, Code2, BookOpen, Paintbrush, Clapperboard, Music, Rocket, Star, Heart, Brain, Lightbulb, Wrench, Handshake, Monitor, Newspaper } from "lucide-react"

interface FocusTarget {
  tab: string
  id?: number | string
  ts: number
}

export function CommunityWorld({ communityId }: { communityId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [bundle, setBundle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [locked, setLocked] = useState(false)
  const [joining, setJoining] = useState(false)
  const [tab, setTab] = useState("overview")
  const [shared, setShared] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [justJoined, setJustJoined] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const [spaceRequest, setSpaceRequest] = useState<{ id: string; token: number } | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)

  // Support deep links like /communities/[id]?tab=bots so external CTAs
  // (e.g. marketplace install success) can land users directly on a tab.
  const VALID_TABS = ["overview", "feed", "spaces", "chat", "projects", "challenges", "memory", "members", "bots", "bookmarks", "moderation", "settings"]
  useEffect(() => {
    const t = searchParams?.get("tab") || ""
    if (t && VALID_TABS.includes(t)) setTab(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, communityId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/communities/${communityId}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        if (data.locked) setLocked(true)
        throw new Error(data.error || "Failed to load community")
      }
      setBundle(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // Fresh join → open the welcome onboarding once the bundle refreshes.
  const joinedAtRef = useRef<string | null>(null)
  useEffect(() => {
    const m = bundle?.membership
    if (!justJoined || !m || !bundle) return
    if (m.status !== "active" && m.status !== "approved") return
    const justNow = !m.welcome_completed_at && (joinedAtRef.current === null || joinedAtRef.current === m.joined_at)
    if (justNow) {
      joinedAtRef.current = m.joined_at
      const t = setTimeout(() => setWelcomeOpen(true), 450)
      return () => clearTimeout(t)
    }
  }, [bundle, justJoined])

  const join = async () => {
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}`)
      return
    }
    setJoining(true)
    try {
      const res = await fetch(`/api/circles/${communityId}/join`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to join")
      setJustJoined(true)
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      /* noop */
    }
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: bundle?.community?.name || "Community", url })
      } else {
        await copyLink()
        return
      }
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      /* cancelled */
    }
  }

  const openTab = useCallback((target: { tab: string; id?: number | string }) => {
    setTab(target.tab)
    if (target.id) setFocus({ tab: target.tab, id: target.id, ts: Date.now() })
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  /** Deep-link a happening/moment/memory/loop item to the real content. */
  const openItem = useCallback(
    (item: any) => {
      if (!item) return
      const ref = item.ref_type
      if (ref === "member" && item.ref_username) {
        router.push(`/profile/${item.ref_username}`)
        return
      }
      if (ref === "event") {
        // The legacy /circles/[id] page was removed — events surface in the feed.
        openTab({ tab: "feed" })
        return
      }
      const tabFor =
        ref === "project" ? "projects" : ref === "challenge" || ref === "challenge_entry" ? "challenges" : ref === "memory" ? "memory" : "feed"
      const id =
        ref === "poll" ? item.post_id || item.ref_id : ref === "challenge_entry" ? item.challenge_id || item.ref_id : item.ref_id
      openTab({ tab: tabFor, id })
    },
    [openTab, router, communityId]
  )

  const tabs = useMemo(() => {
    if (!bundle) return []
    const items = [
      { id: "overview", label: "Overview", icon: Home },
      { id: "feed", label: "Feed", icon: MessageSquare },
      { id: "spaces", label: "Spaces", icon: Globe2 },
      { id: "chat", label: "Chat", icon: MessageCircle },
      { id: "projects", label: "Projects", icon: FolderOpen },
      { id: "challenges", label: "Challenges", icon: Trophy },
      { id: "memory", label: "Memory", icon: History },
      { id: "members", label: "Members", icon: UsersRound },
      { id: "bots", label: "Bots", icon: Bot },
    ]
    if (bundle.is_member) items.push({ id: "bookmarks", label: "Saved", icon: Bookmark })
    if (bundle.is_moderator) items.push({ id: "moderation", label: "Moderation", icon: ShieldCheck })
    if (bundle.is_admin) items.push({ id: "settings", label: "Settings", icon: Settings })
    return items
  }, [bundle])

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="flex items-end gap-4 px-4 -mt-12">
          <Skeleton className="h-24 w-24 rounded-2xl border-4 border-background" />
          <div className="space-y-2 pb-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (locked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
            <Lock className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold">This world is private</h1>
          <p className="text-muted-foreground text-sm">
            This community is invitation-only. Join requests are approved by the community team.
          </p>
          <Button onClick={join} disabled={joining} className="rounded-full">
            {joining ? <Spinner className="h-4 w-4 mr-1.5" /> : null}
            Request to join
          </Button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
    )
  }

  if (error && !bundle) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-red-500">{error}</p>
          <Link href="/communities">
            <Button variant="outline" className="rounded-full">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to communities
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const c = bundle.community
  const cfg = getCategoryConfig(c.category)
  const pulse = bundle.pulse || {}
  const memberCount = bundle.member_count || 0
  const bannerUrl = c.banner_url || c.cover_url
  const membership = bundle.membership || null
  const modSettings = c.moderation_settings || {}

  return (
    <div className="pb-16">
      {/* Banner */}
      <div
        className="relative h-44 sm:h-56 w-full overflow-hidden"
        style={{ background: c.accent_color || cfg.accent }}
      >
        {bannerUrl ? (
          <Image src={bannerUrl} alt="" fill className="object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/70 via-fuchsia-600/40 to-cyan-600/50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="px-4 sm:px-6 -mt-16 sm:-mt-20 relative">
        {/* Header card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="relative">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-background shadow-xl">
              <AvatarImage src={c.avatar_url || ""} alt={c.name} />
              <AvatarFallback className="rounded-2xl text-3xl font-extrabold bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
                {c.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {c.is_verified && (
              <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-background p-0.5">
                <VerifiedSeal size={24} variant="emerald" title="Official Community" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-2 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{c.name}</h1>
              {c.is_private && <Lock className="h-4 w-4 text-muted-foreground" />}
              {c.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500 border border-blue-500/30">
                  <VerifiedSeal size={12} variant="emerald" title="Official Community" /> OFFICIAL
                </span>
              )}
              {(() => {
                const CatIcon = emojiToIcon(cfg.emoji)
                return (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold">
                    <CatIcon className="h-3.5 w-3.5" style={{ color: cfg.accent }} />
                    {cfg.label}
                  </span>
                )
              })()}
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2 max-w-2xl">{c.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Users className="h-3.5 w-3.5" /> {formatNumber(memberCount)} members
              </span>
              {pulse.active_now > 0 && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Activity className="h-3.5 w-3.5" /> {pulse.active_now} active now
                </span>
              )}
              {c.handle && <span className="font-mono text-[11px]">/communities/{c.handle}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-0 w-full sm:w-auto">
            <div className="flex flex-1 sm:flex-none items-center gap-2">
              {bundle.is_member ? (
                <Button variant="outline" className="rounded-full flex-1 sm:flex-none" onClick={() => openTab({ tab: "feed" })}>
                  <Check className="h-4 w-4 mr-1.5 text-emerald-500" /> Joined
                </Button>
              ) : (
                <Button className="rounded-full bg-indigo-600 hover:bg-indigo-500 flex-1 sm:flex-none" onClick={join} disabled={joining}>
                  {joining ? <Spinner className="h-4 w-4 mr-1.5" /> : <Users className="h-4 w-4 mr-1.5" />}
                  {c.is_private ? "Request to join" : "Join world"}
                </Button>
              )}
              <Button variant="outline" size="icon" className="rounded-full" onClick={share} title="Share">
                {shared ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
              </Button>
              {bundle.is_admin && (
                <Button variant="outline" size="icon" className="rounded-full" onClick={() => setAdminOpen(true)} title="Admin Panel">
                  <Crown className="h-4 w-4 text-amber-500" />
                </Button>
              )}
              <Button variant="outline" size="icon" className="rounded-full md:hidden" onClick={() => setMenuOpen(true)} title="More">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Pulse strip — living stat tiles with per-metric accents */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            {
              label: "Community pulse",
              value: pulse.label || "Quiet",
              icon: Flame,
              accent: "#f97316",
              tint: "from-orange-500/15",
              onClick: null as null | (() => void),
            },
            {
              label: "Discussing",
              value: String(pulse.discussing || 0),
              icon: MessageSquare,
              accent: "#8b5cf6",
              tint: "from-violet-500/15",
              onClick: () => openTab({ tab: "feed" }),
            },
            {
              label: "Creating",
              value: String(pulse.creating || 0),
              icon: Palette,
              accent: "#ec4899",
              tint: "from-pink-500/15",
              onClick: () => openTab({ tab: "feed" }),
            },
            {
              label: "Voting",
              value: String(pulse.voting || 0),
              icon: Vote,
              accent: "#f59e0b",
              tint: "from-amber-500/15",
              onClick: () => openTab({ tab: "feed" }),
            },
          ].map((t) => (
            <div
              key={t.label}
              role={t.onClick ? "button" : undefined}
              tabIndex={t.onClick ? 0 : undefined}
              onClick={t.onClick || undefined}
              onKeyDown={t.onClick ? (e) => { if (e.key === "Enter") t.onClick?.() } : undefined}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-3.5 transition-all duration-300 ${t.onClick ? "cursor-pointer hover:border-transparent hover:shadow-lg" : ""}`}
              style={t.onClick ? { ["--tile-accent" as any]: t.accent } : undefined}
            >
              {t.onClick && (
                <>
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${t.tint} to-transparent" />
                  <span className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-30" style={{ background: t.accent }} />
                </>
              )}
              <p className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <t.icon className="h-3 w-3" style={{ color: t.accent }} />
                {t.label}
              </p>
              <p className="relative mt-1 text-lg font-extrabold">{t.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => openTab({ tab: t.id })}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                tab === t.id
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "overview" && (
            <WorldOverview
              bundle={bundle}
              communityId={communityId}
              onApplyEvolution={() => setRefreshKey((k) => k + 1)}
              onOpenTab={openTab}
              onOpenItem={openItem}
            />
          )}
          {tab === "feed" && (
            <WorldFeed
              communityId={communityId}
              spaces={bundle.spaces || []}
              isMember={bundle.is_member}
              isModerator={bundle.is_moderator}
              moderationSettings={modSettings}
              focusId={focus?.tab === "feed" ? (focus.id as number) : undefined}
              spaceRequest={spaceRequest}
              onSpaceHandled={() => setSpaceRequest(null)}
              onFocused={() => setFocus(null)}
            />
          )}
          {tab === "spaces" && <WorldSpaces communityId={communityId} spaces={bundle.spaces || []} canModerate={bundle.is_moderator} onChanged={() => setRefreshKey((k) => k + 1)} />}
          {tab === "chat" && bundle.is_member && (
            <CommunityChat
              communityId={communityId}
              spaces={bundle.spaces || []}
              canModerate={bundle.is_moderator}
            />
          )}
          {tab === "chat" && !bundle.is_member && (
            <div className="text-center py-12">
              <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-semibold">Join this community to chat</p>
              <p className="text-xs text-muted-foreground mt-1">You must be a member to participate in chat.</p>
            </div>
          )}
          {tab === "projects" && (
            <WorldProjects
              communityId={communityId}
              initial={bundle.projects || []}
              isMember={bundle.is_member}
              isModerator={bundle.is_moderator}
              focusId={focus?.tab === "projects" ? Number(focus.id) : undefined}
              onFocused={() => setFocus(null)}
            />
          )}
          {tab === "challenges" && (
            <WorldChallenges
              communityId={communityId}
              initial={bundle.challenges || []}
              isMember={bundle.is_member}
              isModerator={bundle.is_moderator}
              focusId={focus?.tab === "challenges" ? Number(focus.id) : undefined}
              onFocused={() => setFocus(null)}
            />
          )}
          {tab === "memory" && (
            <WorldMemory
              communityId={communityId}
              initial={bundle.memory}
              canModerate={bundle.is_moderator}
              focusId={focus?.tab === "memory" ? Number(focus.id) : undefined}
              onFocused={() => setFocus(null)}
            />
          )}
          {tab === "members" && (
            <WorldMembers communityId={communityId} initial={bundle.recent_members || []} viewerRole={bundle.role} viewerId={bundle.viewer} />
          )}
          {tab === "bots" && <WorldBots communityId={communityId} isMember={bundle.is_member} />}
          {tab === "bookmarks" && (
            <CommunityBookmarks communityId={communityId} />
          )}
          {tab === "moderation" && <WorldModeration communityId={communityId} />}
          {tab === "settings" && <WorldSettings communityId={communityId} bundle={bundle} onSaved={() => setRefreshKey((k) => k + 1)} />}
        </div>
      </div>

      {/* Mobile menu — bottom sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8 pt-5">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              {c.avatar_url ? (
                <Avatar className="h-7 w-7 rounded-lg">
                  <AvatarImage src={c.avatar_url} alt="" />
                  <AvatarFallback className="text-xs">{c.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
              ) : null}
              {c.name}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex flex-wrap gap-2">
            {!bundle.is_member ? (
              <Button size="sm" className="flex-1 rounded-full" onClick={join} disabled={joining}>
                {joining ? <Spinner className="h-3.5 w-3.5 mr-1" /> : <Users className="h-3.5 w-3.5 mr-1" />} Join world
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => openTab({ tab: "feed" })}>
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Open community feed
              </Button>
            )}
            <Button size="sm" variant="outline" className="rounded-full" onClick={share}>
              {shared ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={copyLink}>
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="mt-4 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jump to</p>
          <div className="grid grid-cols-2 gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => openTab({ tab: t.id })}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                  tab === t.id ? "border-indigo-500 bg-indigo-500/10 text-indigo-500" : "border-border bg-card text-muted-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {(bundle.spaces || []).length > 0 && (
            <>
              <p className="mt-4 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Spaces</p>
              <div className="flex flex-wrap gap-1.5">
                {(bundle.spaces || [])
                  .filter((s: any) => !s.is_archived)
                  .slice(0, 10)
                  .map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSpaceRequest({ id: String(s.id), token: Date.now() })
                        setTab("feed")
                        setMenuOpen(false)
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-indigo-500/50 hover:text-foreground"
                    >
                      {(() => { const SIcon = spaceIcon(s.icon); return <SIcon className="h-3.5 w-3.5 text-indigo-400" /> })()}
                      {s.name}
                    </button>
                  ))}
              </div>
            </>
          )}

          <Button variant="ghost" size="sm" className="mt-4 w-full rounded-full text-muted-foreground" onClick={() => setMenuOpen(false)}>
            <X className="h-3.5 w-3.5 mr-1.5" /> Close
          </Button>
        </SheetContent>
      </Sheet>

      {/* Post-join welcome onboarding */}
      {membership && justJoined && (
        <WelcomeOnboarding
          open={welcomeOpen}
          onOpenChange={setWelcomeOpen}
          communityId={communityId}
          communityName={c.name}
          spaces={bundle.spaces || []}
          initialInterests={Array.isArray(membership.interests) ? membership.interests : []}
          initialSpaces={Array.isArray(membership.followed_spaces) ? membership.followed_spaces : []}
          onDone={() => {
            setJustJoined(false)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}

      {/* Admin Panel Modal */}
      <CommunityAdminModal
        open={adminOpen}
        onOpenChange={setAdminOpen}
        communityId={communityId}
        communityName={c.name || ""}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview: Community Loop + Pulse + What's Happening + DNA + Moments + Evolution
// ---------------------------------------------------------------------------
function WorldOverview({
  bundle,
  communityId,
  onApplyEvolution,
  onOpenTab,
  onOpenItem,
}: {
  bundle: any
  communityId: string
  onApplyEvolution: () => void
  onOpenTab: (t: { tab: string; id?: number | string }) => void
  onOpenItem: (item: any) => void
}) {
  const happening = bundle.happening || []
  const dna = bundle.dna || {}
  const moments = bundle.moments || { all: [] }
  const evolution = bundle.evolution || []
  const pendingRecs = bundle.pending_recommendations || []
  const isOwner = bundle.is_admin
  const welcome = bundle.community?.welcome_message

  const dnaBars = [
    { key: "creativity", label: "Creativity", value: dna.creativity || 0, color: "#a78bfa" },
    { key: "debate", label: "Debate", value: dna.debate || 0, color: "#f472b6" },
    { key: "humor", label: "Humor", value: dna.humor || 0, color: "#fbbf24" },
    { key: "knowledge", label: "Knowledge", value: dna.knowledge || 0, color: "#22d3ee" },
    { key: "collaboration", label: "Collaboration", value: dna.collaboration || 0, color: "#34d399" },
  ]
  const dnaAvg = Math.min(100, Math.round(dnaBars.reduce((s, d) => s + d.value, 0) / dnaBars.length))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-4">
        {/* The Community Loop — signature visualization */}
        <WorldLoop communityId={communityId} loop={bundle.community_loop} onOpen={onOpenTab} />

        {welcome && (
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Welcome to the world
            </p>
            <p className="mt-1.5 text-sm">{welcome}</p>
          </div>
        )}

        {bundle.community?.rules?.rules && bundle.community.rules.rules.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Community Rules
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">Please follow these guidelines</p>
            <ol className="space-y-2">
              {bundle.community.rules.rules.map((rule: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">What's happening</h2>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3 text-emerald-500" /> live from community activity
            </span>
          </div>
          {happening.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Sprout className="h-8 w-8 text-muted-foreground mb-2" />
              This world is just waking up. Post something to spark the first discussion!
            </div>
          ) : (
            <div className="space-y-2.5">
              {happening.map((h: any, i: number) => {
                const HIcon = emojiToIcon(h.emoji)
                return (
                  <button
                    key={i}
                    onClick={() => onOpenItem(h)}
                    className="group w-full flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition-all duration-300 hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:shadow-lg hover:shadow-indigo-500/5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-indigo-500 transition-transform duration-300 group-hover:scale-110">
                      <HIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">{h.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{h.description}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/40 transition-colors group-hover:text-indigo-400" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Moments — clickable highlights */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="font-bold mb-3">Moments</h2>
          {moments.all.length === 0 ? (
            <p className="text-sm text-muted-foreground">Highlights will surface here as the community makes history.</p>
          ) : (
            <div className="space-y-2.5">
              {moments.all.slice(0, 5).map((m: any, i: number) => (
                <button
                  key={i}
                  onClick={() => onOpenItem(m)}
                  className="group w-full flex items-start gap-3 rounded-xl border border-border/60 border-l-2 border-l-fuchsia-500/60 bg-gradient-to-r from-fuchsia-500/5 to-transparent p-3 text-left transition-all duration-300 hover:border-l-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 text-fuchsia-500 transition-transform duration-300 group-hover:scale-110">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{m.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.description}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/40 transition-colors group-hover:text-fuchsia-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right column: DNA + evolution + ads */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="7" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="url(#dnaGrad)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${dnaAvg * 2.13} 214`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="dnaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="55%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-extrabold leading-none">{dnaAvg}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">DNA</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-fuchsia-500" /> Community DNA
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Measured from real member activity this week</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {dnaBars.map((d) => (
              <div key={d.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{d.label}</span>
                  <span className="font-bold" style={{ color: d.color }}>{d.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.value}%`, background: `linear-gradient(90deg, ${d.color}99, ${d.color})` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evolution */}
        {(isOwner || bundle.viewer) && evolution.length + pendingRecs.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
            <h2 className="font-bold flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-500" /> Your world is evolving
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">Recommendations based on what members are doing</p>
            <div className="space-y-2.5">
              {[...pendingRecs, ...evolution].slice(0, 4).map((r: any, i: number) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="text-xs font-bold">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                  {isOwner && r.status !== "applied" && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-full text-[11px] h-7"
                        onClick={async () => {
                          await fetch(`/api/communities/${bundle.community.id}/evolution`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "apply", recommendation: r }),
                          })
                          onApplyEvolution()
                        }}
                      >
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-[11px] h-7"
                        onClick={async () => {
                          if (r.id) {
                            await fetch(`/api/communities/${bundle.community.id}/evolution`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "dismiss", recommendation_id: r.id }),
                            })
                            onApplyEvolution()
                          }
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick stats — compact tiles */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3 text-emerald-500" /> At a glance
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Active projects", value: bundle.projects?.filter((p: any) => p.status === "active").length || 0, icon: FolderOpen, accent: "#8b5cf6", tab: "projects" as const },
              { label: "Live challenges", value: bundle.challenges?.filter((ch: any) => ch.status === "active").length || 0, icon: Trophy, accent: "#f59e0b", tab: "challenges" as const },
              { label: "Spaces", value: bundle.spaces?.length || 0, icon: Globe2, accent: "#22d3ee", tab: "members" as const },
              { label: "New members", value: bundle.pulse?.new_members_24h || 0, icon: Users, accent: "#34d399", tab: "members" as const },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => onOpenTab({ tab: s.tab })}
                className="group rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition-all duration-300 hover:border-transparent hover:shadow-md"
                style={{ ["--stat-accent" as any]: s.accent }}
              >
                <s.icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" style={{ color: s.accent }} />
                <p className="mt-1.5 text-lg font-extrabold leading-none">{s.value}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Messages (24h)</span>
            <strong className="flex items-center gap-1"><MessageSquare className="h-3 w-3 text-indigo-500" /> {bundle.pulse?.messages_24h || 0}</strong>
          </div>
        </div>

        {/* Tasteful sponsored slot (server-gated; never for Pro/Sponsor) */}
        <AdSlot surface="world" />
      </div>
    </div>
  )
}
