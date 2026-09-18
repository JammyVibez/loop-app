"use client"

import type { ComponentType } from "react"
import {
  Archive,
  Bell,
  BellOff,
  BellRing,
  ChevronRight,
  Hammer,
  HelpCircle,
  Layers,
  Pin,
  Scale,
  Sparkles,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { timeAgo } from "@/lib/community-engine"

/** What kind of work a thread is. Four, deliberately. */
export const THREAD_KINDS = [
  { id: "make", label: "Make", hint: "Build or ship something together", icon: Hammer },
  { id: "decide", label: "Decide", hint: "Settle a question and record the answer", icon: Scale },
  { id: "ask", label: "Ask", hint: "Get help or a second opinion", icon: HelpCircle },
  { id: "show", label: "Show", hint: "Share work in progress", icon: Sparkles },
] as const

export type ThreadKindId = (typeof THREAD_KINDS)[number]["id"]

export function threadKind(id?: string | null) {
  return THREAD_KINDS.find((k) => k.id === id) || THREAD_KINDS[0]
}

export function ThreadKindIcon({ kind, className }: { kind?: string | null; className?: string }) {
  const k = threadKind(kind)
  const Icon = k.icon as ComponentType<{ className?: string }>
  return <Icon className={className} />
}

/** Lifecycle chip — flat tints, one per state. */
const STATE_STYLE: Record<string, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  decided: {
    label: "Decided",
    className: "border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  archived: { label: "Archived", className: "border-border bg-muted text-muted-foreground" },
}

export function ThreadStateChip({ state, className = "" }: { state?: string | null; className?: string }) {
  const style = STATE_STYLE[state || "open"] || STATE_STYLE.open
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.className} ${className}`}
    >
      {state === "archived" && <Archive className="h-2.5 w-2.5" />}
      {style.label}
    </span>
  )
}

/** Per-thread notification level. */
export const FOLLOW_MODES = [
  { id: "all", label: "Everything", hint: "Ping me for every contribution", icon: BellRing },
  { id: "mentions", label: "Mentions only", hint: "Only when someone names me", icon: Bell },
  { id: "none", label: "Muted", hint: "Keep it out of my notifications", icon: BellOff },
] as const

export function FollowIcon({ mode, className }: { mode?: string | null; className?: string }) {
  const found = FOLLOW_MODES.find((f) => f.id === (mode || "none"))
  const Icon = found?.icon || BellOff
  return <Icon className={className} />
}

export interface ThreadRecord {
  id: number
  title: string
  prompt?: string | null
  kind?: string | null
  state?: string | null
  outcome?: string | null
  is_pinned?: boolean
  contribution_count?: number
  last_activity_at?: string | null
  created_at?: string | null
  follow_mode?: string | null
  creator?: { username?: string | null; display_name?: string | null; avatar_url?: string | null } | null
  space?: { id: number; name: string; icon?: string | null } | null
}

/**
 * One thread, as it appears in a list. Dense on purpose: the title carries the
 * weight and everything else is quiet metadata on a single line.
 */
export function ThreadRow({
  thread,
  onOpen,
  active,
}: {
  thread: ThreadRecord
  onOpen: (thread: ThreadRecord) => void
  active?: boolean
}) {
  const contributions = Number(thread.contribution_count || 0)
  const isOpen = (thread.state || "open") === "open"

  return (
    <button
      type="button"
      onClick={() => onOpen(thread)}
      className={`group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors ${
        active ? "bg-muted/60" : "hover:bg-muted/40"
      }`}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
        <ThreadKindIcon kind={thread.kind} className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {thread.is_pinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
          <span className="truncate text-sm font-semibold text-foreground">{thread.title}</span>
          <ThreadStateChip state={thread.state} />
          {thread.follow_mode && thread.follow_mode !== "none" && (
            <FollowIcon mode={thread.follow_mode} className="h-3 w-3 shrink-0 text-muted-foreground/70" />
          )}
        </span>

        {thread.prompt ? (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{thread.prompt}</span>
        ) : null}

        {thread.state === "decided" && thread.outcome ? (
          <span className="mt-2 block rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Outcome</span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-foreground/90">{thread.outcome}</span>
          </span>
        ) : null}

        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          {thread.creator ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar className="h-4 w-4">
                <AvatarImage src={thread.creator.avatar_url || ""} alt="" />
                <AvatarFallback className="text-[8px]">
                  {(thread.creator.display_name || thread.creator.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {thread.creator.display_name || thread.creator.username}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Layers className="h-3 w-3" />
            {contributions} {contributions === 1 ? "contribution" : "contributions"}
          </span>
          {thread.last_activity_at ? <span>{timeAgo(thread.last_activity_at)}</span> : null}
          {thread.space?.name ? <span className="truncate">{thread.space.name}</span> : null}
        </span>
      </span>

      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
    </button>
  )
}
