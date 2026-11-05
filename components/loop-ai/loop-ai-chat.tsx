"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUp,
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  MessageSquarePlus,
  PenLine,
  Users,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { LoopAiMark } from "@/components/loop-ai/loop-ai-mark"

type Message = { role: "user" | "assistant"; content: string; at?: number }

const SUGGESTIONS = [
  {
    icon: PenLine,
    title: "Draft a Loop",
    body: "Announce my community's first event in two short paragraphs.",
    prompt: "Draft a Loop announcing my community's first event. Keep it short and warm.",
  },
  {
    icon: MessageSquarePlus,
    title: "Open a discussion",
    body: "Give me three opening lines that invite real replies.",
    prompt: "Give me three opening lines for a discussion thread about building in public.",
  },
  {
    icon: Wand2,
    title: "Sharpen a caption",
    body: "Rewrite something I wrote: shorter, clearer, no clichés.",
    prompt: "Rewrite this caption shorter and sharper:\n\n",
  },
  {
    icon: Users,
    title: "Plan a Circle week",
    body: "A lightweight schedule with one prompt per day.",
    prompt: "Plan a lightweight week of prompts for a small design Circle, one per day.",
  },
]

const STORAGE_KEY = "loop-ai:conversation"

function initialsOf(value?: string | null) {
  if (!value) return "YOU"
  const parts = value.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/)
  return (parts[0]?.[0] || "U").toUpperCase() + (parts[1]?.[0] || "").toUpperCase()
}

function timeLabel(at?: number) {
  if (!at) return null
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function LoopAiChat() {
  const { user, getAuthHeader } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) setMessages(parsed.slice(-20))
    } catch {
      /* ignore malformed drafts */
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)))
    } catch {
      /* storage full or blocked */
    }
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, sending])

  // Grow with what is typed, up to a ceiling, so long drafts stay readable.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    area.style.height = "auto"
    area.style.height = `${Math.min(area.scrollHeight, 176)}px`
  }, [input])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      const next: Message[] = [...messages, { role: "user", content: trimmed, at: Date.now() }]
      setMessages(next)
      setInput("")
      setSending(true)
      setError(null)

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next.slice(-12).map(({ role, content }) => ({ role, content })) }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || data.error || "Loop AI could not answer")
        setProvider(data.provider_label ? `${data.provider_label} · ${data.model}` : null)
        setMessages((prev) => [...prev, { role: "assistant", content: String(data.reply || ""), at: Date.now() }])
      } catch (err: any) {
        setError(err.message || "Loop AI could not answer right now.")
      } finally {
        setSending(false)
        requestAnimationFrame(() => areaRef.current?.focus())
      }
    },
    [getAuthHeader, messages, sending],
  )

  const copy = async (index: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(index)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      /* clipboard blocked */
    }
  }

  const started = messages.length > 0
  const userLabel = useMemo(() => user?.display_name || user?.username || "You", [user])

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-[28px] border border-border/70 bg-card/70 p-10 text-center shadow-sm backdrop-blur">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-cyan-300 ring-1 ring-cyan-400/30">
          <LoopAiMark className="h-7 w-7" glow />
        </div>
        <p className="text-base font-semibold">Sign in to talk to Loop AI</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          Your drafts stay attached to your account, never to this browser.
        </p>
        <Button asChild className="mt-6 rounded-full px-6">
          <Link href="/auth?returnTo=%2Floop-ai">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* ── Conversation: the whole page ─────────────────────────── */}
      <section className="flex h-[calc(100dvh-3.75rem)] min-h-[540px] flex-col overflow-hidden border-border/60 bg-card/60 sm:h-[calc(100dvh-4.5rem)] sm:rounded-b-[26px] sm:border sm:border-t-0">
        <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-cyan-300 ring-1 ring-cyan-400/25">
            <LoopAiMark className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
              Loop AI
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              <span className="text-[11px] font-medium text-muted-foreground">
                {provider || "assistant"}
              </span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {sending ? "Thinking…" : started ? `${messages.length} messages this session` : "Ready when you are"}
            </p>
          </div>
          {started && (
            <button
              type="button"
              onClick={() => {
                setMessages([])
                setError(null)
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New chat
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {!started ? (
            <div className="mx-auto max-w-xl">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400/20 via-indigo-500/15 to-fuchsia-500/20 text-cyan-300 ring-1 ring-cyan-400/25">
                  <LoopAiMark className="h-8 w-8" glow />
                </div>
                <h2 className="text-[22px] font-black leading-tight tracking-tight">What are we making?</h2>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Loop AI helps you write Loops, shape threads, plan Circle weeks and untangle half-formed ideas.
                </p>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map(({ icon: Icon, title, body, prompt }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => void send(prompt)}
                    className="group flex flex-col items-start gap-1.5 rounded-2xl border border-border/70 bg-background/50 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-background"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-500">
                      <Icon className="h-3.5 w-3.5" />
                      {title}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground group-hover:text-foreground/90">
                      {body}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-5">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="flex gap-3">
                  {/* Avatar rail */}
                  <div className="w-8 shrink-0">
                    {message.role === "assistant" ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-cyan-300 ring-1 ring-cyan-400/25">
                        <LoopAiMark className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-[10px] font-bold text-muted-foreground">
                        {initialsOf(userLabel)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground/80">
                        {message.role === "assistant" ? "Loop AI" : userLabel}
                      </span>
                      {timeLabel(message.at) && <span>· {timeLabel(message.at)}</span>}
                    </div>

                    {message.role === "assistant" ? (
                      <div className="group relative rounded-2xl rounded-tl-md border border-border/60 bg-background/70 px-4 py-3 text-[13.5px] leading-relaxed">
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <button
                          type="button"
                          onClick={() => void copy(index, message.content)}
                          className="absolute -top-2 right-2 inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          {copied === index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copied === index ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-primary px-4 py-3 text-[13.5px] leading-relaxed text-primary-foreground">
                        {message.content}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-cyan-300 ring-1 ring-cyan-400/25">
                    <LoopAiMark className="h-4 w-4 animate-pulse" />
                  </span>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border/60 bg-background/70 px-4 py-3.5">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              {error}
              {error.toLowerCase().includes("admin") && (
                <>
                  {" "}
                  <Link href="/loopadmin" className="font-semibold underline underline-offset-4">
                    Open the admin panel
                  </Link>
                  .
                </>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send(input)
          }}
          className="border-t border-border/60 bg-background/60 px-3 py-3 sm:px-4"
        >
          <div className="relative rounded-2xl border border-border/80 bg-background px-3.5 pb-2 pt-2.5 transition focus-within:border-cyan-400/50 focus-within:ring-4 focus-within:ring-cyan-400/10">
            <Textarea
              ref={areaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void send(input)
                }
              }}
              rows={1}
              placeholder="Ask Loop AI, or paste something to rewrite…"
              className="max-h-44 min-h-[26px] resize-none border-0 bg-transparent p-0 pr-12 text-[13.5px] leading-6 shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !input.trim()}
              className="absolute bottom-2 right-2 h-8 w-8 rounded-xl"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CornerDownLeft className="h-3 w-3" /> Enter to send · Shift + Enter for a new line
            </span>
            <span>Loop AI can be wrong. Check anything you publish.</span>
          </div>
        </form>
      </section>

    </div>
  )
}
