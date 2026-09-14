"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/skeletons"
import {
  ChevronRight,
  Coins,
  Flame,
  Gamepad2,
  Hourglass,
  ListChecks,
  MessagesSquare,
  MonitorPlay,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  ClipboardList,
  EyeOff,
  Zap,
} from "lucide-react"
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

const ACCENTS: Record<string, { chip: string; bar: string; ring: string; text: string }> = {
  violet: { chip: "bg-violet-500/10 text-violet-500", bar: "bg-violet-500", ring: "ring-violet-500/30", text: "text-violet-500" },
  amber: { chip: "bg-amber-500/10 text-amber-600", bar: "bg-amber-500", ring: "ring-amber-500/30", text: "text-amber-600" },
  emerald: { chip: "bg-emerald-500/10 text-emerald-500", bar: "bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-500" },
  cyan: { chip: "bg-cyan-500/10 text-cyan-500", bar: "bg-cyan-500", ring: "ring-cyan-500/30", text: "text-cyan-500" },
  rose: { chip: "bg-rose-500/10 text-rose-500", bar: "bg-rose-500", ring: "ring-rose-500/30", text: "text-rose-500" },
  sky: { chip: "bg-sky-500/10 text-sky-500", bar: "bg-sky-500", ring: "ring-sky-500/30", text: "text-sky-500" },
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

/* ------------------------------------------------------------------ */

export default function QuestsClient() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [justClaimed, setJustClaimed] = useState<string | null>(null)

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

    const out: { key: BoardSection | "completed"; label: string; icon: React.ElementType; quests: BoardQuest[] }[] = []

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
    if (featuredRest.length > 0) out.push({ key: "featured", label: "Featured", icon: Sparkles, quests: featuredRest })

    if (claimed.length > 0) out.push({ key: "completed", label: "Completed", icon: Trophy, quests: claimed })

    return out
  }, [data])

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

  return (
    <div className="mx-auto max-w-5xl px-3 pb-24 pt-4 sm:px-5 sm:pt-6">
      {/* Hero */}
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          QUESTS
        </h1>
        <p className="mt-1 text-lg font-semibold text-foreground/90 sm:text-xl">
          Do more. Earn more. Unlock more.
        </p>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Complete missions across Loop, discover new experiences, and earn rewards along the way.
        </p>
      </header>

      {/* Progress header */}
      {data && (
        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quest Level</p>
              <Badge variant="secondary" className="rounded-full">{xp?.level ?? 1}</Badge>
            </div>
            <p className="mt-1 text-xl font-bold">{xp?.name ?? "Explorer"}</p>
            <div className="mt-2 space-y-1">
              <Progress value={xpPercent} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                {xp?.xp ?? 0} XP{xp?.nextXp ? ` · next level at ${xp.nextXp}` : " · max level"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Loop Coins</p>
              <Coins className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums">{(data.coins || 0).toLocaleString()}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {data.caps.earned_today_coins}/{data.caps.daily_coin_cap} earned today
              </span>
              <Link href="/wallet" className="font-medium text-primary hover:underline">
                Wallet
              </Link>
            </div>
            <Progress
              value={Math.min(100, (data.caps.earned_today_coins / Math.max(1, data.caps.daily_coin_cap)) * 100)}
              className="mt-1 h-1"
            />
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Daily Streak</p>
              <Flame className={cn("h-4 w-4", (data.streak.current || 0) > 0 ? "text-orange-500" : "text-muted-foreground")} />
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {data.streak.current || 0} <span className="text-sm font-medium text-muted-foreground">day{(data.streak.current || 0) === 1 ? "" : "s"}</span>
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Best: {data.streak.best || 0} · Complete a daily quest to keep it going
            </p>
          </div>
        </section>
      )}

      {/* Claimable banner */}
      {claimableCount > 0 && (
        <section className="mb-8 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold">
                  {claimableCount} reward{claimableCount === 1 ? "" : "s"} ready to claim
                </p>
                <p className="text-sm text-muted-foreground">Finish the loop — collect what you earned.</p>
              </div>
            </div>
            <Button size="sm" className="rounded-full" onClick={() => document.getElementById("section-completed-claim")?.scrollIntoView({ behavior: "smooth" })}>
              View
            </Button>
          </div>
        </section>
      )}

      {/* Sections */}
      {data && sections.length === 0 && (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="font-medium">No quests right now</p>
          <p className="text-sm text-muted-foreground">New quests and missions land regularly. Check back soon.</p>
        </div>
      )}

      {sections.map((section) => (
        <section key={`${section.key}-${section.label}`} className="mb-9">
          <div className="mb-3 flex items-center gap-2">
            <section.icon className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">{section.label}</h2>
            <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
              {section.quests.length}
            </Badge>
          </div>

          {/* Featured mission gets a wide card */}
          {section.key === "featured" && section.quests[0] ? (
            <FeaturedMissionCard quest={section.quests[0]} onClaim={claim} claiming={claiming === section.quests[0].id} justClaimed={justClaimed === section.quests[0].id} onHide={hideQuest} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.quests.map((q) => (
                <QuestCard
                  key={q.id}
                  quest={q}
                  onClaim={claim}
                  claiming={claiming === q.id}
                  justClaimed={justClaimed === q.id}
                  onHide={hideQuest}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* History link */}
      <div className="mt-4 flex justify-center">
        <Button variant="outline" className="rounded-full" asChild>
          <Link href="/quests/history">
            <Trophy className="mr-2 h-4 w-4" /> Quest history
          </Link>
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function QuestCard({
  quest,
  onClaim,
  claiming,
  justClaimed,
  onHide,
}: {
  quest: BoardQuest
  onClaim: (q: BoardQuest) => void
  claiming: boolean
  justClaimed: boolean
  onHide: (id: string) => void
}) {
  const a = ACCENTS[quest.accent || ""] || ACCENTS.violet
  const TypeIcon = TYPE_ICON[quest.quest_type] || Target
  const timeLeft = formatTimeRemaining(quest.ends_at)
  const est = estimateLabel(quest.est_minutes)
  const isMission = quest.quest_kind === "mission"
  const href = `/quests/${quest.id}`

  const cta =
    quest.state === "claimable" ? "Claim reward"
    : quest.state === "in_progress" ? "Continue"
    : quest.state === "claimed" ? "Claimed"
    : quest.state === "expired" ? "Expired"
    : quest.cta_text || "Start quest"

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        justClaimed && "quest-complete-burst",
      )}
    >
      {/* Banner / artwork */}
      <Link href={href} className="relative block h-24 overflow-hidden bg-muted">
        {quest.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={quest.banner_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center", a.chip)}>
            <TypeIcon className="h-8 w-8 opacity-70" />
          </div>
        )}
        {quest.is_sponsored && (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Sponsored
          </span>
        )}
        {timeLeft && (
          <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold">
            {timeLeft}
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault()
            onHide(quest.id)
          }}
          title="Hide this quest"
          className="absolute bottom-2 right-2 rounded-full bg-background/90 p-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <EyeOff className="h-3 w-3 text-muted-foreground" />
        </button>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-1.5">
          {quest.category && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", a.chip)}>
              {CATEGORY_LABEL[quest.category] || quest.category}
            </span>
          )}
          {quest.difficulty && quest.difficulty !== "easy" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {quest.difficulty}
            </span>
          )}
        </div>

        <Link href={href}>
          <h3 className="line-clamp-1 font-bold leading-snug hover:underline">{quest.title}</h3>
        </Link>
        {quest.description && (
          <p className="mt-0.5 line-clamp-2 min-h-[2rem] text-xs text-muted-foreground">{quest.description}</p>
        )}

        {/* Progress */}
        <div className="mt-3">
          {isMission && quest.mission_progress ? (
            <>
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>MISSION PROGRESS</span>
                <span>{quest.mission_progress.done} / {quest.mission_progress.total} COMPLETE</span>
              </div>
              <Progress value={(quest.mission_progress.done / Math.max(1, quest.mission_progress.total)) * 100} className="h-1.5" />
            </>
          ) : quest.state !== "claimed" && quest.state !== "expired" ? (
            <>
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>PROGRESS</span>
                <span>{quest.progress.count} / {quest.progress.required}</span>
              </div>
              <Progress value={quest.progress.percent} className="h-1.5" />
            </>
          ) : (
            <p className="text-[11px] font-medium text-emerald-600">{quest.state === "claimed" ? "Completed and claimed" : "Expired"}</p>
          )}
        </div>

        {/* Reward + meta */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {quest.reward_coins && quest.reward_coins > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
              <Coins className="h-3 w-3" /> {quest.reward_coins.toLocaleString()}
            </span>
          )}
          {quest.reward_xp && quest.reward_xp > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-violet-500">
              <Zap className="h-3 w-3" /> {quest.reward_xp.toLocaleString()} XP
            </span>
          )}
          {quest.reward_item_preview && (
            <span className="inline-flex items-center gap-1 font-semibold text-pink-500">
              <Sparkles className="h-3 w-3" /> {quest.reward_item_preview.name}
            </span>
          )}
          {est && <span>{est}</span>}
        </div>

        {/* CTA */}
        <div className="mt-4">
          {quest.state === "claimable" ? (
            <Button size="sm" className="w-full rounded-full" disabled={claiming} onClick={() => onClaim(quest)}>
              {claiming ? <Spinner className="h-4 w-4" /> : <Trophy className="mr-1 h-3.5 w-3.5" />}
              Claim reward
            </Button>
          ) : quest.state === "claimed" || quest.state === "expired" ? (
            <Button size="sm" variant="outline" className="w-full rounded-full" disabled asChild>
              <span>{cta}</span>
            </Button>
          ) : (
            <Button size="sm" variant={quest.state === "in_progress" ? "secondary" : "default"} className="w-full rounded-full" asChild>
              <Link href={href}>
                {cta}
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function FeaturedMissionCard({
  quest,
  onClaim,
  claiming,
  justClaimed,
  onHide,
}: {
  quest: BoardQuest
  onClaim: (q: BoardQuest) => void
  claiming: boolean
  justClaimed: boolean
  onHide: (id: string) => void
}) {
  const a = ACCENTS[quest.accent || ""] || ACCENTS.violet
  const timeLeft = formatTimeRemaining(quest.ends_at)
  const done = quest.mission_progress?.done ?? 0
  const total = quest.mission_progress?.total ?? 5

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-card", justClaimed && "quest-complete-burst")}>
      <div className="relative h-36 bg-muted sm:h-44">
        {quest.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={quest.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center", a.chip)}>
            <ListChecks className="h-12 w-12 opacity-60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        {quest.is_sponsored && (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Sponsored{sponsorSuffix(quest.sponsor_name)}
          </span>
        )}
        {timeLeft && (
          <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">
            {timeLeft}
          </span>
        )}
        <button
          onClick={() => onHide(quest.id)}
          title="Hide this quest"
          className="absolute bottom-3 right-3 rounded-full bg-background/90 p-1.5"
        >
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="p-5 sm:p-6">
        <p className={cn("text-[11px] font-bold uppercase tracking-widest", a.text)}>Featured Mission</p>
        <h3 className="mt-1 text-2xl font-black tracking-tight">{quest.title}</h3>
        {quest.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{quest.description}</p>}

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
            <span className="uppercase tracking-wide text-muted-foreground">Mission Progress</span>
            <span>{done} / {total} COMPLETE</span>
          </div>
          <Progress value={(done / Math.max(1, total)) * 100} className="h-2" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {quest.reward_coins && quest.reward_coins > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-600">
              <Coins className="h-4 w-4" /> {quest.reward_coins.toLocaleString()} Loop Coins
            </span>
          )}
          {quest.reward_item_preview && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 px-3 py-1 text-sm font-bold text-pink-500">
              <Sparkles className="h-4 w-4" /> {quest.reward_item_preview.name}
            </span>
          )}
          <div className="ml-auto">
            {quest.state === "claimable" ? (
              <Button className="rounded-full" disabled={claiming} onClick={() => onClaim(quest)}>
                {claiming ? <Spinner className="h-4 w-4" /> : <Trophy className="mr-1.5 h-4 w-4" />}
                Claim reward
              </Button>
            ) : quest.state === "claimed" ? (
              <Button variant="outline" className="rounded-full" disabled>
                Claimed
              </Button>
            ) : (
              <Button asChild className="rounded-full">
                <Link href={`/quests/${quest.id}`}>
                  {quest.state === "in_progress" ? "Continue mission" : "Start mission"}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function sponsorSuffix(name: string | null): string {
  return name ? ` · ${name}` : ""
}
