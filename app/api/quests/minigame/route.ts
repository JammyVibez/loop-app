import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { type Quest, questRateLimit, recordQuestProgress } from "@/lib/quests"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/* ------------------------------------------------------------------ */
/* Trivia bank — lightweight, expandable. Answers never leave the      */
/* server until graded: the client receives questions + shuffled       */
/* options with an opaque option id, and the correct id stays server-  */
/* side, so answers can't be sniffed from the network tab.             */
/* ------------------------------------------------------------------ */

interface TriviaQ {
  q: string
  options: string[]
  answer: number // index into options
}

const TRIVIA_BANK: TriviaQ[] = [
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
  { q: "What does 'www' stand for?", options: ["World Wide Web", "World Web Wire", "Wide World Web", "Web World Wide"], answer: 0 },
  { q: "How many strings does a standard guitar have?", options: ["4", "5", "6", "7"], answer: 2 },
  { q: "Which language has the most native speakers?", options: ["English", "Spanish", "Mandarin Chinese", "Hindi"], answer: 2 },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { q: "Who painted the Mona Lisa?", options: ["Van Gogh", "Da Vinci", "Picasso", "Rembrandt"], answer: 1 },
  { q: "What year did the first iPhone launch?", options: ["2006", "2007", "2008", "2009"], answer: 1 },
  { q: "Which gas do plants absorb from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
  { q: "What's the capital of Japan?", options: ["Osaka", "Kyoto", "Tokyo", "Nagoya"], answer: 2 },
  { q: "How many continents are there?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "What does CPU stand for?", options: ["Central Process Unit", "Central Processing Unit", "Computer Personal Unit", "Central Power Unit"], answer: 1 },
  { q: "Which animal is the fastest land animal?", options: ["Lion", "Cheetah", "Gazelle", "Horse"], answer: 1 },
  { q: "What is 7 × 8?", options: ["54", "56", "58", "64"], answer: 1 },
  { q: "Which element has the symbol 'Au'?", options: ["Silver", "Gold", "Aluminium", "Argon"], answer: 1 },
  { q: "In which sport would you perform a slam dunk?", options: ["Tennis", "Volleyball", "Basketball", "Baseball"], answer: 2 },
  { q: "What's the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2 },
  { q: "Which country built the Great Wall?", options: ["Japan", "India", "China", "Korea"], answer: 2 },
  { q: "What does 'URL' stand for?", options: ["Uniform Resource Locator", "Universal Router Link", "United Resource Line", "Uniform Router Locator"], answer: 0 },
  { q: "How many minutes are in a full day?", options: ["1200", "1440", "1600", "2400"], answer: 1 },
  { q: "Which sea creature has three hearts?", options: ["Dolphin", "Octopus", "Shark", "Whale"], answer: 1 },
]

// In-memory session store (per-instance; sessions are short-lived so this is
// fine for the current single-instance deployment).
interface GameSession {
  userId: string
  kind: "trivia" | "reaction"
  startedAt: number
  questions: Array<{ id: number; answer: number }>
  questionCount: number
  targetScore: number
  questId: string | null
}
const sessions = new Map<string, GameSession>()
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 10 * 60_000
    for (const [k, s] of sessions) if (s.startedAt < cutoff) sessions.delete(k)
  }, 60_000)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * GET /api/quests/minigame?quest_id=<uuid>&kind=trivia|reaction
 * Starts a session and returns the questions (answers withheld server-side).
 * For reaction games returns target score + duration instead.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  if (!checkRateLimit(`minigame:start:${user.id}`, { maxRequests: 10, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: "Too many game starts — try again in a minute" }, { status: 429 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const questId = searchParams.get("quest_id")
    const supabase = createServerClient()

    let kind: "trivia" | "reaction" = "trivia"
    if (questId) {
      const { data: quest } = await supabase.from("quests").select("minigame_kind, is_active").eq("id", questId).maybeSingle()
      if (quest?.is_active === false) return NextResponse.json({ error: "Quest inactive" }, { status: 400 })
      kind = quest?.minigame_kind === "reaction" ? "reaction" : "trivia"
    }

    if (kind === "reaction") {
      // Reaction game: 5 rounds, click when the signal flips. Score = avg reaction ms.
      const session: GameSession = {
        userId: user.id,
        kind,
        startedAt: Date.now(),
        questions: [],
        questionCount: 5,
        targetScore: 350, // avg ms to beat
        questId,
      }
      const sid = `${user.id}:${Date.now().toString(36)}`
      sessions.set(sid, session)
      return NextResponse.json({
        success: true,
        session_id: sid,
        kind,
        rounds: session.questionCount,
        target_avg_ms: session.targetScore,
        instructions: "Tap as fast as you can when the circle turns green. Beat the target average!",
      })
    }

    // Trivia: pick 5 random questions, shuffle options, withhold answers.
    const picked = shuffle(TRIVIA_BANK).slice(0, 5)
    const session: GameSession = {
      userId: user.id,
      kind,
      startedAt: Date.now(),
      questions: picked.map((q) => ({ id: q.answer, answer: q.answer })),
      questionCount: picked.length,
      targetScore: picked.length, // all correct = full progress
      questId,
    }
    const sid = `${user.id}:${Date.now().toString(36)}`
    sessions.set(sid, session)

    return NextResponse.json({
      success: true,
      session_id: sid,
      kind,
      questions: picked.map((q, i) => ({
        index: i,
        question: q.q,
        options: q.options.map((text, optIdx) => ({ id: optIdx, text })),
      })),
    })
  } catch (error: any) {
    console.error("GET /api/quests/minigame error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/quests/minigame — submit answers / reaction times.
 * Body (trivia): { session_id, answers: number[] }  (option ids in order)
 * Body (reaction): { session_id, reaction_times_ms: number[] }
 * Grading happens here; the quest progresses by the fraction of the
 * requirement the score earns (all-correct = full completion).
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  if (!questRateLimit(user.id, "minigame", 10, 60_000)) {
    return NextResponse.json({ error: "Too many submissions — try again shortly" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sessionId = String(body.session_id || "")
    const session = sessions.get(sessionId)

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Invalid or expired session — start a new game" }, { status: 400 })
    }
    if (Date.now() - session.startedAt > 10 * 60_000) {
      sessions.delete(sessionId)
      return NextResponse.json({ error: "Session expired" }, { status: 400 })
    }

    sessions.delete(sessionId) // single-use
    const supabase = createServerClient()

    let correct = 0
    if (session.kind === "trivia") {
      const answers: number[] = Array.isArray(body.answers) ? body.answers : []
      correct = session.questions.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0)
    } else {
      const times: number[] = Array.isArray(body.reaction_times_ms) ? body.reaction_times_ms : []
      // Plausibility guard: discard impossibly fast (<80ms = anticipating) rounds.
      const valid = times.filter((t) => t >= 80 && t <= 3000)
      const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 9999
      correct = Math.max(0, Math.min(session.questionCount, Math.round((session.targetScore / Math.max(avg, 1)) * session.questionCount)))
    }

    const scorePct = correct / Math.max(1, session.questionCount)

    // Progress the linked quest(s) proportionally — requirement met only when
    // the score is strong enough to cover the full requirement.
    let questResult: { completed: boolean; progress: number; required: number } | null = null
    if (session.questId) {
      const { data: quest } = await supabase.from("quests").select("*").eq("id", session.questId).maybeSingle()
      if (quest) {
        const q = quest as Quest
        const earned = Math.max(scorePct >= 1 ? q.requirement_count : Math.floor(scorePct * Number(q.requirement_count || 1)), correct > 0 ? 1 : 0)
        if (earned > 0) {
          questResult = await recordQuestProgress(supabase, q, user.id, Math.min(earned, Number(q.requirement_count || 1)))
        }
      }
    }

    return NextResponse.json({
      success: true,
      kind: session.kind,
      correct,
      total: session.questionCount,
      score_pct: Math.round(scorePct * 100),
      quest: questResult,
    })
  } catch (error: any) {
    console.error("POST /api/quests/minigame error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
