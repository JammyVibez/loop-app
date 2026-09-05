"use client"

import { useMemo } from "react"
import { GitFork, ArrowDown, Sparkles } from "lucide-react"
import { formatNumber, timeAgo } from "@/lib/community-engine"

/**
 * THE COMMUNITY LOOP — how ideas flow through this world:
 * 💡 idea → 💬 discussion → 🗳️ vote → 🛠️ build → 📜 history
 *
 * Every stage is computed from real activity in lib/community-engine
 * (computeCommunityLoop). Each node links back to the content behind it.
 */
export function WorldLoop({
  communityId,
  loop,
  onOpen,
}: {
  communityId: string
  loop: any
  onOpen: (target: { tab: string; id?: number | string }) => void
}) {
  const { stages, flows } = loop || {}
  const stageList = useMemo(() => (Array.isArray(stages) ? stages.filter((s: any) => (s.count || 0) > 0) : []), [stages])
  const flowList = useMemo(() => (Array.isArray(flows) ? flows : []), [flows])

  if (!stageList.length && !flowList.length) return null

  const tabFor = (refType?: string): string =>
    refType === "project" ? "projects" : refType === "challenge" ? "challenges" : refType === "memory" ? "memory" : "feed"

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.07] via-card to-cyan-500/[0.05] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-bold">
          <GitFork className="h-4 w-4 text-indigo-500" /> The Community Loop
        </h2>
        <span className="flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
          <Sparkles className="h-3 w-3" /> 14-day loop
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        See how ideas in this world became discussions, votes, builds and history.
      </p>

      {stageList.length > 0 && (
        <div className="mt-4 flex items-stretch gap-0 overflow-x-auto pb-1">
          {stageList.map((s: any, i: number) => (
            <div key={s.key} className="flex shrink-0 items-center">
              {i > 0 && <ArrowDown className="mx-1 hidden h-4 w-4 rotate-[-90deg] text-indigo-400/50 sm:block" />}
              {i > 0 && <ArrowDown className="mx-0.5 h-4 w-4 text-indigo-400/50 sm:hidden" />}
              <button
                onClick={() => {
                  const first = s.refs?.[0]
                  onOpen({ tab: tabFor(first?.ref_type), id: first?.id })
                }}
                className="group min-w-[112px] rounded-xl border border-border bg-card/80 p-2.5 text-left transition hover:border-indigo-500/50 hover:shadow-md"
                title={s.refs?.length ? `See the ${s.refs.length} newest` : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">{s.emoji}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{s.label.split(" ").pop()}</span>
                </div>
                <p className="mt-1 text-lg font-extrabold leading-none text-indigo-500">{formatNumber(s.count)}</p>
                <p className="mt-0.5 text-[10px] font-semibold leading-tight text-foreground">{s.label}</p>
                {s.refs?.length > 0 && (
                  <p className="mt-1 line-clamp-1 text-[9px] text-muted-foreground group-hover:text-indigo-400">{(s.refs[0].title || "").slice(0, 40)}</p>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {flowList.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hot threads that looped</p>
          {flowList.map((f: any) => (
            <button
              key={f.post_id}
              onClick={() => onOpen({ tab: "feed", id: f.post_id })}
              className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card/70 p-2.5 text-left transition hover:border-indigo-500/40 hover:bg-indigo-500/5"
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-semibold">{f.content || "Discussion"}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>💡 idea · {timeAgo(f.created_at)}</span>
                  <span>→ 💬 {formatNumber(f.comment_count)} replies</span>
                  {f.poll && <span>→ 🗳️ “{(f.poll.question || "").slice(0, 30)}” · {formatNumber(f.poll.total_votes)} votes</span>}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">Open</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
