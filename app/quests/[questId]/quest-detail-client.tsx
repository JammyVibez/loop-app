"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/skeletons"
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  Coins,
  Gamepad2,
  Hourglass,
  Lock,
  MonitorPlay,
  Pause,
  Play,
  Gift,
  Package,
  Target,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { estimateLabel, formatTimeRemaining, type MissionStepConfig, type SurveyQuestionConfig } from "@/lib/quests-v2"

/* ------------------------------------------------------------------ */

interface DetailQuest {
  id: string
  title: string
  description: string | null
  icon: string | null
  accent: string | null
  banner_url: string | null
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
  sponsor_url: string | null
  is_sponsored: boolean
  featured: boolean
  auto_claim: boolean
  cta_text: string | null
  terms_text: string | null
  video_url: string | null
  video_seconds: number | null
  survey_config: SurveyQuestionConfig[]
  mission_config: MissionStepConfig[]
  game_config: { kind?: string; min_score?: number; max_attempts?: number }
  state: string
  /** True once the user accepted the quest (progress row exists for the window). */
  accepted?: boolean
  progress: { count: number; required: number; percent: number; completed: boolean; claimed: boolean }
  mission_progress: { done: number; total: number } | null
}

const SYMBOLS = ["triangle", "circle", "square", "diamond", "star", "hexagon", "cross", "moon"]

/* ------------------------------------------------------------------ */

