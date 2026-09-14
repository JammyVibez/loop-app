"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/skeletons"
import { cn } from "@/lib/utils"
import {
  Coins,
  Crown,
  Gamepad2,
  Gift,
  Hourglass,
  Lock,
  PartyPopper,
  Play,
  Target,
  Timer,
  Trophy,
  Zap,
  ClipboardList,
  Sparkles,
} from "lucide-react"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface QuestProgress {
  count: number
  required: number
  percent: number
  completed: boolean
  claimed: boolean
  reset_label: string
}

interface QuestItem {
  id: string
  title: string
  description: string | null
  icon: string | null
  accent: string | null
  quest_type: "ad" | "survey" | "minigame" | "native"
  minigame_kind: string | null
  requirement_count: number
  cadence: "daily" | "weekly" | "seasonal"
  ends_at: string | null
  reward_type: string
  reward_coins: number | null
  reward_xp: number | null
  reward_item_id: number | null
  reward_label: string | null
  visibility: string
  progress: QuestProgress
  reward_item_preview: { name: string; preview_data: any; rarity: string } | null
}

interface Caps {
  daily_coin_cap: number
  daily_xp_cap: number
  earned_today_coins: number
  earned_today_xp: number
}

type Session =
  | { kind: "trivia"; sessionId: string; questions: Array<{ index: number; question: string; options: Array<{ id: number; text: string }> }> }
  | { kind: "reaction"; sessionId: string; rounds: number; targetAvgMs: number }
  | null

/* ------------------------------------------------------------------ */
/* Accent palette                                                      */
/* ------------------------------------------------------------------ */

const ACCENTS: Record<string, { ring: string; glow: string; bar: string; text: string; chip: string; halo: string }> = {
  violet: {
    ring: "border-violet-500/40", glow: "shadow-[0_0_24px_-4px_rgba(139,92,246,0.5)]",
    bar: "from-violet-500 to-fuchsia-400", text: "text-violet-400", chip: "bg-violet-500/15 text-violet-400",
    halo: "from-violet-500/20",
  },
  amber: {
    ring: "border-amber-500/40", glow: "shadow-[0_0_24px_-4px_rgba(245,158,11,0.5)]",
    bar: "from-amber-500 to-orange-400", text: "text-amber-400", chip: "bg-amber-500/15 text-amber-400",
    halo: "from-amber-500/20",
  },
  emerald: {
    ring: "border-emerald-500/40", glow: "shadow-[0_0_24px_-4px_rgba(16,185,129,0.5)]",
    bar: "from-emerald-500 to-teal-400", text: "text-emerald-400", chip: "bg-emerald-500/15 text-emerald-400",
    halo: "from-emerald-500/20",
  },
  cyan: {
    ring: "border-cyan-500/40", glow: "shadow-[0_0_24px_-4px_rgba(6,182,212,0.5)]",
    bar: "from-cyan-500 to-sky-400", text: "text-cyan-400", chip: "bg-cyan-500/15 text-cyan-400",
    halo: "from-cyan-500/20",
  },
  rose: {
    ring: "border-rose-500/40", glow: "shadow-[0_0_24px_-4px_rgba(244,63,94,0.5)]",
    bar: "from-rose-500 to-pink-400", text: "text-rose-400", chip: "bg-rose-500/15 text-rose-400",
    halo: "from-rose-500/20",
  },
  sky: {
    ring: "border-sky-500/40", glow: "shadow-[0_0_24px_-4px_rgba(14,165,233,0.5)]",
    bar: "from-sky-500 to-blue-400", text: "text-sky-400", chip: "bg-sky-500/15 text-sky-400",
    halo: "from-sky-500/20",
  },
}

const TYPE_META: Record<string, { label: string; icon: any }> = {
  ad: { label: "Watch ad", icon: Play },
  survey: { label: "Survey", icon: ClipboardList },
  minigame: { label: "Mini-game", icon: Gamepad2 },
  native: { label: "In-app", icon: Target },
}

