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
import { CircleCanvas } from "@/components/communities/circle-canvas"
import { NewThreadDialog, ThreadsBoard } from "@/components/communities/threads-board"
import { WorldPowers } from "@/components/communities/world-powers"
import { WelcomeOnboarding } from "@/components/communities/welcome-onboarding"
import { CommunityBookmarks } from "@/components/communities/community-bookmarks"
import { CommunityChat } from "@/components/communities/community-chat"
import { CommunityAdminModal } from "@/components/communities/community-admin-modal"
import { spaceIcon } from "@/components/communities/world-spaces"
import type { ThreadRecord } from "@/components/communities/thread-row"
import { AdSlot } from "@/components/ads/ad-slot"
import { Spinner } from "@/components/ui/skeletons"
import {
  Users,
  Share2,
  Lock,
  MessageSquare,
  MessageCircle,
  ArrowLeft,
  Activity,
  ShieldCheck,
  Settings,
  Link as LinkIcon,
  Check,
  Menu,
  Sprout,
  LayoutGrid,
  Layers,
  Sparkles,
  X,
  Bookmark,
  Crown,
} from "lucide-react"
import Link from "next/link"
import { VerifiedSeal } from "@/components/ui/verified-seal"

interface FocusTarget {
  tab: string
  id?: number | string
  ts: number
}

/** Tabs kept out of the bar but still reachable from the canvas. */
const VALID_TABS = [
  "canvas",
  "threads",
  "feed",
  "chat",
  "members",
  "powers",
  "moderation",
  "settings",
  // Contextual surfaces (opened from canvas cards / deep links)
  "overview",
  "spaces",
  "projects",
  "challenges",
  "memory",
  "bots",
  "bookmarks",
]

