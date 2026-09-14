import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { type Quest, recordQuestProgress, questRateLimit } from "@/lib/quests"
import type { SurveyQuestionConfig } from "@/lib/quests-v2"

export const dynamic = "force-dynamic"

/**
 * GET /api/quests/survey?quest_id=<uuid> — questions for an active survey quest.
 * Returns only question text/options — never reward internals.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  try {
    const questId = new URL(request.url).searchParams.get("quest_id") || ""
    const supabase = createServerClient()
    const { data: quest } = await supabase
      .from("quests")
      .select("id, quest_type, survey_config, title")
      .eq("id", questId)
      .maybeSingle()
    const q = quest as (Quest & { survey_config: SurveyQuestionConfig[] }) | null
    if (!q || q.quest_type !== "survey") {
      return NextResponse.json({ error: "Survey quest not found" }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from("quest_survey_answers")
      .select("id")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: true, already_completed: true, questions: [] })
    }

    const questions = (Array.isArray(q.survey_config) ? q.survey_config : []) as SurveyQuestionConfig[]
    return NextResponse.json({
      success: true,
      already_completed: false,
      title: q.title,
      questions: questions.map((qq: SurveyQuestionConfig, i: number) => ({
        index: i,
        type: qq.type,
        question: qq.question,
        options: qq.options || [],
        required: Boolean(qq.required),
      })),
    })
  } catch (error: any) {
    console.error("GET /api/quests/survey error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/quests/survey — submit answers. Validated against the stored
 * question config server-side; required questions must be present.
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!questRateLimit(user.id, "survey", 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const questId = String(body.quest_id || "")
    const answers = Array.isArray(body.answers) ? body.answers : []
    const completionMs = Math.max(0, Math.min(Number(body.completion_ms || 0), 3_600_000))
    if (!questId) return NextResponse.json({ error: "quest_id required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: quest } = await supabase
      .from("quests")
      .select("*")
      .eq("id", questId)
      .maybeSingle()
    const q = quest as (Quest & { survey_config: SurveyQuestionConfig[] }) | null
    if (!q || q.quest_type !== "survey") {
      return NextResponse.json({ error: "Survey quest not found" }, { status: 404 })
    }

    // Idempotency.
    const { data: existing } = await supabase
      .from("quest_survey_answers")
      .select("id")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: true, already_completed: true })
    }

    const questions = Array.isArray(q.survey_config) ? q.survey_config : []

    // Validate: every required question answered; answers in range.
    for (let i = 0; i < questions.length; i++) {
      const cfg = questions[i]
      const answer = answers.find((a: any) => Number(a.index) === i)
      if (cfg.required && !answer) {
        return NextResponse.json({ error: `Question ${i + 1} is required` }, { status: 400 })
      }
      if (!answer) continue
      if (cfg.type === "single" || cfg.type === "multiple") {
        const opts = cfg.options || []
        const vals = cfg.type === "multiple" ? (Array.isArray(answer.value) ? answer.value : [answer.value]) : [answer.value]
        for (const v of vals) {
          if (typeof v !== "number" || v < 0 || v >= opts.length) {
            return NextResponse.json({ error: `Invalid answer for question ${i + 1}` }, { status: 400 })
          }
        }
      }
      if (cfg.type === "rating") {
        const n = Number(answer.value)
        if (!Number.isInteger(n) || n < 1 || n > 5) {
          return NextResponse.json({ error: `Rating for question ${i + 1} must be 1–5` }, { status: 400 })
        }
      }
      if (cfg.type === "text") {
        const text = String(answer.value || "").slice(0, 1000)
        answer.value = text
      }
      if (cfg.type === "boolean" && typeof answer.value !== "boolean") {
        return NextResponse.json({ error: `Answer for question ${i + 1} must be yes/no` }, { status: 400 })
      }
    }

    const { error: insErr } = await supabase.from("quest_survey_answers").insert({
      quest_id: questId,
      user_id: user.id,
      answers,
      completion_ms: completionMs || null,
    })
    if (insErr) {
      if (insErr.code === "23505") return NextResponse.json({ success: true, already_completed: true })
      throw new Error(insErr.message)
    }

    await recordQuestProgress(supabase, q, user.id, 1)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("POST /api/quests/survey error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
