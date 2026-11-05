export type ProviderId = "gemini" | "groq" | "openai" | "xai" | "anthropic"

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

type ProviderDefinition = {
  id: ProviderId
  label: string
  /** Where an admin gets a key. */
  keyUrl: string
  defaultModel: string
  suggestedModels: string[]
  note: string
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    // Google retires model ids on a schedule (2.0-flash now answers "no longer
    // available"), and the newest ids can hang while still being listed, so the
    // default is the flash model verified against a live key. The chain below
    // catches the next retirement.
    defaultModel: "gemini-2.5-flash",
    suggestedModels: ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-1.5-flash"],
    note: "Generous free tier; good default for chat.",
  },
  {
    id: "groq",
    label: "Groq",
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    suggestedModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    note: "Very fast inference on open models.",
  },
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    suggestedModels: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    note: "Paid; strongest general reasoning of the set.",
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    keyUrl: "https://console.x.ai",
    defaultModel: "grok-2-latest",
    suggestedModels: ["grok-2-latest", "grok-beta"],
    note: "OpenAI-compatible endpoint.",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-3-5-sonnet-latest",
    suggestedModels: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
    note: "Paid; strong long-form writing.",
  },
]

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && PROVIDERS.some((provider) => provider.id === value)
}

export function providerLabel(id: string): string {
  return PROVIDERS.find((provider) => provider.id === id)?.label || id
}

const REQUEST_TIMEOUT_MS = 45_000

function textFromOpenAi(json: any): string {
  const content = json?.choices?.[0]?.message?.content
  if (typeof content === "string") return content.trim()
  if (Array.isArray(content)) {
    return content.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("").trim()
  }
  return ""
}

async function readError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "")
  try {
    const json = JSON.parse(body)
    const message =
      json?.error?.message ||
      json?.error?.[0]?.message ||
      json?.message ||
      (typeof json?.error === "string" ? json.error : "")
    if (typeof message === "string" && message.trim()) return message.trim().slice(0, 300)
  } catch {
    /* not JSON */
  }
  return `Provider returned ${response.status}`
}

/**
 * One call to a configured provider. Every adapter returns plain assistant
 * text; the route decides how to present errors.
 */
const RETIRED_MODEL = /no longer available|not found|does not exist|deprecated|is not supported|unsupported model|invalid model/i

/** Whether a provider failure looks like the model id died, not the key or quota. */
function looksLikeRetiredModel(message: string): boolean {
  return RETIRED_MODEL.test(message) && !/api key|permission|quota|billing|rate limit|unauthori[sz]ed|forbidden/i.test(message)
}

/**
 * Try the configured model, then the provider's known-good list. Google and
 * OpenAI retire model ids without warning; a dead id should degrade to the next
 * one instead of taking the assistant offline for every user.
 */
export async function callProviderWithFallback(
  provider: ProviderId,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
): Promise<{ text: string; model: string }> {
  const definition = PROVIDERS.find((entry) => entry.id === provider)
  const candidates = [model, definition?.defaultModel, ...(definition?.suggestedModels || [])]
    .filter((value): value is string => Boolean(value && value.trim()))
    .filter((value, index, list) => list.indexOf(value) === index)

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      const text = await callProvider(provider, candidate, apiKey, messages)
      return { text, model: candidate }
    } catch (error: any) {
      lastError = error
      if (!looksLikeRetiredModel(String(error?.message || ""))) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No usable model for this provider")
}

export async function callProvider(
  provider: ProviderId,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)

  if (provider === "gemini") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n")
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
        }),
        signal,
      },
    )
    if (!response.ok) throw new Error(await readError(response))
    const json: any = await response.json()
    const text = json?.candidates?.[0]?.content?.parts
      ?.map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim()
    if (!text) throw new Error("Gemini returned an empty answer")
    return text
  }

  if (provider === "anthropic") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n")
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        ...(system ? { system } : {}),
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
      }),
      signal,
    })
    if (!response.ok) throw new Error(await readError(response))
    const json: any = await response.json()
    const text = Array.isArray(json?.content)
      ? json.content.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("").trim()
      : ""
    if (!text) throw new Error("Claude returned an empty answer")
    return text
  }

  // OpenAI, Groq and xAI all speak the same chat-completions dialect.
  const baseUrl =
    provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : provider === "xai"
        ? "https://api.x.ai/v1"
        : "https://api.openai.com/v1"

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 1024 }),
    signal,
  })
  if (!response.ok) throw new Error(await readError(response))
  const text = textFromOpenAi(await response.json())
  if (!text) throw new Error("The provider returned an empty answer")
  return text
}
