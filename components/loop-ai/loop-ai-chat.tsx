"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUp, Bot, Loader2, Sparkles, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Draft a Loop announcing my community's first event",
  "Turn this idea into three opening lines for a discussion thread",
  "Summarise what makes a good Circle welcome post",
  "Rewrite this caption shorter and sharper:",
]

const STORAGE_KEY = "loop-ai:conversation"

export function LoopAiChat() {
  const { user, getAuthHeader } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerLabel, setProviderLabel] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)

  // Keep the conversation in the tab so a refresh does not lose it.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setMessages(parsed.slice(-20))
      }
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

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      const next: Message[] = [...messages, { role: "user", content: trimmed }]
      setMessages(next)
      setInput("")
      setSending(true)
      setError(null)

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next.slice(-12) }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || data.error || "Loop AI could not answer")
        setProviderLabel(data.provider_label ? `${data.provider_label} · ${data.model}` : null)
        setMessages((prev) => [...prev, { role: "assistant", content: String(data.reply || "") }])
      } catch (err: any) {
        setError(err.message || "Loop AI could not answer right now.")
      } finally {
        setSending(false)
        areaRef.current?.focus()
      }
    },
    [getAuthHeader, messages, sending],
  )

  if (!user) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20">
          <Bot className="h-6 w-6 text-cyan-400" />
        </div>
        <p className="text-sm font-semibold">Sign in to talk to Loop AI</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          It keeps your drafts and questions attached to your account.
        </p>
        <Button asChild className="mt-5 rounded-full">
          <Link href="/auth?returnTo=%2Floop-ai">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-3xl border border-border bg-card/60 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          Loop AI
          {providerLabel && (
            <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              {providerLabel}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([])
              setError(null)
            }}
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            New chat
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl pt-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 via-indigo-500/20 to-fuchsia-500/25 ring-1 ring-cyan-400/25">
              <Sparkles className="h-6 w-6 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">What are we building today?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Draft posts and threads, sharpen captions, plan a Circle week, or think out loud. Loop AI answers with
              whichever provider your admin connected.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-2xl border border-border bg-background/60 px-3.5 py-3 text-left text-xs font-medium leading-relaxed text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role === "assistant" && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/20 ring-1 ring-cyan-400/25">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border/70 bg-background/80",
                )}
              >
                {message.content}
              </div>
              {message.role === "user" && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </span>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/20 ring-1 ring-cyan-400/25">
              <Sparkles className="h-4 w-4 animate-pulse text-cyan-400" />
            </span>
            <div className="rounded-2xl rounded-bl-md border border-border/70 bg-background/80 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
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
        className="border-t border-border/70 bg-background/80 px-3 py-3 sm:px-4"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/50">
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
            placeholder="Ask Loop AI anything…"
            className="min-h-[38px] max-h-40 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !input.trim()}
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Loop AI can be wrong. Check anything important before you publish it.
        </p>
      </form>
    </div>
  )
}