function QuestIcon({ name, className }: { name: string | null; className?: string }) {
  const map: Record<string, any> = { target: Target, coins: Coins, zap: Zap, crown: Crown, gift: Gift, game: Gamepad2, trophy: Trophy, timer: Timer }
  const Icon = map[name || "target"] || Target
  return <Icon className={className} />
}

/* ------------------------------------------------------------------ */
/* Animated progress bar                                               */
/* ------------------------------------------------------------------ */

function ProgressBar({ percent, accent, done }: { percent: number; accent: string; done: boolean }) {
  const a = ACCENTS[accent] || ACCENTS.violet
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "relative h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
          a.bar,
          done && "animate-[quest-pop_0.5s_ease-out_1]",
        )}
        style={{ width: `${Math.max(percent, done ? 100 : 3)}%` }}
      >
        {/* moving sheen */}
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute inset-y-0 -left-full w-1/2 animate-[quest-sheen_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Quest card                                                          */
/* ------------------------------------------------------------------ */

function QuestCard({
  quest,
  claiming,
  justCompleted,
  onClaim,
  onStart,
}: {
  quest: QuestItem
  claiming: boolean
  justCompleted: string | null
  onClaim: (q: QuestItem) => void
  onStart: (q: QuestItem) => void
}) {
  const a = ACCENTS[quest.accent ?? "violet"] || ACCENTS.violet
  const typeMeta = TYPE_META[quest.quest_type] || TYPE_META.native
  const TypeIcon = typeMeta.icon
  const p = quest.progress
  const burst = justCompleted === quest.id

  const rewardBits: string[] = []
  if (quest.reward_coins && quest.reward_coins > 0) rewardBits.push(`🪙 ${quest.reward_coins.toLocaleString()}`)
  if (quest.reward_xp && quest.reward_xp > 0) rewardBits.push(`⚡ ${quest.reward_xp.toLocaleString()} XP`)
  if (quest.reward_item_preview) rewardBits.push(quest.reward_item_preview.name)

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300",
        p.completed ? cn(a.ring, a.glow) : "border-border/60 hover:border-border",
        burst && "animate-[quest-burst_0.9s_ease-out_1]",
      )}
    >
      {/* accent halo */}
      <div className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl transition-opacity group-hover:opacity-100", a.halo, p.completed ? "opacity-90" : "opacity-40")} />

      {/* completion burst */}
      {burst && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <PartyPopper className={cn("h-14 w-14 animate-[quest-burst-icon_0.9s_ease-out_1]", a.text)} />
        </div>
      )}

      <div className="relative p-4">
        <div className="flex items-start gap-3">
          {/* icon tile */}
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", a.chip)}>
            <QuestIcon name={quest.icon} className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-sm font-bold">{quest.title}</h3>
              <Badge variant="secondary" className={cn("gap-1 border-0 text-[9px] font-bold uppercase", a.chip)}>
                <TypeIcon className="h-2.5 w-2.5" /> {typeMeta.label}
              </Badge>
              {quest.visibility === "pro" && (
                <Badge className="border-0 bg-amber-500/15 text-[9px] font-bold text-amber-500">PRO</Badge>
              )}
            </div>
            {quest.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{quest.description}</p>
            )}
          </div>

          {/* reward */}
          <div className="shrink-0 text-right">
            {quest.reward_label ? (
              <span className={cn("text-xs font-black", a.text)}>{quest.reward_label}</span>
            ) : (
              rewardBits.slice(0, 2).map((b) => (
                <p key={b} className={cn("text-xs font-black leading-tight", a.text)}>{b}</p>
              ))
            )}
          </div>
        </div>

        {/* progress */}
        <div className="mt-3 space-y-1.5">
          <ProgressBar percent={p.percent} accent={quest.accent || "violet"} done={p.completed} />
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-muted-foreground">
              {p.completed ? "Complete!" : `${p.count} / ${p.required}`}
              {quest.requirement_count > 1 && !p.completed && " steps"}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground/80">
              <Hourglass className="h-3 w-3" /> {p.reset_label}
            </span>
          </div>
        </div>

        {/* action */}
        <div className="mt-3">
          {p.claimed ? (
            <div className={cn("flex items-center justify-center gap-1.5 rounded-xl bg-muted/50 py-2 text-xs font-bold", a.text)}>
              <Trophy className="h-3.5 w-3.5" /> Reward claimed
            </div>
          ) : p.completed ? (
            <Button
              onClick={() => onClaim(quest)}
              disabled={claiming}
              size="sm"
              className={cn("w-full rounded-xl bg-gradient-to-r text-white font-bold", a.bar, "hover:opacity-90")}
            >
              {claiming ? <Spinner className="mr-2 h-3.5 w-3.5" /> : <Gift className="mr-2 h-3.5 w-3.5" />}
              Claim reward
            </Button>
          ) : quest.quest_type === "minigame" ? (
            <Button onClick={() => onStart(quest)} size="sm" variant="outline" className="w-full rounded-xl text-xs font-bold">
              <Gamepad2 className="mr-2 h-3.5 w-3.5" /> Play now
            </Button>
          ) : quest.quest_type === "ad" ? (
            <Button onClick={() => onStart(quest)} size="sm" variant="outline" className="w-full rounded-xl text-xs font-bold">
              <Play className="mr-2 h-3.5 w-3.5" /> Watch ad
            </Button>
          ) : quest.quest_type === "survey" ? (
            <Button onClick={() => onStart(quest)} size="sm" variant="outline" className="w-full rounded-xl text-xs font-bold">
              <ClipboardList className="mr-2 h-3.5 w-3.5" /> Take survey
            </Button>
          ) : (
            <div className="rounded-xl bg-muted/40 py-2 text-center text-[11px] font-medium text-muted-foreground">
              {p.count > 0 ? "Keep going — progress saves automatically" : "Do the action in-app to start"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mini-game modals                                                    */
/* ------------------------------------------------------------------ */

function TriviaModal({ session, getAuthHeader, onDone }: { session: NonNullable<Session> & { kind: "trivia" }; getAuthHeader: () => Record<string, string>; onDone: (res: any) => void }) {
  const [answers, setAnswers] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const pick = (qIndex: number, optId: number) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[qIndex] = optId
      return next
    })
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/quests/minigame", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ session_id: session.sessionId, answers }),
      })
      const data = await res.json().catch(() => ({}))
      onDone(data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Answer all {session.questions.length} to max your reward.</p>
      {session.questions.map((q, qi) => (
        <div key={qi} className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <p className="mb-2 text-sm font-semibold">{qi + 1}. {q.question}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {q.options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(qi, o.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-left text-xs transition",
                  answers[qi] === o.id
                    ? "border-violet-400 bg-violet-500/15 font-bold text-violet-500"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {o.text}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={submit} disabled={submitting || answers.filter((a) => a !== undefined).length < session.questions.length} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white">
        {submitting ? <Spinner className="mr-2 h-4 w-4" /> : <Trophy className="mr-2 h-4 w-4" />} Submit answers
      </Button>
    </div>
  )
}

function ReactionGame({ session, getAuthHeader, onDone }: { session: NonNullable<Session> & { kind: "reaction" }; getAuthHeader: () => Record<string, string>; onDone: (res: any) => void }) {
  const [state, setState] = useState<"idle" | "waiting" | "go" | "done">("idle")
  const [round, setRound] = useState(0)
  const [times, setTimes] = useState<number[]>([])
  const goAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const startRound = () => {
    if (round >= session.rounds) return
    setState("waiting")
    timer.current = setTimeout(() => {
      goAt.current = Date.now()
      setState("go")
    }, 900 + Math.random() * 2200)
  }

  const tap = () => {
    if (state === "waiting") {
      // too early — restart this round
      if (timer.current) clearTimeout(timer.current)
      setState("idle")
      return
    }
    if (state === "go") {
      const ms = Date.now() - goAt.current
      const next = [...times, ms]
      setTimes(next)
      if (next.length >= session.rounds) {
        setState("done")
        void (async () => {
          const res = await fetch("/api/quests/minigame", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify({ session_id: session.sessionId, reaction_times_ms: next }),
          })
          const data = await res.json().catch(() => ({}))
          onDone(data)
        })()
      } else {
        setRound(next.length)
        setState("idle")
      }
    }
  }

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0

  return (
    <div className="space-y-3 text-center">
      <p className="text-xs text-muted-foreground">
        Round {Math.min(round + 1, session.rounds)} / {session.rounds} · Beat {session.targetAvgMs}ms average
      </p>
      <button
        type="button"
        onClick={tap}
        disabled={state === "done"}
        className={cn(
          "flex h-44 w-full items-center justify-center rounded-2xl border-2 text-lg font-black transition-colors select-none",
          state === "idle" && "border-border bg-muted/40 text-muted-foreground",
          state === "waiting" && "border-rose-500/60 bg-rose-500/10 text-rose-400",
          state === "go" && "border-emerald-400 bg-emerald-500/20 text-emerald-400",
          state === "done" && "border-border bg-muted/40",
        )}
      >
        {state === "idle" && "Tap to start round"}
        {state === "waiting" && "Wait for green…"}
        {state === "go" && "TAP!"}
        {state === "done" && `Avg ${avg}ms`}
      </button>
      {times.length > 0 && state !== "done" && (
        <p className="text-xs text-muted-foreground">Last: {times[times.length - 1]}ms · Avg: {avg}ms</p>
      )}
      {state === "done" && <Spinner className="mx-auto h-4 w-4" />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function QuestsClient() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [quests, setQuests] = useState<QuestItem[]>([])
  const [caps, setCaps] = useState<Caps | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState<string | null>(null)
  const [gameOpen, setGameOpen] = useState(false)
  const [gameQuest, setGameQuest] = useState<QuestItem | null>(null)
  const [session, setSession] = useState<Session>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/quests", { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setQuests(data.quests || [])
        setCaps(data.caps || null)
      }
    } catch {
      // offline — keep old list
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user) return
    void load()
    const t = setInterval(() => void load(), 60_000) // light refresh for reset timers
    return () => clearInterval(t)
  }, [user, load])

  const grouped = useMemo(() => {
    const g: Record<string, QuestItem[]> = { daily: [], weekly: [], seasonal: [] }
    for (const q of quests) g[q.cadence]?.push(q)
    return g
  }, [quests])

  const handleClaim = async (quest: QuestItem) => {
    setClaiming(quest.id)
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: quest.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Claim failed")
      const parts: string[] = []
      if (data.reward?.coins > 0) parts.push(`🪙 ${data.reward.coins.toLocaleString()} coins`)
      if (data.reward?.xp > 0) parts.push(`⚡ ${data.reward.xp.toLocaleString()} XP`)
      if (data.reward?.item_qty > 0) parts.push("🎁 an item")
      toast({
        title: data.leveled_up ? "Reward claimed — LEVEL UP! 🎉" : "Reward claimed! 🎉",
        description: `You earned ${parts.join(" + ") || "a reward"}.`,
      })
      void load()
    } catch (e: any) {
      toast({ title: "Claim failed", description: e.message, variant: "destructive" })
    } finally {
      setClaiming(null)
    }
  }

  const startGame = async (quest: QuestItem) => {
    setGameQuest(quest)
    setSession(null)
    setGameOpen(true)
    try {
      const res = await fetch(`/api/quests/minigame?quest_id=${quest.id}`, { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not start")
      if (data.kind === "trivia") {
        setSession({ kind: "trivia", sessionId: data.session_id, questions: data.questions })
      } else {
        setSession({ kind: "reaction", sessionId: data.session_id, rounds: data.rounds, targetAvgMs: data.target_avg_ms })
      }
    } catch (e: any) {
      toast({ title: "Couldn't start the game", description: e.message, variant: "destructive" })
      setGameOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  const onGameDone = async (res: any) => {
    setGameOpen(false)
    if (res?.error) {
      toast({ title: "Game error", description: res.error, variant: "destructive" })
      return
    }
    const score = res?.score_pct ?? 0
    if (res?.quest?.completed) {
      setJustCompleted(res.quest.quest_id ?? gameQuest?.id ?? null)
      setTimeout(() => setJustCompleted(null), 1200)
      toast({ title: `Quest complete! (${score}% score)`, description: "Claim your reward on the quest card." })
    } else {
      toast({ title: `Scored ${score}%`, description: "Progress saved — play again to finish the quest." })
    }
    void load()
  }

  const capPct = caps && caps.daily_coin_cap > 0 ? Math.min(100, Math.round((caps.earned_today_coins / caps.daily_coin_cap) * 100)) : 0

  if (!user) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20">
          <Sparkles className="h-8 w-8 text-violet-400" />
        </div>
        <h1 className="text-2xl font-black">Quests await</h1>
        <p className="text-sm text-muted-foreground">Sign in to earn coins, XP, and rare cosmetics by completing daily quests.</p>
        <Link href="/login">
          <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white">Sign in to play</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/25 shadow-[0_0_30px_-6px_rgba(139,92,246,0.5)]">
          <Sparkles className="h-6 w-6 text-violet-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight">Quests</h1>
          <p className="text-xs text-muted-foreground">Earn coins, XP, and rare loot — new quests every day.</p>
        </div>
      </div>

      {/* Daily cap meter */}
      {caps && (
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-bold">Today's quest earnings</span>
            <span className="text-muted-foreground">
              🪙 {caps.earned_today_coins.toLocaleString()} / {caps.daily_coin_cap.toLocaleString()} · ⚡ {caps.earned_today_xp.toLocaleString()} / {caps.daily_xp_cap.toLocaleString()}
            </span>
          </div>
          <ProgressBar percent={capPct} accent="amber" done={false} />
          <p className="mt-1.5 text-[10px] text-muted-foreground">Daily caps keep the economy fair — they reset at midnight UTC.</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : quests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Target className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-3 text-sm font-bold">No quests right now</h3>
          <p className="mt-1 text-xs text-muted-foreground">New quests drop daily — check back soon!</p>
        </div>
      ) : (
        <>
          {(["daily", "weekly", "seasonal"] as const).map((cadence) => {
            if (grouped[cadence].length === 0) return null
            const sectionMeta = {
              daily: { title: "Daily Quests", icon: Timer, hint: "Reset every 24 hours", accent: "text-cyan-400" },
              weekly: { title: "Weekly Quests", icon: Trophy, hint: "Reset every Monday", accent: "text-violet-400" },
              seasonal: { title: "Seasonal & Special", icon: Crown, hint: "Limited-time events", accent: "text-amber-400" },
            }[cadence]
            const SectionIcon = sectionMeta.icon
            return (
              <section key={cadence} className="space-y-3">
                <div className="flex items-center gap-2">
                  <SectionIcon className={cn("h-4 w-4", sectionMeta.accent)} />
                  <h2 className="text-sm font-black uppercase tracking-wide">{sectionMeta.title}</h2>
                  <span className="text-[11px] text-muted-foreground">· {sectionMeta.hint}</span>
                </div>
                <div className="space-y-3">
                  {grouped[cadence].map((q) => (
                    <QuestCard
                      key={q.id}
                      quest={q}
                      claiming={claiming === q.id}
                      justCompleted={justCompleted}
                      onClaim={handleClaim}
                      onStart={startGame}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}

      {/* Mini-game modal */}
      {gameOpen && gameQuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setGameOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-black">
                <Gamepad2 className="h-4 w-4 text-violet-400" /> {gameQuest.title}
              </h3>
              <button type="button" onClick={() => setGameOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">✕</button>
            </div>
            {!session ? (
              <div className="flex items-center justify-center py-10"><Spinner className="h-6 w-6" /></div>
            ) : session.kind === "trivia" ? (
              <TriviaModal session={session} getAuthHeader={getAuthHeader} onDone={onGameDone} />
            ) : (
              <ReactionGame session={session} getAuthHeader={getAuthHeader} onDone={onGameDone} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