export default function QuestDetailClient({ questId }: { questId: string }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [quest, setQuest] = useState<DetailQuest | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      // Detail = board payload filtered to this quest (single fetch, no dup logic).
      const res = await fetch("/api/quests", { headers: getAuthHeader() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load quest")
      const q = (json.quests || []).find((x: DetailQuest) => x.id === questId) || null
      setQuest(q)
    } catch (err: any) {
      toast({ title: "Could not load quest", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, questId, getAuthHeader, toast])

  useEffect(() => {
    load()
  }, [load])

  const claim = async () => {
    if (!quest) return
    setClaiming(true)
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: quest.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Claim failed")
      if (json.already_claimed) {
        toast({ title: "Already claimed", description: "This reward is already in your wallet." })
        load()
        return
      }
      const parts = [
        json.coins > 0 ? `+${json.coins} Loop Coins` : null,
        json.xp > 0 ? `+${json.xp} XP` : null,
        json.streak?.increased ? `Day ${json.streak.current} streak` : null,
        json.collection ? `${json.collection} unlocked` : null,
      ].filter(Boolean)
      setClaimResult(parts.join(" · ") || "Reward claimed")
      toast({ title: "Reward claimed", description: parts.join(" · ") })
      load()
    } catch (err: any) {
      toast({ title: "Claim failed", description: err.message, variant: "destructive" })
    } finally {
      setClaiming(false)
    }
  }

  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const start = async () => {
    setAccepting(true)
    // Flip the button immediately — the tracker takes over from here.
    setAccepted(true)
    try {
      const res = await fetch("/api/quests/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: questId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not accept this quest")
      toast({ title: "Quest accepted", description: "Your activity on Loop now counts toward it." })
      load()
    } catch (err: any) {
      setAccepted(false)
      toast({ title: "Could not accept quest", description: err.message, variant: "destructive" })
    } finally {
      setAccepting(false)
    }
  }

  /* ---------------- Render ---------------- */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }

  if (!quest) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
        <Target className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-xl font-bold">Quest not found</h1>
        <p className="text-sm text-muted-foreground">This quest may have ended or is not available to you.</p>
        <Button variant="outline" className="rounded-full" asChild>
          <Link href="/quests">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quests
          </Link>
        </Button>
      </div>
    )
  }

  const timeLeft = formatTimeRemaining(quest.ends_at)
  const est = estimateLabel(quest.est_minutes)

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-5 sm:pt-6">
      <Link href="/quests" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Quests
      </Link>

      {/* Artwork header */}
      <div className="relative mb-5 h-40 overflow-hidden rounded-2xl border bg-muted sm:h-52">
        {quest.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={quest.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-violet-500/10">
            <Target className="h-12 w-12 text-violet-500/60" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/95 to-transparent" />
        {quest.is_sponsored && (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Sponsored{quest.sponsor_name ? ` · ${quest.sponsor_name}` : ""}
          </span>
        )}
        {timeLeft && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">
            <Hourglass className="h-3 w-3" /> {timeLeft}
          </span>
        )}
      </div>

      {/* Title block */}
      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">{quest.quest_type.replace("_", " ")}</Badge>
          {quest.difficulty && <Badge variant="outline" className="rounded-full text-[10px]">{quest.difficulty}</Badge>}
          {est && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {est}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{quest.title}</h1>
        {quest.description && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{quest.description}</p>}
      </div>

      {/* Answer strip: what / how much / how long / when */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What do I do?</p>
          <p className="mt-1 text-sm font-medium">
            {quest.quest_kind === "mission"
              ? `Complete all ${quest.mission_config.length || quest.mission_progress?.total || 0} mission steps`
              : quest.quest_type === "ad"
                ? `Watch ${quest.video_seconds || 30} seconds of the video`
                : quest.quest_type === "survey"
                  ? `Answer ${quest.survey_config.length} questions`
                  : quest.quest_type === "minigame"
                    ? "Beat the challenge"
                    : `Complete ${quest.progress.required} action${quest.progress.required === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What do I earn?</p>
          <div className="mt-1 flex flex-wrap gap-2 text-sm font-semibold">
            {quest.reward_coins && quest.reward_coins > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600"><Coins className="h-4 w-4" /> {quest.reward_coins.toLocaleString()} Loop Coins</span>
            )}
            {quest.reward_xp && quest.reward_xp > 0 && (
              <span className="inline-flex items-center gap-1 text-violet-500"><Zap className="h-4 w-4" /> {quest.reward_xp.toLocaleString()} XP</span>
            )}
            {quest.reward_item_preview && (
              <span className="inline-flex items-center gap-1 text-pink-500"><Package className="h-4 w-4" /> {quest.reward_item_preview.name}</span>
            )}
            {!quest.reward_coins && !quest.reward_xp && !quest.reward_item_preview && (
              <span>{quest.reward_label || "Quest reward"}</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How long will it take?</p>
          <p className="mt-1 text-sm font-medium">{est || "A few minutes"}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">When does it end?</p>
          <p className="mt-1 text-sm font-medium">
            {timeLeft || (quest.ends_at ? "Ended" : quest.cadence === "daily" ? "Resets daily" : quest.cadence === "weekly" ? "Resets weekly" : "No end date")}
          </p>
        </div>
      </div>

      {/* Claim success */}
      {claimResult && (
        <div className="quest-complete-burst mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <BadgeCheck className="h-6 w-6 shrink-0 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-600">{claimResult}</p>
        </div>
      )}

      {/* Mission steps */}
      {quest.quest_kind === "mission" && quest.mission_config.length > 0 && (
        <MissionTracker quest={quest} onChanged={load} />
      )}

      {/* Type-specific interactive area */}
      {quest.quest_kind !== "mission" && (
        <div className="mb-6">
          {quest.quest_type === "ad" && <VideoQuest quest={quest} onComplete={load} />}
          {quest.quest_type === "survey" && <SurveyQuest quest={quest} onComplete={load} />}
          {quest.quest_type === "minigame" && <GameQuest quest={quest} onComplete={load} />}
          {quest.quest_type === "native" && (
            <NativeQuest quest={quest} onStart={start} accepting={accepting} accepted={accepted} />
          )}
        </div>
      )}

      {/* Progress summary + claim */}
      {quest.quest_kind !== "mission" && (
        <div
          className={cn(
            "rounded-2xl border bg-card p-4",
            // Finished quests get the green frame from the reference design.
            quest.state === "claimed" && "border-emerald-500/45 ring-1 ring-emerald-500/25",
            quest.state === "claimable" && "border-emerald-500/35",
          )}
        >
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
            <span className="uppercase tracking-wide text-muted-foreground">Progress</span>
            <span>{quest.progress.count} / {quest.progress.required}</span>
          </div>
          <Progress value={quest.progress.percent} className="h-2" />
          <div className="mt-4">
            {quest.state === "claimable" ? (
              <Button size="lg" className="w-full rounded-full" disabled={claiming} onClick={claim}>
                {claiming ? <Spinner className="h-4 w-4" /> : <Gift className="mr-1.5 h-4 w-4" />}
                Claim reward
              </Button>
            ) : quest.state === "claimed" ? (
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                disabled
              >
                <Check className="mr-1.5 h-4 w-4" /> Claimed
              </Button>
            ) : quest.state === "expired" ? (
              <Button size="lg" variant="outline" className="w-full rounded-full" disabled>
                Expired
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* Mission claim */}
      {quest.quest_kind === "mission" && quest.state === "claimable" && (
        <Button
          size="lg"
          className="w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-600/90"
          disabled={claiming}
          onClick={claim}
        >
          {claiming ? <Spinner className="h-4 w-4" /> : <Gift className="mr-1.5 h-4 w-4" />}
          Claim mission reward
        </Button>
      )}
      {quest.quest_kind === "mission" && quest.state === "claimed" && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/45 bg-emerald-500/5 p-4">
          <Check className="h-5 w-5 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Mission completed and claimed</p>
        </div>
      )}

      {/* Sponsor + terms */}
      {(quest.sponsor_name || quest.terms_text) && (
        <div className="mt-6 space-y-2 text-xs text-muted-foreground">
          {quest.sponsor_url && quest.sponsor_name && (
            <p>
              Sponsored by{" "}
              <a href={quest.sponsor_url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                {quest.sponsor_name}
              </a>
            </p>
          )}
          {quest.terms_text && <p className="whitespace-pre-wrap">{quest.terms_text}</p>}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Video quest — server-verified watch time                            */
/* ------------------------------------------------------------------ */

function VideoQuest({ quest, onComplete }: { quest: DetailQuest; onComplete: () => void }) {
  const { user, getAuthHeader } = useAuth()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingRef = useRef(0)
  const [watched, setWatched] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [done, setDone] = useState(quest.state === "claimed" || quest.state === "claimable")
  const required = quest.video_seconds || 30

  const sendTick = useCallback(async () => {
    const elapsed = pendingRef.current
    pendingRef.current = 0
    if (elapsed <= 0) return
    try {
      const res = await fetch("/api/quests/video", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: quest.id, session_action: "tick", elapsed }),
      })
      const json = await res.json()
      if (res.ok) {
        setWatched(json.watched || 0)
        if (json.completed && !done) {
          setDone(true)
          onComplete()
        }
      }
    } catch { /* retry next tick */ }
  }, [quest.id, getAuthHeader, done, onComplete])

  useEffect(() => {
    if (!user) return
    // Resume session.
    fetch("/api/quests/video", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ quest_id: quest.id, session_action: "start", elapsed: 0 }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json?.watched != null) {
          setWatched(json.watched)
          if (json.completed) setDone(true)
        }
      })
      .catch(() => {})

    tickRef.current = setInterval(() => {
      if (pendingRef.current > 0) void sendTick()
    }, 5000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      void sendTick()
    }
  }, [user, quest.id, getAuthHeader, sendTick])

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v || v.paused) return
    // Count only real playback: track delta since last event (max 1s granularity).
    pendingRef.current = Math.min(pendingRef.current + 1, 5)
    if (watched < required) setWatched((w) => Math.min(w + 1, required))
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-video w-full bg-black">
        {quest.video_url ? (
          <video
            ref={videoRef}
            src={quest.video_url}
            controls
            playsInline
            className="h-full w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => { setPlaying(false); void sendTick() }}
            onTimeUpdate={onTimeUpdate}
            onEnded={() => { setPlaying(false); void sendTick() }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <MonitorPlay className="h-10 w-10" />
            <p className="text-sm">Video coming soon for this quest</p>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
          <span className="uppercase tracking-wide text-muted-foreground">Verified watch time</span>
          <span className={cn(done && "text-emerald-500")}>{watched} / {required}s</span>
        </div>
        <Progress value={(watched / required) * 100} className="h-2" />
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          {done ? <BadgeCheck className="h-3 w-3 text-emerald-500" /> : playing ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {done ? "Watch verified — reward ready below" : playing ? "Keep watching — progress saves automatically" : "Progress only counts while playing"}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Survey quest                                                        */
/* ------------------------------------------------------------------ */

function SurveyQuest({ quest, onComplete }: { quest: DetailQuest; onComplete: () => void }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [questions, setQuestions] = useState<SurveyQuestionConfig[] | null>(null)
  const [alreadyDone, setAlreadyDone] = useState(quest.state === "claimed" || quest.state === "claimable")
  const [answers, setAnswers] = useState<Record<number, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (!user || alreadyDone) return
    fetch(`/api/quests/survey?quest_id=${quest.id}`, { headers: getAuthHeader() })
      .then((r) => r.json())
      .then((json) => {
        if (json.already_completed) setAlreadyDone(true)
        else setQuestions(json.questions || [])
      })
      .catch(() => {})
  }, [user, quest.id, getAuthHeader, alreadyDone])

  const submit = async () => {
    const list = questions || []
    const missing = list.findIndex((q, i) => q.required && answers[i] === undefined)
    if (missing >= 0) {
      toast({ title: "One more answer needed", description: `Question ${missing + 1} is required.` })
      return
    }
    setSubmitting(true)
    try {
      const payload = list.map((_, i) => ({ index: i, value: answers[i] ?? null })).filter((a) => a.value !== null)
      const res = await fetch("/api/quests/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: quest.id, answers: payload, completion_ms: Date.now() - startedAt.current }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Submit failed")
      setAlreadyDone(true)
      onComplete()
      toast({ title: "Response submitted", description: "Your reward is ready to claim." })
    } catch (err: any) {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadyDone) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-500" />
        <p className="text-sm font-medium">Survey completed — thank you.</p>
      </div>
    )
  }

  if (!questions) {
    return <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-bold"><ClipboardList className="h-4 w-4 text-sky-500" /> Survey</p>
      {questions.map((q, i) => (
        <div key={i} className="space-y-2">
          <p className="text-sm font-medium">
            {i + 1}. {q.question}
            {q.required && <span className="ml-1 text-red-500">*</span>}
          </p>
          {(q.type === "single" || q.type === "multiple") &&
            (q.options || []).map((opt, oi) => {
              const selected = q.type === "single" ? answers[i] === oi : Array.isArray(answers[i]) && answers[i].includes(oi)
              return (
                <button
                  key={oi}
                  onClick={() =>
                    setAnswers((prev) => {
                      if (q.type === "single") return { ...prev, [i]: oi }
                      const cur = Array.isArray(prev[i]) ? [...prev[i]] : []
                      const idx = cur.indexOf(oi)
                      if (idx >= 0) cur.splice(idx, 1)
                      else cur.push(oi)
                      return { ...prev, [i]: cur }
                    })
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    selected ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/60",
                  )}
                >
                  <Circle className={cn("h-4 w-4 shrink-0", selected ? "fill-primary text-primary" : "text-muted-foreground/40")} />
                  {opt}
                </button>
              )
            })}
          {q.type === "rating" && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setAnswers((p) => ({ ...p, [i]: n }))}
                  className={cn(
                    "h-10 w-10 rounded-xl border text-sm font-bold transition-colors",
                    answers[i] >= n ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/60",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {q.type === "boolean" && (
            <div className="flex gap-2">
              {[true, false].map((b) => (
                <button
                  key={String(b)}
                  onClick={() => setAnswers((p) => ({ ...p, [i]: b }))}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                    answers[i] === b ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/60",
                  )}
                >
                  {b ? "Yes" : "No"}
                </button>
              ))}
            </div>
          )}
          {q.type === "text" && (
            answers[i] && String(answers[i]).length > 60 ? (
              <Textarea
                rows={3}
                value={String(answers[i] || "")}
                onChange={(e) => setAnswers((p) => ({ ...p, [i]: e.target.value.slice(0, 1000) }))}
                placeholder="Your answer…"
              />
            ) : (
              <Input
                value={String(answers[i] || "")}
                onChange={(e) => setAnswers((p) => ({ ...p, [i]: e.target.value.slice(0, 1000) }))}
                placeholder="Your answer…"
              />
            )
          )}
        </div>
      ))}
      <Button className="w-full rounded-full" disabled={submitting} onClick={submit}>
        {submitting ? <Spinner className="h-4 w-4" /> : null}
        Submit responses
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Game quest — memory / reaction (trivia lives in board card for now)  */
/* ------------------------------------------------------------------ */

function GameQuest({ quest, onComplete }: { quest: DetailQuest; onComplete: () => void }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [phase, setPhase] = useState<"idle" | "show" | "input" | "done">("idle")
  const [sequence, setSequence] = useState<number[]>([])
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [input, setInput] = useState<number[]>([])
  const [result, setResult] = useState<null | { passed: boolean; score: number }>(null)

  const begin = async () => {
    try {
      const res = await fetch(`/api/quests/game?quest_id=${quest.id}`, { headers: getAuthHeader() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not start game")
      if (json.kind === "trivia") {
        toast({ title: "Trivia quest", description: "Open this quest from the board to play the trivia version." })
        return
      }
      setAttemptId(json.attempt_id)
      if (json.kind === "memory") {
        setSequence(json.sequence || [])
        setInput([])
        setPhase("show")
        setTimeout(() => setPhase("input"), 3200)
      } else {
        startReaction(json.attempt_id)
      }
    } catch (err: any) {
      toast({ title: "Game error", description: err.message, variant: "destructive" })
    }
  }

  /* Reaction */
  const [round, setRound] = useState(0)
  const [signalAt, setSignalAt] = useState<number | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [times, setTimes] = useState<number[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const armRoundRef = useRef<() => void>(() => {})

  const startReaction = (aId: string) => {
    setPhase("input")
    setRound(0)
    setTimes([])
    armRoundRef.current()
    async function armRoundInitial() {
      setWaiting(true)
      setSignalAt(null)
      timeoutRef.current = setTimeout(() => {
        setWaiting(false)
        setSignalAt(Date.now())
      }, 900 + Math.random() * 2200)
    }
    armRoundRef.current = () => {
      setWaiting(true)
      setSignalAt(null)
      timeoutRef.current = setTimeout(() => {
        setWaiting(false)
        setSignalAt(Date.now())
      }, 900 + Math.random() * 2200)
    }
    void armRoundInitial
    ;(window as any).__reactionSubmit = async (all: number[]) => {
      try {
        const res = await fetch("/api/quests/game", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ attempt_id: aId, times: all }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Submit failed")
        setResult({ passed: json.passed, score: json.score })
        setPhase("done")
        if (json.passed) onComplete()
      } catch (err: any) {
        toast({ title: "Submit failed", description: err.message, variant: "destructive" })
      }
    }
  }

  const tap = () => {
    if (phase !== "input") return
    if (waiting || signalAt == null) return // too early — ignore
    const t = Date.now() - signalAt
    const all = [...times, t]
    setTimes(all)
    if (all.length >= 5) {
      void (window as any).__reactionSubmit?.(all)
    } else {
      setRound(all.length)
      armRoundRef.current()
    }
  }

  if (quest.state === "claimed" || quest.state === "claimable") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-500" />
        <p className="text-sm font-medium">Challenge completed.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold"><Gamepad2 className="h-4 w-4 text-fuchsia-500" /> Memory Challenge</p>

      {phase === "idle" && (
        <div className="text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Memorize the sequence of {sequence.length || 6} shapes, then repeat it back in order. One attempt per round.
          </p>
          <Button className="rounded-full" onClick={begin}>Start challenge</Button>
        </div>
      )}

      {phase === "show" && (
        <div className="flex flex-wrap justify-center gap-3 py-6">
          {sequence.map((s, i) => (
            <Shape key={i} name={SYMBOLS[s]} className="h-10 w-10 text-primary" />
          ))}
        </div>
      )}

      {phase === "input" && (
        <div className="py-2">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Repeat the sequence in order
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SYMBOLS.map((name, idx) => (
              <button
                key={name}
                onClick={() => {
                  const next = [...input, idx]
                  setInput(next)
                  if (sequence[next.length - 1] !== idx) {
                    setResult({ passed: false, score: next.length - 1 })
                    setPhase("done")
                    return
                  }
                  if (next.length === sequence.length) {
                    void fetch("/api/quests/game", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...getAuthHeader() },
                      body: JSON.stringify({ attempt_id: attemptId, solution: next.join(",") }),
                    })
                      .then((r) => r.json())
                      .then((json) => {
                        setResult({ passed: json.passed, score: json.score })
                        setPhase("done")
                        if (json.passed) onComplete()
                      })
                  } else {
                    setInput(next)
                  }
                }}
                className="flex h-14 items-center justify-center rounded-xl border transition-colors hover:bg-muted/60"
              >
                <Shape name={name} className="h-6 w-6 text-foreground/80" />
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="py-4 text-center">
          {result.passed ? (
            <>
              <BadgeCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
              <p className="font-bold">Challenge complete</p>
              <p className="text-sm text-muted-foreground">Your reward is ready to claim.</p>
            </>
          ) : (
            <>
              <Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-bold">Not quite</p>
              <p className="mb-3 text-sm text-muted-foreground">Sequence broken at step {result.score + 1}. Try a fresh attempt.</p>
              <Button variant="outline" className="rounded-full" onClick={() => { setPhase("idle"); setResult(null); setInput([]) }}>
                Play again
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Shape({ name, className }: { name: string; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "currentColor" }
  switch (name) {
    case "circle": return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>
    case "square": return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
    case "diamond": return <svg {...common}><path d="M12 2l10 10-10 10L2 12z" /></svg>
    case "star": return <svg {...common}><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>
    case "hexagon": return <svg {...common}><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" /></svg>
    case "cross": return <svg {...common}><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" /></svg>
    case "moon": return <svg {...common}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>
    default: return <svg {...common}><path d="M12 2l10 18H2z" /></svg>
  }
}

/* ------------------------------------------------------------------ */
/* Native quest — guidance + start                                     */
/* ------------------------------------------------------------------ */

function NativeQuest({
  quest,
  onStart,
  accepting,
  accepted,
}: {
  quest: DetailQuest
  onStart: () => void
  accepting: boolean
  accepted: boolean
}) {
  const isAccepted =
    accepted ||
    Boolean(quest.accepted) ||
    quest.state === "in_progress" ||
    quest.state === "claimable" ||
    quest.state === "claimed"

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <p className="mb-1 flex items-center gap-2 text-sm font-bold"><Target className="h-4 w-4 text-emerald-500" /> How to complete</p>
      <p className="text-sm text-muted-foreground">
        This quest tracks your activity across Loop automatically. {quest.progress.count > 0 ? `${Math.max(0, quest.progress.required - quest.progress.count)} more to go.` : "Use Loop as usual and progress will appear here."}
      </p>
      {isAccepted ? (
        // Accepted quests have nothing left to press — the work itself counts.
        <Button
          className="mt-3 rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
          variant="outline"
          disabled
        >
          <Check className="mr-1.5 h-4 w-4" /> Accepted
        </Button>
      ) : (
        <Button className="mt-3 rounded-full" disabled={accepting} onClick={onStart}>
          {accepting ? <Spinner className="h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
          Accept quest
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mission tracker                                                     */
/* ------------------------------------------------------------------ */

function MissionTracker({ quest, onChanged }: { quest: DetailQuest; onChanged: () => void }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const steps = quest.mission_config || []
  const [completed, setCompleted] = useState<Set<number>>(new Set())

  useEffect(() => {
    // Derive initial completion from mission_progress count (done is ordered).
    const done = new Set<number>()
    for (let i = 0; i < (quest.mission_progress?.done ?? 0); i++) done.add(i)
    setCompleted(done)
  }, [quest.mission_progress?.done])

  const completeStep = async (idx: number) => {
    if (completed.has(idx)) return
    try {
      const res = await fetch("/api/quests/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ quest_id: quest.id, step_index: idx }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not complete step")
      setCompleted((prev) => new Set(prev).add(idx))
      onChanged()
      if (json.all_done) toast({ title: "Mission complete", description: "Claim your reward below." })
    } catch (err: any) {
      toast({ title: "Step failed", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border bg-card">
      <div className="border-b bg-muted/40 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mission Progress</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums">
          {completed.size} / {steps.length} COMPLETE
        </p>
        <Progress value={(completed.size / Math.max(1, steps.length)) * 100} className="mt-2 h-2" />
      </div>
      <ol className="divide-y">
        {steps.map((step, i) => {
          const isDone = completed.has(i)
          const isNext = !isDone && completed.size === i
          return (
            <li key={i} className={cn("flex items-start gap-3 px-4 py-3.5", isDone && "bg-emerald-500/5")}>
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  isDone ? "border-emerald-500 bg-emerald-500 text-white" : isNext ? "border-primary text-primary" : "text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", isDone && "text-emerald-600")}>{step.title}</p>
                {step.description && <p className="text-xs text-muted-foreground">{step.description}</p>}
              </div>
              {step.reward_coins && step.reward_coins > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-600">
                  <Coins className="h-3 w-3" /> {step.reward_coins}
                </span>
              )}
              {!isDone && isNext && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => completeStep(i)}>
                  {step.link_kind === "survey" ? "Take survey" : step.link_kind === "game" ? "Play" : "Open"} <ChevronRight className="ml-0.5 h-3 w-3" />
                </Button>
              )}
              {!isDone && !isNext && <Lock className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
