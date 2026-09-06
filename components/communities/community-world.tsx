"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
import { iconForSpace } from "@/components/communities/world-spaces"
import { AdSlot } from "@/components/ads/ad-slot"
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
  Loader2,
  Menu,
  Sprout,
  Home,
  ExternalLink,
  X,
} from "lucide-react"
import Link from "next/link"

const PULSE_EMOJI: Record<string, string> = {
  quiet: "Moon",
  growing: "Sprout",
  active: "Zap",
  very_active: "Zap",
  exploding: "Flame",
}

interface FocusTarget {
  tab: string
  id?: number | string
  ts: number
}

export function CommunityWorld({ communityId }: { communityId: string }) {
  const { user } = useAuth()
  const router = useRouter()
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
        router.push(`/circles/${communityId}`)
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
      { id: "projects", label: "Projects", icon: FolderOpen },
      { id: "challenges", label: "Challenges", icon: Trophy },
      { id: "memory", label: "Memory", icon: History },
      { id: "members", label: "Members", icon: UsersRound },
    ]
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
            {joining ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
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
              <BadgeCheck className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-background p-0.5 text-blue-500" />
            )}
          </div>

          <div className="flex-1 min-w-0 pt-2 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{c.name}</h1>
              {c.is_private && <Lock className="h-4 w-4 text-muted-foreground" />}
              {c.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500 border border-blue-500/30">
                  <BadgeCheck className="h-3 w-3" /> OFFICIAL
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold">
                {cfg.emoji} {cfg.label}
              </span>
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
                <Button variant="outline" className="rounded-full flex-1 sm:flex-none" onClick={() => router.push(`/circles/${communityId}`)}>
                  <Check className="h-4 w-4 mr-1.5 text-emerald-500" /> Joined
                </Button>
              ) : (
                <Button className="rounded-full bg-indigo-600 hover:bg-indigo-500 flex-1 sm:flex-none" onClick={join} disabled={joining}>
                  {joining ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Users className="h-4 w-4 mr-1.5" />}
                  {c.is_private ? "Request to join" : "Join world"}
                </Button>
              )}
              <Button variant="outline" size="icon" className="rounded-full" onClick={share} title="Share">
                {shared ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" className="rounded-full md:hidden" onClick={() => setMenuOpen(true)} title="More">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Pulse strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Flame className="h-3 w-3 text-orange-500" /> Community pulse
            </p>
            <p className="mt-1 text-lg font-extrabold">
              {pulse.label || "Quiet"}
            </p>
          </div>
          <button
            onClick={() => openTab({ tab: "feed" })}
            className="rounded-2xl border border-border bg-card p-3.5 text-left transition hover:border-indigo-500/40"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-indigo-500" /> Discussing
            </p>
            <p className="mt-1 text-lg font-extrabold">{pulse.discussing || 0}</p>
          </button>
          <button
            onClick={() => openTab({ tab: "feed" })}
            className="rounded-2xl border border-border bg-card p-3.5 text-left transition hover:border-fuchsia-500/40"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Palette className="h-3 w-3 text-fuchsia-500" /> Creating
            </p>
            <p className="mt-1 text-lg font-extrabold">{pulse.creating || 0}</p>
          </button>
          <button
            onClick={() => openTab({ tab: "feed" })}
            className="rounded-2xl border border-border bg-card p-3.5 text-left transition hover:border-amber-500/40"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Vote className="h-3 w-3 text-amber-500" /> Voting
            </p>
            <p className="mt-1 text-lg font-extrabold">{pulse.voting || 0}</p>
          </button>
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
                {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Users className="h-3.5 w-3.5 mr-1" />} Join world
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => router.push(`/circles/${communityId}`)}>
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Open community chat
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
                      <span>{iconForSpace(s.icon)}</span> {s.name}
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
    { key: "creativity", label: "Creativity", value: dna.creativity || 0 },
    { key: "debate", label: "Debate", value: dna.debate || 0 },
    { key: "humor", label: "Humor", value: dna.humor || 0 },
    { key: "knowledge", label: "Knowledge", value: dna.knowledge || 0 },
    { key: "collaboration", label: "Collaboration", value: dna.collaboration || 0 },
  ]

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
              {happening.map((h: any, i: number) => (
                <button
                  key={i}
                  onClick={() => onOpenItem(h)}
                  className="w-full flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-indigo-500/40 hover:bg-indigo-500/5"
                >
                  <span className="text-lg">{h.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{h.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{h.description}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/60" />
                </button>
              ))}
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
                  className="w-full flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5"
                >
                  <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{m.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.description}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/60" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right column: DNA + evolution + ads */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="font-bold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-fuchsia-500" /> Community DNA
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Measured from real member activity this week</p>
          <div className="space-y-3">
            {dnaBars.map((d) => (
              <div key={d.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{d.label}</span>
                  <span className="font-bold">{d.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all"
                    style={{ width: `${d.value}%` }}
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

        {/* Quick stats */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-2 text-sm">
          <button
            onClick={() => onOpenTab({ tab: "projects" })}
            className="flex w-full justify-between rounded-lg p-1 text-left transition hover:bg-muted/50"
          >
            <span className="text-muted-foreground">Active projects</span>
            <strong>{bundle.projects?.filter((p: any) => p.status === "active").length || 0}</strong>
          </button>
          <button
            onClick={() => onOpenTab({ tab: "challenges" })}
            className="flex w-full justify-between rounded-lg p-1 text-left transition hover:bg-muted/50"
          >
            <span className="text-muted-foreground">Live challenges</span>
            <strong>{bundle.challenges?.filter((ch: any) => ch.status === "active").length || 0}</strong>
          </button>
          <button onClick={() => onOpenTab({ tab: "members" })} className="flex w-full justify-between rounded-lg p-1 text-left transition hover:bg-muted/50">
            <span className="text-muted-foreground">Spaces</span>
            <strong>{bundle.spaces?.length || 0}</strong>
          </button>
          <button onClick={() => onOpenTab({ tab: "feed" })} className="flex w-full justify-between rounded-lg p-1 text-left transition hover:bg-muted/50">
            <span className="text-muted-foreground">Messages (24h)</span>
            <strong>{bundle.pulse?.messages_24h || 0}</strong>
          </button>
          <div className="flex justify-between rounded-lg p-1">
            <span className="text-muted-foreground">New members (24h)</span>
            <strong>{bundle.pulse?.new_members_24h || 0}</strong>
          </div>
        </div>

        {/* Tasteful sponsored slot (server-gated; never for Pro/Sponsor) */}
        <AdSlot surface="world" />
      </div>
    </div>
  )
}
