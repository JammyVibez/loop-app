import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { getActiveProvider, recordProviderCheck, rememberModel } from "@/lib/ai/config"
import { callProviderWithFallback, providerLabel, type ChatMessage } from "@/lib/ai/providers"

export const dynamic = "force-dynamic"

const SYSTEM_PROMPT = [
  "You are Loop AI, the assistant inside LOOP — a collaborative social app where people post Loops (posts), branch them into Chains, co-write in Co-Loops, run Circles (communities) with threads and events, collect Drops, and earn Loop Coins.",
  "Be concise and concrete. Prefer short paragraphs and tight lists over long essays. Write in the user's tone when asked to draft something.",
  "You cannot post, delete, or change anything in the product yourself. When a task needs an action, tell the person exactly where to do it.",
  "If you are unsure about a specific number or a private detail from the product, say so instead of inventing it.",
].join(" ")

const MAX_MESSAGES = 16
const MAX_CHARS = 4000

// Small in-memory guard so one tab cannot hammer a paid provider.
const recentCalls = new Map<string, number[]>()

function rateLimited(userId: string) {
  const now = Date.now()
  const windowStart = now - 60_000
  const calls = (recentCalls.get(userId) || []).filter((at) => at > windowStart)
  if (calls.length >= 20) return true
  calls.push(now)
  recentCalls.set(userId, calls)
  if (recentCalls.size > 500) recentCalls.clear()
  return false
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to use Loop AI." }, { status: 401 })
  }
  if (rateLimited(user.id)) {
    return NextResponse.json(
      { error: "rate_limited", message: "That is a lot of questions at once. Give it a minute." },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => null)
  const incoming = Array.isArray(body?.messages) ? body.messages : null
  if (!incoming?.length) {
    return NextResponse.json({ error: "invalid_request", message: "A message is required." }, { status: 400 })
  }

  const history: ChatMessage[] = incoming
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))

  if (!history.some((m) => m.role === "user")) {
    return NextResponse.json({ error: "invalid_request", message: "A message is required." }, { status: 400 })
  }

  const active = await getActiveProvider().catch((error) => {
    console.error("[ai/chat] provider lookup failed:", error)
    return null
  })

  if (!active) {
    return NextResponse.json(
      {
        error: "ai_not_configured",
        message: "Loop AI has no provider key yet. An admin can add one in Admin → Content → Loop AI.",
      },
      { status: 503 },
    )
  }

  try {
    const { text: reply, model } = await callProviderWithFallback(
      active.provider,
      active.model,
      active.apiKey,
      [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    )
    await recordProviderCheck(active.provider, null).catch(() => {})
    // A retired model id is replaced in place, so the next request is fast.
    if (model !== active.model) {
      await rememberModel(active.provider, model).catch(() => {})
    }
    return NextResponse.json({
      reply,
      provider: active.provider,
      provider_label: providerLabel(active.provider),
      model,
    })
  } catch (error: any) {
    const message = error?.message || "Loop AI could not answer right now."
    console.error("[ai/chat] provider error:", message)
    await recordProviderCheck(active.provider, message).catch(() => {})
    return NextResponse.json({ error: "provider_error", message }, { status: 502 })
  }
}
