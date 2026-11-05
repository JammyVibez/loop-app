import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { getActiveProvider, listSafeProviders, recordProviderCheck, rememberModel } from "@/lib/ai/config"
import { callProviderWithFallback, isProviderId, providerLabel } from "@/lib/ai/providers"

export const dynamic = "force-dynamic"

/** Admin-only: send a one-word prompt through a provider to prove the key works. */
export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const body = await request.json().catch(() => ({}))
  const provider = body?.provider

  try {
    const active = await getActiveProvider()
    if (!active) {
      return NextResponse.json({ error: "No AI provider is configured yet" }, { status: 400 })
    }
    if (isProviderId(provider) && provider !== active.provider) {
      // Testing a specific provider that is not the active one means building
      // a throwaway client for it.
      const rows = await listSafeProviders()
      if (!rows.some((row) => row.provider === provider)) {
        return NextResponse.json({ error: "That provider has no key saved" }, { status: 400 })
      }
    }

    // The connection test goes through the same fallback chain as a real
    // message, so a retired model id shows up as a working key on a new model
    // instead of a false "key rejected".
    const { text: reply, model } = await callProviderWithFallback(
      active.provider,
      active.model,
      active.apiKey,
      [
        { role: "system", content: "Reply with the single word: ready" },
        { role: "user", content: "Connection check" },
      ],
    )
    await recordProviderCheck(active.provider, null)
    if (model !== active.model) await rememberModel(active.provider, model).catch(() => {})
    return NextResponse.json({
      ok: true,
      provider: active.provider,
      label: providerLabel(active.provider),
      model,
      reply: reply.slice(0, 120),
    })
  } catch (error: any) {
    const message = error?.message || "The provider rejected the request"
    if (isProviderId(provider)) await recordProviderCheck(provider, message).catch(() => {})
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