export function CommunityWorld({ communityId }: { communityId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [bundle, setBundle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [locked, setLocked] = useState(false)
  const [joining, setJoining] = useState(false)
  const [tab, setTab] = useState("canvas")
  const [shared, setShared] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [justJoined, setJustJoined] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const [spaceRequest, setSpaceRequest] = useState<{ id: string; token: number } | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [focusThreadId, setFocusThreadId] = useState<number | null>(null)

  // Deep links like /communities/[id]?tab=threads still work.
  useEffect(() => {
    const t = searchParams?.get("tab") || ""
    if (!t) return
    if (t === "overview") setTab("canvas")
    else if (VALID_TABS.includes(t)) setTab(t)
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
    setTab(target.tab === "overview" ? "canvas" : target.tab)
    if (target.id) setFocus({ tab: target.tab, id: target.id, ts: Date.now() })
    else setFocus(null)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const openThread = useCallback((thread: ThreadRecord) => {
    setFocusThreadId(thread.id)
    setTab("threads")
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  /** Deep-link a happening/record/loop item to the real content. */
  const openItem = useCallback(
    (item: any) => {
      if (!item) return
      const ref = item.ref_type
      if (ref === "member" && item.ref_username) {
        router.push(`/profile/${item.ref_username}`)
        return
      }
      if (ref === "event") {
        openTab({ tab: "feed" })
        return
      }
      const tabFor =
        ref === "thread"
          ? "threads"
          : ref === "project"
            ? "projects"
            : ref === "challenge" || ref === "challenge_entry"
              ? "challenges"
              : ref === "memory"
                ? "memory"
                : "feed"
      const id =
        ref === "poll" ? item.post_id || item.ref_id : ref === "challenge_entry" ? item.challenge_id || item.ref_id : item.ref_id
      if (tabFor === "threads" && id) {
        setFocusThreadId(Number(id))
        setTab("threads")
        return
      }
      openTab({ tab: tabFor, id })
    },
    [openTab, router]
  )

  const tabs = useMemo(() => {
    if (!bundle) return []
    const items: Array<{ id: string; label: string; icon: any }> = [
      { id: "canvas", label: "Canvas", icon: LayoutGrid },
      { id: "threads", label: "Threads", icon: Layers },
      { id: "feed", label: "Feed", icon: MessageSquare },
      { id: "chat", label: "Chat", icon: MessageCircle },
      { id: "members", label: "Members", icon: Users },
    ]
    if (bundle.is_member) items.push({ id: "powers", label: "Powers", icon: Sparkles })
    if (bundle.is_moderator) items.push({ id: "moderation", label: "Moderation", icon: ShieldCheck })
    if (bundle.is_admin) items.push({ id: "settings", label: "Settings", icon: Settings })
    return items
  }, [bundle])

  const threads = (bundle?.threads || []) as ThreadRecord[]
  const openThreads = threads.filter((t) => (t.state || "open") === "open").length

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (locked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
            <Lock className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold">This community is private</h1>
          <p className="text-sm text-muted-foreground">
            Membership is approved by the community team before you can see anything.
          </p>
          <Button onClick={join} disabled={joining} className="rounded-full">
            {joining ? <Spinner className="mr-1.5 h-4 w-4" /> : null}
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
        <div className="space-y-3 text-center">
          <p className="text-lg font-semibold text-red-500">{error}</p>
          <Link href="/communities">
            <Button variant="outline" className="rounded-full">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to communities
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
  const accent = c.accent_color || cfg.accent

  return (
    <div className="pb-16">
      {/* Banner — flat brand colour, or the artwork the community uploaded */}
      <div className="relative h-36 w-full overflow-hidden sm:h-44" style={{ background: accent }}>
        {bannerUrl ? <Image src={bannerUrl} alt="" fill className="object-cover" unoptimized /> : null}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0.55))" }} />
      </div>

      <div className="relative -mt-14 px-4 sm:-mt-16 sm:px-6">
        {/* Header */}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <Avatar className="h-20 w-20 rounded-2xl border-4 border-background shadow-lg sm:h-24 sm:w-24">
            <AvatarImage src={c.avatar_url || ""} alt={c.name} />
            <AvatarFallback className="rounded-2xl text-2xl font-bold text-white" style={{ background: accent }}>
              {c.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 pt-1 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{c.name}</h1>
              {c.is_private && <Lock className="h-4 w-4 text-muted-foreground" />}
              {c.is_verified && <VerifiedSeal size={18} variant="emerald" title="Official community" />}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                {cfg.label}
              </span>
            </div>
            {c.description ? (
              <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">{c.description}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground tabular-nums">
                <Users className="h-3.5 w-3.5" /> {formatNumber(memberCount)}
              </span>
              <span className="tabular-nums">{openThreads} open threads</span>
              {pulse.active_now > 0 ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 tabular-nums">
                  <Activity className="h-3.5 w-3.5" /> {pulse.active_now} active now
                </span>
              ) : null}
              {c.handle ? <span className="font-mono text-[11px]">/communities/{c.handle}</span> : null}
            </div>
          </div>

          <div className="flex w-full items-center gap-2 pt-1 sm:w-auto sm:pt-0">
            <div className="flex flex-1 items-center gap-2 sm:flex-none">
              {bundle.is_member ? (
                <Button className="flex-1 rounded-full sm:flex-none" onClick={() => setNewThreadOpen(true)}>
                  <Layers className="mr-1.5 h-4 w-4" /> New thread
                </Button>
              ) : (
                <Button className="flex-1 rounded-full sm:flex-none" onClick={join} disabled={joining}>
                  {joining ? <Spinner className="mr-1.5 h-4 w-4" /> : <Users className="mr-1.5 h-4 w-4" />}
                  {c.is_private ? "Request to join" : "Join"}
                </Button>
              )}
              <Button variant="outline" size="icon" className="rounded-full" onClick={share} title="Share">
                {shared ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
              </Button>
              {bundle.is_admin && (
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setAdminOpen(true)}
                  title="Admin panel"
                >
                  <Crown className="h-4 w-4 text-amber-500" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full md:hidden"
                onClick={() => setMenuOpen(true)}
                title="More"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => openTab({ tab: t.id })}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
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
          {tab === "canvas" && (
            <CircleCanvas
              bundle={bundle}
              communityId={communityId}
              onOpenTab={openTab}
              onOpenItem={openItem}
              onOpenThread={openThread}
              onNewThread={() => {
                if (!bundle.is_member) return join()
                setNewThreadOpen(true)
              }}
            />
          )}

          {tab === "threads" && (
            <ThreadsBoard
              communityId={communityId}
              spaces={bundle.spaces || []}
              isMember={bundle.is_member}
              openThreadId={focusThreadId}
              onThreadOpened={() => setFocusThreadId(null)}
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

          {tab === "chat" && bundle.is_member && (
            <CommunityChat communityId={communityId} spaces={bundle.spaces || []} canModerate={bundle.is_moderator} />
          )}
          {tab === "chat" && !bundle.is_member && (
            <div className="py-12 text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-semibold">Join this community to chat</p>
              <p className="mt-1 text-xs text-muted-foreground">You must be a member to take part in chat.</p>
            </div>
          )}

          {tab === "powers" && <WorldPowers communityId={communityId} canManageHint={bundle.is_admin} />}

          {tab === "members" && (
            <WorldMembers
              communityId={communityId}
              initial={bundle.recent_members || []}
              viewerRole={bundle.role}
              viewerId={bundle.viewer}
              powers={bundle.powers || []}
              powerAssignments={bundle.power_assignments || {}}
              onOpenPowers={() => openTab({ tab: "powers" })}
            />
          )}

          {/* Contextual surfaces — reachable from canvas cards, kept out of the bar */}
          {tab === "spaces" && (
            <WorldSpaces
              communityId={communityId}
              spaces={bundle.spaces || []}
              canModerate={bundle.is_moderator}
              onChanged={() => setRefreshKey((k) => k + 1)}
            />
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
          {tab === "bookmarks" && <CommunityBookmarks communityId={communityId} />}
          {tab === "moderation" && <WorldModeration communityId={communityId} />}
          {tab === "settings" && (
            <WorldSettings communityId={communityId} bundle={bundle} onSaved={() => setRefreshKey((k) => k + 1)} />
          )}
        </div>

        <div className="mt-5">
          <AdSlot surface="world" />
        </div>
      </div>

      {/* New thread — available from the header and the canvas */}
      <NewThreadDialog
        open={newThreadOpen}
        onOpenChange={setNewThreadOpen}
        communityId={communityId}
        spaces={bundle.spaces || []}
        onCreated={(t) => {
          setFocusThreadId(t.id)
          setTab("threads")
          setRefreshKey((k) => k + 1)
        }}
      />

      {/* Mobile menu */}
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
                {joining ? <Spinner className="mr-1 h-3.5 w-3.5" /> : <Users className="mr-1 h-3.5 w-3.5" />} Join
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 rounded-full"
                onClick={() => {
                  setMenuOpen(false)
                  setNewThreadOpen(true)
                }}
              >
                <Layers className="mr-1 h-3.5 w-3.5" /> New thread
              </Button>
            )}
            <Button size="sm" variant="outline" className="rounded-full" onClick={share}>
              {shared ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={copyLink}>
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jump to</p>
          <div className="grid grid-cols-2 gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => openTab({ tab: t.id })}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                  tab === t.id ? "border-foreground/30 bg-muted text-foreground" : "border-border bg-card text-muted-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
            {bundle.is_member ? (
              <button
                onClick={() => openTab({ tab: "bookmarks" })}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-colors"
              >
                <Bookmark className="h-3.5 w-3.5" /> Saved
              </button>
            ) : null}
          </div>

          {(bundle.spaces || []).length > 0 ? (
            <>
              <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Spaces</p>
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
                      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {(() => {
                        const SIcon = spaceIcon(s.icon)
                        return <SIcon className="h-3.5 w-3.5" />
                      })()}
                      {s.name}
                    </button>
                  ))}
              </div>
            </>
          ) : null}

          {!bundle.is_member && (bundle.spaces || []).length === 0 ? (
            <p className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground">
              <Sprout className="mt-px h-3 w-3 shrink-0" />
              Join to open threads, post in the feed and take part in chat.
            </p>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            className="mt-4 w-full rounded-full text-muted-foreground"
            onClick={() => setMenuOpen(false)}
          >
            <X className="mr-1.5 h-3.5 w-3.5" /> Close
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

      {/* Admin panel */}
      <CommunityAdminModal
        open={adminOpen}
        onOpenChange={setAdminOpen}
        communityId={communityId}
        communityName={c.name || ""}
      />
    </div>
  )
}
