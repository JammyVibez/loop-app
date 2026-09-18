"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Flame,
  History,
  Radio,
  Sparkles,
  Trophy,
  Vote,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNumber, timeAgo } from "@/lib/community-engine"
import { ThreadRow, type ThreadRecord } from "@/components/communities/thread-row"

/**
 * The Circle canvas — the front door of a community.
 *
 * Deliberately not a channel rail and not a dashboard: the work sits in the
 * middle (threads → what came out of them), what's alive right now sits on the
 * right, and the room itself (who's here, the rules) is quiet at the bottom.
 */

function Panel({
  title,
  hint,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-xs text-muted-foreground">{children}</p>
}

const KIND_LABEL: Record<string, string> = {
  milestone: "Milestone",
  legend: "Legend",
  memory: "Memory",
  announcement: "Announcement",
  favorite: "Favorite",
  most_discussed: "Most discussed",
  top_contribution: "Top contribution",
}

export function CircleCanvas({
  bundle,
  communityId,
  onOpenTab,
  onOpenItem,
  onOpenThread,
  onNewThread,
}: {
  bundle: any
  communityId: string
  onOpenTab: (t: { tab: string; id?: number | string }) => void
  onOpenItem: (item: any) => void
  onOpenThread: (thread: ThreadRecord) => void
  onNewThread: () => void
}) {
  const online: any[] = bundle.online_members || []
  const threads: ThreadRecord[] = bundle.threads || []
  const happening: any[] = bundle.happening || []
  const projects: any[] = bundle.projects || []
  const challenges: any[] = (bundle.challenges || []).filter((c: any) => c.status === "active")
  const powers: any[] = bundle.powers || []
  const assignments: Record<string, number[]> = bundle.power_assignments || {}
  const rules: string[] = bundle.community?.rules?.rules || []
  const pulse = bundle.pulse || {}

  const openThreads = threads.filter((t) => (t.state || "open") === "open")
  const decidedThreads = threads.filter((t) => t.state === "decided")
  const decisions = challenges.slice(0, 3)
  const activeProjects = projects.filter((p) => p.status === "active").slice(0, 3)

  // Record = what the community decided and shipped, merged from memory + moments.
  const record = [
    ...(bundle.memory?.manual || []),
    ...(bundle.memory?.auto || []),
    ...(bundle.moments?.all || []),
  ]
    .filter((m: any) => m?.title)
    .reduce((acc: any[], item: any) => {
      if (!acc.some((a) => a.title === item.title)) acc.push(item)
      return acc
    }, [])
    .slice(0, 6)

  const powerById = new Map(powers.map((p: any) => [p.id, p]))

  return (
    <div className="space-y-4">
      {/* ── Presence ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {online.length > 0 ? (
            <>
              <div className="flex -space-x-2">
                {online.slice(0, 5).map((m: any) => (
                  <Avatar key={m.user_id} className="h-7 w-7 ring-2 ring-card">
                    <AvatarImage src={m.user?.avatar_url || ""} alt="" />
                    <AvatarFallback className="text-[10px]">
                      {(m.user?.display_name || m.user?.username || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {online.length === 1 ? "1 person here" : `${online.length} people here`}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {online
                    .slice(0, 3)
                    .map((m: any) => m.user?.display_name || m.user?.username)
                    .filter(Boolean)
                    .join(", ")}
                  {online.length > 3 ? ` and ${online.length - 3} more` : ""}
                </p>
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Nothing happening right now</p>
              <p className="text-[11px] text-muted-foreground">
                {pulse.new_members_24h
                  ? `${formatNumber(pulse.new_members_24h)} joined in the last day — say hello.`
                  : "Be the first one here — open a thread and the room fills up."}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {bundle.is_member ? (
            <Button size="sm" className="h-8 rounded-full px-3 text-xs" onClick={onNewThread}>
              New thread
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
            <Link href="/co-loop">
              <Radio className="mr-1.5 h-3.5 w-3.5" /> Co-Loop
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Left: the work ── */}
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Threads"
            hint="Work with an end. Every thread runs open → decided, then gets archived."
            bodyClassName="divide-y divide-border/60"
            action={
              <button
                type="button"
                onClick={() => onOpenTab({ tab: "threads" })}
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                All threads <ArrowRight className="h-3 w-3" />
              </button>
            }
          >
            {openThreads.length === 0 && decidedThreads.length === 0 ? (
              <Empty>
                No threads yet. A thread is one piece of work: a decision to make, something to build, a question to
                settle.
                {bundle.is_member ? " Open the first one." : " Join to open one."}
              </Empty>
            ) : (
              <>
                {openThreads.slice(0, 4).map((t) => (
                  <ThreadRow key={t.id} thread={t} onOpen={onOpenThread} />
                ))}
                {openThreads.length === 0 && decidedThreads.length > 0 ? (
                  <Empty>Everything is decided — nice. Nothing open right now.</Empty>
                ) : null}
                {decidedThreads.length > 0 ? (
                  <div className="divide-y divide-border/60">
                    <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Settled
                    </p>
                    {decidedThreads.slice(0, 3).map((t) => (
                      <ThreadRow key={t.id} thread={t} onOpen={onOpenThread} />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </Panel>

          <Panel
            title="Record"
            hint="What this community decided, shipped and remembers"
            bodyClassName="divide-y divide-border/60"
          >
            {record.length === 0 ? (
              <Empty>Nothing recorded yet. Outcomes you log on threads land here.</Empty>
            ) : (
              record.map((m: any, i: number) => (
                <button
                  key={`${m.title}-${i}`}
                  type="button"
                  onClick={() => onOpenItem(m)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">{m.title}</span>
                      {KIND_LABEL[m.kind] ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {KIND_LABEL[m.kind]}
                        </span>
                      ) : null}
                    </span>
                    {m.description ? (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">
                        {m.description}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[10px] text-muted-foreground/80">
                      {timeAgo(m.happened_at || m.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </Panel>
        </div>

        {/* ── Right: live, decisions, people ── */}
        <div className="space-y-4">
          <Panel
            title="Live now"
            hint="Straight from this community's activity"
            bodyClassName="divide-y divide-border/60"
            action={<Activity className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
          >
            {happening.length === 0 ? (
              <Empty>The room is quiet. Open a thread to get it moving.</Empty>
            ) : (
              happening.slice(0, 5).map((h: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onOpenItem(h)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">{h.title}</span>
                    {h.description ? (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">
                        {h.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </Panel>

          {decisions.length > 0 ? (
            <Panel
              title="Needs a decision"
              hint="Open votes — every member counts"
              bodyClassName="divide-y divide-border/60"
              action={<Vote className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
            >
              {decisions.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenTab({ tab: "challenges", id: c.id })}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">{c.title || c.prompt}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {c.entry_count ? `${formatNumber(c.entry_count)} entries · ` : ""}
                      {c.ends_at ? `closes ${timeAgo(c.ends_at, true)}` : "voting open"}
                    </span>
                  </span>
                </button>
              ))}
            </Panel>
          ) : null}

          {activeProjects.length > 0 ? (
            <Panel
              title="In progress"
              hint="Long-running work this community is part of"
              bodyClassName="divide-y divide-border/60"
              action={<ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            >
              {activeProjects.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenTab({ tab: "projects", id: p.id })}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">{p.title}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{p.progress || 0}%</span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-foreground/60"
                      style={{ width: `${Math.max(2, Math.min(100, p.progress || 0))}%` }}
                    />
                  </span>
                </button>
              ))}
            </Panel>
          ) : null}

          <Panel
            title="Members"
            hint={`${formatNumber(bundle.member_count || 0)} in this community`}
            bodyClassName="divide-y divide-border/60"
            action={
              <button
                type="button"
                onClick={() => onOpenTab({ tab: "members" })}
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                All <ArrowRight className="h-3 w-3" />
              </button>
            }
          >
            {(bundle.recent_members || []).slice(0, 5).map((m: any) => {
              const held = (assignments[m.user_id] || []).map((id: number) => powerById.get(id)).filter(Boolean)
              return (
                <div key={m.user_id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={m.user?.avatar_url || ""} alt="" />
                    <AvatarFallback className="text-[10px]">
                      {(m.user?.display_name || m.user?.username || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {m.user?.display_name || m.user?.username}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {["owner", "admin", "moderator"].includes(m.role) ? (
                        <span className="rounded border border-border bg-muted px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          {m.role}
                        </span>
                      ) : null}
                      {held.map((p: any) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-px text-[9px] font-semibold"
                          style={{ color: p.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
            {(bundle.recent_members || []).length === 0 ? <Empty>No members yet.</Empty> : null}
          </Panel>

          {rules.length > 0 ? (
            <Panel title="How this place works" hint={`${rules.length} rules`}>
              <ol className="space-y-2 px-4 py-3">
                {rules.slice(0, 5).map((rule, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                    <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold tabular-nums">
                      {i + 1}
                    </span>
                    {rule}
                  </li>
                ))}
              </ol>
            </Panel>
          ) : (
            <Panel title="How this place works">
              <div className="space-y-2 px-4 py-3">
                {[
                  "Open a thread for anything you want an outcome from.",
                  "Post in the feed when you just want to say something.",
                  "Powers decide who can moderate, invite and run threads.",
                ].map((line) => (
                  <p key={line} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                    <Sparkles className="mt-px h-3 w-3 shrink-0 text-muted-foreground/60" />
                    {line}
                  </p>
                ))}
                {bundle.is_admin ? (
                  <button
                    type="button"
                    onClick={() => onOpenTab({ tab: "powers" })}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline"
                  >
                    Set up Powers <ArrowRight className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </Panel>
          )}

          {bundle.community?.welcome_message ? (
            <Panel title="Welcome">
              <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {bundle.community.welcome_message}
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}
