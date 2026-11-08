"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Loader2, Play } from "lucide-react"
import { ChannelPlayer } from "@/components/channels/channel-player"
import { ChannelNotice, ChannelScreen, posterStyle } from "@/components/channels/channel-ui"
import {
  episodeLabel,
  type ChannelEpisode,
  type ChannelTitleDetails,
} from "@/lib/channels-library"
import { loadLibraryTitle } from "@/lib/channels-client"
import { cn } from "@/lib/utils"
import { ChannelDiscussion } from "@/components/channels/channel-discussion"

export default function SeriesPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""

  const [show, setShow] = useState<ChannelTitleDetails | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!id) return
    setStatus("loading")
    void loadLibraryTitle(id).then((result) => {
      if (cancelled) return
      setShow(result.data)
      setError(result.error)
      setStatus(result.error || !result.data ? "error" : "ready")
      setSelectedId(result.data?.episodes[0]?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const selected = useMemo(
    () => show?.episodes.find((episode) => episode.id === selectedId) ?? show?.episodes[0] ?? null,
    [show, selectedId],
  )

  const seasons = useMemo(() => {
    const grouped = new Map<number, ChannelEpisode[]>()
    for (const episode of show?.episodes ?? []) {
      const list = grouped.get(episode.season) ?? []
      list.push(episode)
      grouped.set(episode.season, list)
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0])
  }, [show])

  const meta = show
    ? [show.year ? String(show.year) : null, show.country, show.language, `${show.episodes.length} episodes`]
        .filter(Boolean)
        .join(" · ")
    : ""

  return (
    <ChannelScreen title={show?.title ?? "Show"}>
      <div className="mx-auto w-full max-w-3xl pb-12">
        {status === "loading" ? (
          <div
            className="flex aspect-video w-full items-center justify-center"
            style={posterStyle(show?.title ?? "Show")}
          >
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : (
          <ChannelPlayer
            src={selected?.videoUrl ?? null}
            title={selected ? `${show?.title ?? "Show"} — ${episodeLabel(selected)}` : show?.title ?? "Show"}
            poster={show?.backdrop ?? show?.poster ?? null}
            className="rounded-none"
          />
        )}

        <div className="space-y-5 px-4 py-4">
          {status === "error" ? (
            <ChannelNotice
              title="This show is not available"
              description={error ?? "It may have been unpublished or removed from the library."}
              tone="warning"
            >
              <Link href="/channels?tab=series" className="mt-2 inline-block text-xs font-semibold text-white underline decoration-white/30 underline-offset-4">
                Browse shows
              </Link>
            </ChannelNotice>
          ) : null}

          {show ? (
            <>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{show.title}</h1>
                <p className="mt-1.5 text-[13px] text-white/50">
                  {meta}
                  {show.genres.length ? `${meta ? " · " : ""}${show.genres.join(", ")}` : ""}
                </p>
                {selected ? (
                  <p className="mt-2 text-[13px] font-semibold text-white/80">
                    Now playing: {episodeLabel(selected)}
                    {selected.name ? ` — ${selected.name}` : ""}
                  </p>
                ) : null}
                {show.synopsis ? (
                  <p className="mt-3 text-[14px] leading-relaxed text-white/70">{show.synopsis}</p>
                ) : null}
              </div>

              {show.episodes.length ? (
                <div className="space-y-5">
                  {seasons.map(([season, episodes]) => (
                    <section key={season}>
                      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-white/45">
                        Season {season}
                      </h2>
                      <div className="space-y-1.5">
                        {episodes.map((episode) => {
                          const active = episode.id === selected?.id
                          return (
                            <button
                              key={episode.id}
                              type="button"
                              onClick={() => setSelectedId(episode.id)}
                              aria-pressed={active}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                                active
                                  ? "border-white/25 bg-white/[0.10]"
                                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]",
                              )}
                            >
                              <span className="w-16 shrink-0 text-[11px] font-bold text-white/45">
                                {episodeLabel(episode)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">
                                {episode.name || `Episode ${episode.episode}`}
                              </span>
                              <Play
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  active ? "fill-white text-white" : "text-white/40",
                                )}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <ChannelNotice
                  title="No episodes yet"
                  description="This show has no episodes published. Check back soon."
                />
              )}
            </>
          ) : null}

          {show ? <ChannelDiscussion titleId={show.id} title={show.title} kind="series" /> : null}

          <Link
            href="/channels?tab=series"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-[13px] font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ChevronLeft className="h-4 w-4" />
            All shows
          </Link>
        </div>
      </div>
    </ChannelScreen>
  )
}
