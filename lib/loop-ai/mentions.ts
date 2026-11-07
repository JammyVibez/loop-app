import "server-only"

import { authDbPool } from "@/lib/auth"
import { getActiveProvider, recordProviderCheck, rememberModel } from "@/lib/ai/config"
import { callProviderWithFallback, type ChatMessage } from "@/lib/ai/providers"

/**
 * Loop AI as a first-class participant: people can type `@loopai` in a Loop or
 * a comment and get a real answer in the thread, the way an account would.
 *
 * It answers as a normal profile row so every existing surface (avatars,
 * comment threads, notifications, moderation) keeps working unchanged.
 */
export const LOOP_AI_BOT_ID = "00000000-0000-4000-8000-00000000a1a1"
export const LOOP_AI_USERNAME = "loopai"

const MENTION_PATTERN = /(^|[\s([{>"'])@(loop[\s_-]?ai)\b/i

export function mentionsLoopAi(text: string | null | undefined): boolean {
  return typeof text === "string" && MENTION_PATTERN.test(text)
}

/** Strip the mention so the prompt reads like a request, not a tag. */
export function stripLoopAiMention(text: string): string {
  return text.replace(/@(loop[\s_-]?ai)\b/gi, " ").replace(/\s{2,}/g, " ").trim()
}

let botReady = false

/** Idempotent: the row only needs to exist once, and only on first mention. */
export async function ensureLoopAiBot(): Promise<boolean> {
  if (botReady) return true
  try {
    await authDbPool.query(
      `INSERT INTO public.profiles (id, username, display_name, bio, is_verified, onboarding_completed)
       VALUES ($1, $2, 'Loop AI', 'LOOP''s assistant. Mention @loopai and it replies here.', true, true)
       ON CONFLICT (id) DO NOTHING`,
      [LOOP_AI_BOT_ID, LOOP_AI_USERNAME],
    )
    botReady = true
    return true
  } catch (error) {
    console.error("[loop-ai] could not create the assistant profile:", error)
    return false
  }
}

const SYSTEM_PROMPT = [
  "You are Loop AI, replying publicly inside a LOOP thread after someone tagged you with @loopai.",
  "Answer the person directly and add something useful — a concrete suggestion, a rewrite, or a short explanation.",
  "Keep it under 90 words. No headings, no bullet spam, no 'as an AI' disclaimers.",
  "Never invent product numbers, private data or links. If something needs a product action, say where to do it on LOOP.",
].join(" ")

/**
 * Generate the public reply. Returns null when no provider is configured or the
 * provider fails — the mention then stays unanswered rather than posting an
 * error into the thread.
 */
export async function buildLoopAiReply(input: {
  question: string
  context?: string
  history?: ChatMessage[]
}): Promise<{ text: string; provider: string } | null> {
  const stripped = stripLoopAiMention(input.question).slice(0, 1500)
  // Tagging the assistant on its own ("@loopai", or a post whose only text is
  // the tag) used to produce an empty prompt and no reply at all. A bare tag
  // is still a request for attention, so answer it against the thread context
  // instead of silently ignoring the mention.
  const question =
    stripped ||
    "I tagged you without a question. Reply in one or two short sentences: greet me and say what you can help with in this thread, using the context if there is any."

  const active = await getActiveProvider().catch(() => null)
  if (!active) return null

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(input.context
      ? [{ role: "system" as const, content: `Context: ${input.context.slice(0, 1200)}` }]
      : []),
    ...(input.history || []).slice(-6),
    { role: "user", content: question },
  ]

  try {
    const { text: answer, model } = await callProviderWithFallback(
      active.provider,
      active.model,
      active.apiKey,
      messages,
    )
    await recordProviderCheck(active.provider, null).catch(() => {})
    if (model !== active.model) await rememberModel(active.provider, model).catch(() => {})
    return { text: answer.trim().slice(0, 1200), provider: active.provider }
  } catch (error: any) {
    await recordProviderCheck(active.provider, error?.message || "mention reply failed").catch(() => {})
    console.error("[loop-ai] mention reply failed:", error?.message)
    return null
  }
}
