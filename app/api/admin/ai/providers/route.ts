import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { listSafeProviders, removeProvider, saveProvider } from "@/lib/ai/config"
import { PROVIDERS, isProviderId } from "@/lib/ai/providers"

export const dynamic = "force-dynamic"

/** Admin-only: which Loop AI providers exist and what they are set to. */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const providers = await listSafeProviders()
    return NextResponse.json({ providers, catalog: PROVIDERS }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: any) {
    console.error("[admin/ai/providers] list failed:", error)
    return NextResponse.json({ error: "Could not load AI providers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const body = await request.json().catch(() => ({}))
  if (!isProviderId(body?.provider)) {
    return NextResponse.json({ error: "Unknown AI provider" }, { status: 400 })
  }
  const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : ""
  if (apiKey && apiKey.length < 12) {
    return NextResponse.json({ error: "That key looks too short" }, { status: 400 })
  }
  const model = typeof body?.model === "string" ? body.model : ""

  try {
    const existing = await listSafeProviders()
    const known = existing.some((row) => row.provider === body.provider)
    if (!apiKey && !known) {
      return NextResponse.json({ error: "Add the provider's API key first" }, { status: 400 })
    }
    await saveProvider({
      provider: body.provider,
      model,
      apiKey: apiKey || undefined,
      enabled: typeof body?.enabled === "boolean" ? body.enabled : true,
    })
    return NextResponse.json({ providers: await listSafeProviders() })
  } catch (error: any) {
    console.error("[admin/ai/providers] save failed:", error)
    const reason = error?.message?.includes("AI_KEY_SECRET")
      ? "The server has no AI_KEY_SECRET/BETTER_AUTH_SECRET, so keys cannot be encrypted."
      : "Could not save the provider"
    return NextResponse.json({ error: reason }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const provider = new URL(request.url).searchParams.get("provider")
  if (!isProviderId(provider)) {
    return NextResponse.json({ error: "Unknown AI provider" }, { status: 400 })
  }

  try {
    await removeProvider(provider)
    return NextResponse.json({ providers: await listSafeProviders() })
  } catch (error) {
    console.error("[admin/ai/providers] delete failed:", error)
    return NextResponse.json({ error: "Could not remove the provider" }, { status: 500 })
  }
}
