"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PageHeader, StatTile } from "@/components/ui/page-header"
import { Spinner } from "@/components/ui/skeletons"
import {
  Check,
  ChevronRight,
  ClipboardList,
  Coins,
  EyeOff,
  Flame,
  Gamepad2,
  History,
  Hourglass,
  ListChecks,
  MessagesSquare,
  MonitorPlay,
  Package,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"
import {
  formatTimeRemaining,
  estimateLabel,
  sectionForQuest,
  type BoardSection,
} from "@/lib/quests-v2"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface BoardQuest {
  id: string
  title: string
  description: string | null
  icon: string | null
  accent: string | null
  banner_url: string | null
  thumbnail_url: string | null
  category: string | null
  difficulty: string | null
  est_minutes: number | null
  quest_type: string
  quest_kind: string
  cadence: string
  starts_at: string | null
  ends_at: string | null
  reward_coins: number | null
  reward_xp: number | null
  reward_label: string | null
  reward_item_preview: { name: string; rarity: string } | null
  sponsor_name: string | null
  is_sponsored: boolean
  featured: boolean
  auto_claim: boolean
  cta_text: string | null
  state: string
  /** True once the user has accepted (or started) this quest in this window. */
  accepted?: boolean
  progress: { count: number; required: number; percent: number; completed: boolean; claimed: boolean; reset_label: string }
  mission_progress: { done: number; total: number } | null
}

interface BoardData {
  quests: BoardQuest[]
  quest_xp: { xp: number; level: number; name: string; minXp: number; nextXp: number | null }
  streak: { current: number; best: number; last_day: string | null }
  coins: number
  caps: { daily_coin_cap: number; daily_xp_cap: number; earned_today_coins: number; earned_today_xp: number }
}

const ACCENTS: Record<string, { chip: string; bar: string; ring: string; text: string; wash: string }> = {
  violet: { chip: "bg-violet-500/10 text-violet-500", bar: "bg-violet-500", ring: "ring-violet-500/30", text: "text-violet-500", wash: "from-violet-500/25" },
  amber: { chip: "bg-amber-500/10 text-amber-600", bar: "bg-amber-500", ring: "ring-amber-500/30", text: "text-amber-600", wash: "from-amber-500/25" },
  emerald: { chip: "bg-emerald-500/10 text-emerald-500", bar: "bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-500", wash: "from-emerald-500/25" },
  cyan: { chip: "bg-cyan-500/10 text-cyan-500", bar: "bg-cyan-500", ring: "ring-cyan-500/30", text: "text-cyan-500", wash: "from-cyan-500/25" },
  rose: { chip: "bg-rose-500/10 text-rose-500", bar: "bg-rose-500", ring: "ring-rose-500/30", text: "text-rose-500", wash: "from-rose-500/25" },
  sky: { chip: "bg-sky-500/10 text-sky-500", bar: "bg-sky-500", ring: "ring-sky-500/30", text: "text-sky-500", wash: "from-sky-500/25" },
}

const TYPE_ICON: Record<string, React.ElementType> = {
  ad: MonitorPlay,
  survey: ClipboardList,
  minigame: Gamepad2,
  native: Target,
}

const CATEGORY_LABEL: Record<string, string> = {
  community: "Community",
  discovery: "Discovery",
  watch: "Watch & Earn",
  survey: "Survey",
  game: "Games",
  sponsored: "Sponsored",
  creator: "Creator",
  seasonal: "Limited Time",
}

type SectionKey = BoardSection | "completed"

/* ------------------------------------------------------------------ */

export default function QuestsClient() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)
  // Quests accepted in this session, so the button flips immediately instead
  // of waiting for the board refetch.
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [justClaimed, setJustClaimed] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | SectionKey>("all")

  const load = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch("/api/quests", { headers: getAuthHeader() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load quests")
      setData(json)
    } catch (err: any) {
      toast({ title: "Could not load quests", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeader, toast])

  useEffect(() => {
    load()
  }, [load])

  const claim = async (q: BoardQuest) => {
    setClaiming(q.id)
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: q.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Claim failed")
      if (json.already_claimed) {
        toast({ title: "Already claimed", description: "This quest's reward is already in your wallet." })
        load()
        return
      }
      setJustClaimed(q.id)
      setTimeout(() => setJustClaimed(null), 2600)
      toast({
        title: "Reward claimed",
        description: [
          json.coins > 0 ? `+${json.coins} Loop Coins` : null,
          json.xp > 0 ? `+${json.xp} XP` : null,
          json.collection ? `${json.collection} unlocked` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })
      load()
    } catch (err: any) {
      toast({ title: "Claim failed", description: err.message, variant: "destructive" })
    } finally {
      setClaiming(null)
    }
  }

  const accept = async (q: BoardQuest) => {
    setAccepting(q.id)
    setAccepted((prev) => new Set(prev).add(q.id))
    try {
      const res = await fetch("/api/quests/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: q.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not accept this quest")
      toast({ title: "Quest accepted", description: `${q.title} is now tracking your activity.` })
      load()
    } catch (err: any) {
      setAccepted((prev) => {
        const next = new Set(prev)
        next.delete(q.id)
        return next
      })
      toast({ title: "Could not accept quest", description: err.message, variant: "destructive" })
    } finally {
      setAccepting(null)
    }
  }

  const hideQuest = async (questId: string) => {
    setData((prev) => (prev ? { ...prev, quests: prev.quests.filter((x) => x.id !== questId) } : prev))
    try {
      await fetch("/api/quests/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: questId }),
      })
      toast({ title: "Quest hidden" })
    } catch {
      load()
    }
  }

  /* ---------------- Sections ---------------- */

  const sections = useMemo(() => {
    if (!data) return []
    const byState = (list: BoardQuest[], states: string[]) => list.filter((q) => states.includes(q.state))
    const active = byState(data.quests, ["available", "in_progress", "claimable"])
    const claimed = byState(data.quests, ["claimed"])

    const out: { key: SectionKey; label: string; icon: React.ElementType; quests: BoardQuest[] }[] = []

    const featuredMission = active.filter((q) => q.quest_kind === "mission" && q.featured)
    if (featuredMission.length > 0) out.push({ key: "featured", label: "Featured Mission", icon: Star, quests: featuredMission })

    const missions = active.filter((q) => q.quest_kind === "mission" && !q.featured)
    if (missions.length > 0) out.push({ key: "missions", label: "Missions", icon: ListChecks, quests: missions })

    const daily = active.filter((q) => q.cadence === "daily")
    if (daily.length > 0) out.push({ key: "daily", label: "Daily Quests", icon: Flame, quests: daily })

    const weekly = active.filter((q) => q.cadence === "weekly")
    if (weekly.length > 0) out.push({ key: "weekly", label: "Weekly Quests", icon: TrendingUp, quests: weekly })

    const limited = active.filter((q) => sectionForQuest(q) === "limited" && q.cadence !== "daily" && q.cadence !== "weekly")
    if (limited.length > 0) out.push({ key: "limited", label: "Limited Time", icon: Hourglass, quests: limited })

    const games = active.filter((q) => sectionForQuest(q) === "games")
    if (games.length > 0) out.push({ key: "games", label: "Games", icon: Gamepad2, quests: games })

    const surveys = active.filter((q) => sectionForQuest(q) === "surveys")
    if (surveys.length > 0) out.push({ key: "surveys", label: "Surveys", icon: ClipboardList, quests: surveys })

    const watch = active.filter((q) => sectionForQuest(q) === "watch")
    if (watch.length > 0) out.push({ key: "watch", label: "Watch & Earn", icon: MonitorPlay, quests: watch })

    const community = active.filter((q) => sectionForQuest(q) === "community")
    if (community.length > 0) out.push({ key: "community", label: "Community Missions", icon: MessagesSquare, quests: community })

    const featuredRest = active.filter(
      (q) => q.featured && !featuredMission.includes(q) && !daily.includes(q) && !weekly.includes(q) && !limited.includes(q) && !games.includes(q) && !surveys.includes(q) && !watch.includes(q) && !community.includes(q) && !missions.includes(q),
    )
    if (featuredRest.length > 0) out.push({ key: "featured", label: "Featured", icon: Star, quests: featuredRest })

    if (claimed.length > 0) out.push({ key: "completed", label: "Completed", icon: Trophy, quests: claimed })

    return out
  }, [data])

  const visibleSections = useMemo(
    () => (filter === "all" ? sections : sections.filter((section) => section.key === filter)),
    [sections, filter],
  )

  const filters = useMemo(
    () =>
      sections.map((section) => ({
        key: section.key,
        label: section.label,
        icon: section.icon,
        count: section.quests.length,
      })),
    [sections],
  )

  /* ---------------- Render ---------------- */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }

  const xp = data?.quest_xp
  const xpPercent = xp?.nextXp ? Math.min(100, Math.round(((xp.xp - xp.minXp) / (xp.nextXp - xp.minXp)) * 100)) : 100
  const claimableCount = data?.quests.filter((q) => q.state === "claimable").length ?? 0
  const coinPercent = Math.min(100, ((data?.caps.earned_today_coins || 0) / Math.max(1, data?.caps.daily_coin_cap || 1)) * 100)

  return (
    <div className="w-full pb-28 pt-3 sm:pt-5">
      <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Quest board"
          title="Quests"
          description="Short missions across Loop — write, reply, run a Circle, play a round. Finish them to collect coins and XP."
          actions={
            <>
              <Button asChild size="sm" className="rounded-lg">
                <Link href={claimableCount > 0 ? "#ready-to-claim" : "#quest-sections"}>
                  {claimableCount > 0
                    ? `Claim ${claimableCount} reward${claimableCount === 1 ? "" : "s"}`
                    : "Browse quests"}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-lg">
                <Link href="/quests/history">
                  <History className="mr-1.5 h-3.5 w-3.5" /> History
                </Link>
              </Button>
            </>
          }
        />

        {/* Summary: level, earnings today, streak. Same numbers the cards use. */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Level"
            value={xp?.level ?? 1}
            hint={
              xp?.nextXp
                ? `${xp?.name ?? "Explorer"} · ${Math.max(0, xp.nextXp - (xp?.xp ?? 0)).toLocaleString()} XP to next`
                : `${xp?.name ?? "Explorer"} · max level`
            }
            progress={xpPercent}
          />
          <StatTile
            label="Coins today"
            value={`${(data?.caps.earned_today_coins || 0).toLocaleString()}`}
            hint={`of ${(data?.caps.daily_coin_cap || 0).toLocaleString()} daily cap`}
            progress={coinPercent}
            icon={Coins}
          />
          <StatTile
            label="XP today"
            value={`${(data?.caps.earned_today_xp || 0).toLocaleString()}`}
            hint={`of ${(data?.caps.daily_xp_cap || 0).toLocaleString()} daily cap`}
            progress={Math.min(100, ((data?.caps.earned_today_xp || 0) / Math.max(1, data?.caps.daily_xp_cap || 1)) * 100)}
            icon={Zap}
          />
          <StatTile
            label="Streak"
            value={`${data?.streak.current || 0}d`}
            hint={`Best ${data?.streak.best || 0} day${(data?.streak.best || 0) === 1 ? "" : "s"} · ${(data?.coins || 0).toLocaleString()} coins`}
            icon={Flame}
          />
        </div>

        {/* ── Ready to claim ───────────────────────────────────── */}
        {claimableCount > 0 && (
          <section
            id="ready-to-claim"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3.5"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                <Trophy className="h-4 w-4 text-amber-500" />
              </span>
              <div>
                <p className="text-sm font-bold">
                  {claimableCount} reward{claimableCount === 1 ? "" : "s"} waiting
                </p>
                <p className="text-xs text-muted-foreground">You finished the work — take the coins.</p>
              </div>
            </div>
            <Button
              size="sm"
              className="rounded-full bg-amber-500 text-white hover:bg-amber-500/90"
              onClick={() => document.getElementById("quest-sections")?.scrollIntoView({ behavior: "smooth" })}
            >
              Show claimable
            </Button>
          </section>
        )}

        {/* ── Filters ──────────────────────────────────────────── */}
        {sections.length > 0 && (
          <div className="sticky top-0 z-20 -mx-3 mt-4 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[{ key: "all" as const, label: "All", icon: ListChecks, count: data?.quests.length ?? 0 }, ...filters].map((item) => {
                const active = filter === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      active
                        ? "border-transparent bg-foreground text-background"
                        : "border-border/70 bg-card/60 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                    <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground/70")}>
                      {item.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Sections ─────────────────────────────────────────── */}
        <div id="quest-sections" className="mt-5">
          {data && sections.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/70 p-16 text-center">
              <Target className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40" />
              <p className="font-semibold">No quests right now</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                New missions land all the time. Follow a Circle or check back tomorrow — daily quests reset at midnight.
              </p>
              <Button asChild variant="outline" className="mt-5 rounded-full">
                <Link href="/communities">
                  <Users className="mr-1.5 h-4 w-4" /> Find a Circle
                </Link>
              </Button>
            </div>
          )}

          {visibleSections.map((section) => (
            <section key={`${section.key}-${section.label}`} className="mb-10 last:mb-0">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="flex items-center gap-2">
                  <section.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">{section.label}</h2>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {section.quests.length}
                  </span>
                </div>
                {section.key === "daily" && (
                  <span className="hidden text-[11px] font-medium text-muted-foreground sm:inline">
                    Resets daily · {formatTimeRemaining(section.quests[0]?.ends_at) || "midnight"}
                  </span>
                )}
              </div>

              {section.key === "featured" && section.quests[0] ? (
                <div className="space-y-4">
                  <FeaturedMissionCard
                    quest={section.quests[0]}
                    onClaim={claim}
                    claiming={claiming === section.quests[0].id}
                    justClaimed={justClaimed === section.quests[0].id}
                    onHide={hideQuest}
                    onAccept={accept}
                    accepting={accepting === section.quests[0].id}
                    accepted={accepted.has(section.quests[0].id)}
                  />
                  {section.quests.slice(1).length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {section.quests.slice(1).map((q) => (
                        <QuestCard
                          key={q.id}
                          quest={q}
                          onClaim={claim}
                          claiming={claiming === q.id}
                          justClaimed={justClaimed === q.id}
                          onHide={hideQuest}
                          onAccept={accept}
                          accepting={accepting === q.id}
                          accepted={accepted.has(q.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {section.quests.map((q) => (
                    <QuestCard
                      key={q.id}
                      quest={q}
                      onClaim={claim}
                      claiming={claiming === q.id}
                      justClaimed={justClaimed === q.id}
                      onHide={hideQuest}
                      onAccept={accept}
                      accepting={accepting === q.id}
                      accepted={accepted.has(q.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* ── Bottom rail ──────────────────────────────────────── */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/50 px-5 py-4">
          <div>
            <p className="text-sm font-bold">Wondering where a reward went?</p>
            <p className="text-xs text-muted-foreground">Every claim is listed with its timestamp.</p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/quests/history">
              <History className="mr-1.5 h-4 w-4" /> Quest history
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */

function QuestCard({
  quest,
  onClaim,
  claiming,
  justClaimed,
  onHide,
  onAccept,
  accepting,
  accepted,
}: {
  quest: BoardQuest
  onClaim: (q: BoardQuest) => void
  claiming: boolean
  justClaimed: boolean
  onHide: (id: string) => void
  onAccept: (q: BoardQuest) => void
  accepting: boolean
  accepted: boolean
}) {
  const a = ACCENTS[quest.accent || ""] || ACCENTS.violet
  const TypeIcon = TYPE_ICON[quest.quest_type] || Target
  const timeLeft = formatTimeRemaining(quest.ends_at)
  const est = estimateLabel(quest.est_minutes)
  const isMission = quest.quest_kind === "mission"
  const isNative = quest.quest_type === "native"
  const href = `/quests/${quest.id}`
  const isAccepted =
    accepted ||
    isNative &&
      (Boolean(quest.accepted) ||
        quest.state === "in_progress" ||
        quest.state === "claimable" ||
        quest.state === "claimed")
  const isClaimed = quest.state === "claimed"

  const cta =
    quest.state === "claimable" ? "Claim reward"
    : quest.state === "in_progress" ? "Continue"
    : quest.state === "claimed" ? "Claimed"
    : quest.state === "expired" ? "Expired"
    : quest.cta_text || "Start quest"

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors duration-200",
        // A finished quest is framed in green, so "done" is readable from the
        // card itself without opening it.
        isClaimed
          ? "border-emerald-500/45 ring-1 ring-emerald-500/25"
          : quest.state === "claimable"
            ? "border-emerald-500/35"
            : "border-border/70 hover:border-foreground/15",
        justClaimed && "quest-complete-burst",
      )}
    >
      <Link href={href} className="relative block h-32 overflow-hidden bg-muted">
        {quest.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={quest.banner_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-muted/60">
            <TypeIcon className={cn("h-9 w-9 opacity-70", a.text)} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />

        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {quest.is_sponsored ? (
            <span className="rounded-full bg-background/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
              {quest.sponsor_name ? quest.sponsor_name : "Sponsored"}
            </span>
          ) : quest.category ? (
            <span className={cn("rounded-full bg-background/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur", a.text)}>
              {CATEGORY_LABEL[quest.category] || quest.category}
            </span>
          ) : (
            <span />
          )}
          {timeLeft && (
            <span className="rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold tabular-nums backdrop-blur">
              {timeLeft}
            </span>
          )}
        </div>

        <button
          onClick={(event) => {
            event.preventDefault()
            onHide(quest.id)
          }}
          title="Hide this quest"
          className="absolute bottom-2 right-2 rounded-full bg-background/85 p-1.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
        >
          <EyeOff className="h-3 w-3 text-muted-foreground" />
        </button>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          <TypeIcon className="h-3 w-3" />
          <span className="uppercase tracking-wider">{quest.quest_type === "native" ? "In LOOP" : quest.quest_type}</span>
          {quest.difficulty && quest.difficulty !== "easy" && (
            <>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              <span className="capitalize">{quest.difficulty}</span>
            </>
          )}
        </div>

        <Link href={href} className="mt-0.5">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug transition-colors group-hover:text-primary">
            {quest.title}
          </h3>
        </Link>
        {quest.description && (
          <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-relaxed text-muted-foreground">{quest.description}</p>
        )}

        <div className="mt-3">
          {isMission && quest.mission_progress ? (
            <>
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Mission</span>
                <span className="tabular-nums">
                  {quest.mission_progress.done} / {quest.mission_progress.total}
                </span>
              </div>
              <Progress value={(quest.mission_progress.done / Math.max(1, quest.mission_progress.total)) * 100} className="h-1.5" />
            </>
          ) : quest.state !== "claimed" && quest.state !== "expired" ? (
            <>
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Progress</span>
                <span className="tabular-nums">
                  {quest.progress.count} / {quest.progress.required}
                </span>
              </div>
              <Progress value={quest.progress.percent} className={cn("h-1.5", quest.state === "claimable" && "[&>div]:bg-emerald-500")} />
            </>
          ) : (
            <p className={cn("text-[11px] font-semibold", quest.state === "claimed" ? "text-emerald-600" : "text-muted-foreground")}>
              {quest.state === "claimed" ? "Completed and claimed" : "Expired"}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {!!quest.reward_coins && quest.reward_coins > 0 && (
            <span className="inline-flex items-center gap-1 font-bold text-amber-600">
              <Coins className="h-3 w-3" /> {quest.reward_coins.toLocaleString()}
            </span>
          )}
          {!!quest.reward_xp && quest.reward_xp > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
              <Zap className="h-3 w-3 text-primary" /> {quest.reward_xp.toLocaleString()} XP
            </span>
          )}
          {quest.reward_item_preview && (
            <span className="inline-flex items-center gap-1 font-bold text-pink-500">
              <Package className="h-3 w-3" /> {quest.reward_item_preview.name}
            </span>
          )}
          {est && <span className="text-muted-foreground">{est}</span>}
        </div>

        <div className="mt-4 pt-0">
          {quest.state === "claimable" ? (
            <Button
              size="sm"
              className="w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-600/90"
              disabled={claiming}
              onClick={() => onClaim(quest)}
            >
              {claiming ? <Spinner className="h-4 w-4" /> : <Trophy className="mr-1.5 h-3.5 w-3.5" />}
              Claim reward
            </Button>
          ) : isClaimed ? (
            // Green, disabled and labelled: the frame and the button both say
            // the reward is already in the wallet.
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              disabled
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Claimed
            </Button>
          ) : quest.state === "expired" ? (
            <Button size="sm" variant="outline" className="w-full rounded-full" disabled asChild>
              <span>Expired</span>
            </Button>
          ) : isNative && isAccepted ? (
            // Accepted tracking quests have no further button to press: the
            // work is detected from normal activity. Checked before the
            // "available" branch so an accepted quest never offers Accept again.
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              disabled
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Accepted
            </Button>
          ) : isNative && quest.state === "available" ? (
            <Button
              size="sm"
              className="w-full rounded-full"
              disabled={accepting}
              onClick={() => onAccept(quest)}
            >
              {accepting ? <Spinner className="h-4 w-4" /> : <Target className="mr-1.5 h-3.5 w-3.5" />}
              Accept quest
            </Button>
          ) : (
            <Button
              size="sm"
              variant={quest.state === "in_progress" ? "secondary" : "default"}
              className="w-full rounded-full"
              asChild
            >
              <Link href={href}>
                {cta}
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */

function FeaturedMissionCard({
  quest,
  onClaim,
  claiming,
  justClaimed,
  onHide,
  onAccept,
  accepting,
  accepted,
}: {
  quest: BoardQuest
  onClaim: (q: BoardQuest) => void
  claiming: boolean
  justClaimed: boolean
  onHide: (id: string) => void
  onAccept: (q: BoardQuest) => void
  accepting: boolean
  accepted: boolean
}) {
  const a = ACCENTS[quest.accent || ""] || ACCENTS.violet
  const timeLeft = formatTimeRemaining(quest.ends_at)
  const done = quest.mission_progress?.done ?? 0
  const total = quest.mission_progress?.total ?? 5

  return (
    <article
      className={cn(
        "relative grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[1.15fr_1fr]",
        quest.state === "claimed"
          ? "border-emerald-500/45 ring-1 ring-emerald-500/25"
          : quest.state === "claimable"
            ? "border-emerald-500/35"
            : "border-border/70",
        justClaimed && "quest-complete-burst",
      )}
    >
      <div className="relative min-h-[210px] overflow-hidden bg-muted lg:min-h-[280px]">
        {quest.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={quest.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/60">
            <ListChecks className={cn("h-14 w-14 opacity-70", a.text)} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-card" />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
            {quest.is_sponsored ? `Sponsored${sponsorSuffix(quest.sponsor_name)}` : "Featured mission"}
          </span>
          <div className="flex items-center gap-1.5">
            {timeLeft && (
              <span className="rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-bold tabular-nums backdrop-blur">
                {timeLeft}
              </span>
            )}
            <button
              onClick={() => onHide(quest.id)}
              title="Hide this quest"
              className="rounded-full bg-background/85 p-1.5 backdrop-blur"
            >
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center p-5 sm:p-7">
        <p className={cn("text-[10px] font-bold uppercase tracking-[0.16em]", a.text)}>Featured mission</p>
        <h3 className="mt-1.5 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{quest.title}</h3>
        {quest.description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{quest.description}</p>
        )}

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
            <span className="text-muted-foreground">Mission progress</span>
            <span className="tabular-nums">
              {done} / {total}
            </span>
          </div>
          <Progress value={(done / Math.max(1, total)) * 100} className="h-2" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!!quest.reward_coins && quest.reward_coins > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600">
              <Coins className="h-3.5 w-3.5" /> {quest.reward_coins.toLocaleString()}
            </span>
          )}
          {!!quest.reward_xp && quest.reward_xp > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5" /> {quest.reward_xp.toLocaleString()} XP
            </span>
          )}
          {quest.reward_item_preview && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-500">
              <Package className="h-3.5 w-3.5" /> {quest.reward_item_preview.name}
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {quest.state === "claimable" ? (
            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-600/90" disabled={claiming} onClick={() => onClaim(quest)}>
              {claiming ? <Spinner className="h-4 w-4" /> : <Trophy className="mr-1.5 h-4 w-4" />}
              Claim reward
            </Button>
          ) : quest.state === "claimed" ? (
            <Button
              variant="outline"
              className="rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              disabled
            >
              <Check className="mr-1.5 h-4 w-4" /> Claimed
            </Button>
          ) : quest.quest_type === "native" && quest.state === "available" ? (
            <Button className="rounded-full" disabled={accepting} onClick={() => onAccept(quest)}>
              {accepting ? <Spinner className="h-4 w-4" /> : <Target className="mr-1.5 h-4 w-4" />}
              Accept quest
            </Button>
          ) : quest.quest_type === "native" && (accepted || quest.state === "in_progress") ? (
            <Button
              variant="outline"
              className="rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              disabled
            >
              <Check className="mr-1.5 h-4 w-4" /> Accepted
            </Button>
          ) : (
            <Button asChild className="rounded-full">
              <Link href={`/quests/${quest.id}`}>
                {quest.state === "in_progress" ? "Continue mission" : "Start mission"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="rounded-full">
            <Link href={`/quests/${quest.id}`}>Details</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

function sponsorSuffix(name: string | null): string {
  return name ? ` · ${name}` : ""
}
