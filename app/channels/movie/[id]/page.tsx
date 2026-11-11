"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ChevronLeft,
  Clock,
  Globe2,
  Loader2,
  Play,
  Share2,
  Star,
} from "@/components/icons/lucide-compat"
import { ChannelPlayer } from "@/components/channels/channel-player"
import { ChannelArt, ChannelNotice, ChannelScreen, posterStyle } from "@/components/channels/channel-ui"
import { runtimeLabel, type ChannelTitle, type ChannelTitleDetails } from "@/lib/channels-library"
import { loadLibrary, loadLibraryTitle } from "@/lib/channels-client"
import { ChannelDiscussion } from "@/components/channels/channel-discussion"

export default function MoviePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""

  const [movie, setMovie] = useState<ChannelTitleDetails | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [related, setRelated] = useState<ChannelTitle[]>([])
  const [artFailed, setArtFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!id) return
    setStatus("loading")
    setArtFailed(false)
    void loadLibraryTitle(id).then((result) => {
      if (cancelled) return
      setMovie(result.data)
      setError(result.error)
      setStatus(result.error || !result.data ? "error" : "ready")
    })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    void loadLibrary({ kind: "movie", limit: 14 }).then((result) => {
      if (!cancelled) setRelated(result.data?.titles ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const art = movie?.backdrop ?? movie?.poster ?? null
  const meta = movie
    ? [
        movie.year ? String(movie.year) : null,
        runtimeLabel(movie.runtimeMinutes),
        movie.country,
        movie.language,
      ].filter(Boolean)
    : []

  const moreLikeThis = useMemo(
    () =>
      related
        .filter((title) => title.id !== id)
        .sort((a, b) => {
          const shared = (title: ChannelTitle) =>
            title.genres.filter((genre) => movie?.genres.includes(genre)).length
          return shared(b) - shared(a)
        })
        .slice(0, 10),
    [id, movie?.genres, related],
  )

  const startMovie = () => {
    document.getElementById("watch")?.scrollIntoView({ behavior: "smooth", block: "center" })
    // Dispatched inside the click so the browser still grants playback.
    window.dispatchEvent(new Event("loop:channel-play"))
  }

  const jumpToShare = () => {
    document.getElementById("channel-share")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <ChannelScreen title={movie?.title ?? "Movie"}>
      <div className="w-full pb-16">
        {/* ── Cinematic hero ── */}
        <section className="relative isolate overflow-hidden bg-black">
          <div className="relative min-h-[540px] sm:min-h-[620px]">
            <div className="absolute inset-0" style={posterStyle(movie?.title ?? "Movie")}>
              {art && !artFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={art}
                  alt=""
                  className="h-full w-full scale-105 object-cover object-center"
                  onError={() => setArtFailed(true)}
                />
              ) : null}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#08080b] via-black/45 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#08080b] to-transparent" />

            <div className="relative mx-auto flex min-h-[540px] max-w-5xl items-end px-4 pb-10 pt-28 sm:min-h-[620px] sm:px-8 sm:pb-14">
              {status === "loading" ? (
                <div className="space-y-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-white/15" />
                  <div className="h-12 w-72 animate-pulse rounded bg-white/15" />
                  <div className="h-4 w-56 animate-pulse rounded bg-white/10" />
                </div>
              ) : (
                <div className="max-w-2xl text-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded bg-[#e50914] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                      <Star className="h-3 w-3 fill-current" />
                      Movie
                    </span>
                    {movie?.featured ? (
                      <span className="rounded border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85 backdrop-blur">
                        Featured
                      </span>
                    ) : null}
                  </div>

                  <h1 className="mt-3 line-clamp-3 break-words text-[40px] font-black leading-[0.98] tracking-[-0.03em] drop-shadow-[0_8px_30px_rgba(0,0,0,0.65)] sm:text-[64px]">
                    {movie?.title ?? "Movie"}
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] font-medium text-white/75 sm:text-[13px]">
                    {meta.map((entry) => (
                      <span key={entry}>{entry}</span>
                    ))}
                    {movie?.genres.map((genre) => (
                      <span key={genre} className="rounded-full border border-white/20 px-2 py-0.5 text-[11px]">
                        {genre}
                      </span>
                    ))}
                  </div>

                  {movie?.synopsis ? (
                    <p className="mt-3 line-clamp-3 max-w-xl text-[14px] leading-relaxed text-white/80 sm:text-[15px]">
                      {movie.synopsis}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={startMovie}
                      disabled={!movie?.videoUrl}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-black text-black shadow-[0_18px_50px_-18px_rgba(255,255,255,0.6)] transition hover:bg-white/90 disabled:opacity-50"
                    >
                      <Play className="h-5 w-5 fill-black" />
                      Play movie
                    </button>
                    <button
                      type="button"
                      onClick={jumpToShare}
                      className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 text-[14px] font-bold text-white backdrop-blur-md transition hover:bg-white/20"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Theater strip ── */}
        <section id="watch" className="bg-[#08080b] pb-6 pt-1 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            {status === "loading" ? (
              <div className="flex aspect-video w-full items-center justify-center rounded-none bg-black sm:rounded-2xl">
                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
              </div>
            ) : (
              <div className="relative">
                <div className="pointer-events-none absolute -inset-x-6 -top-2 bottom-0 -z-10 opacity-60 blur-3xl">
                  <div className="h-full w-full rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(229,9,20,0.35),transparent_70%)]" />
                </div>
                <ChannelPlayer
                  src={movie?.videoUrl ?? null}
                  title={movie?.title ?? "Movie"}
                  poster={movie?.backdrop ?? movie?.poster ?? null}
                  className="rounded-none shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] sm:rounded-2xl"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pt-3 text-[11px] text-white/55 sm:px-0">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {runtimeLabel(movie?.runtimeMinutes ?? null) ?? "Runtime not listed"}
              </span>
              {movie?.country ? (
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="h-3.5 w-3.5" />
                  {movie.country}
                </span>
              ) : null}
              {movie ? <span>{movie.genres.join(" · ")}</span> : null}
              <span className="ml-auto inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e50914]" />
                Streams automatically in HD
              </span>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-8">
          {status === "error" ? (
            <ChannelNotice
              title="This title is not available"
              description={error ?? "It may have been unpublished or removed from the library."}
              tone="warning"
            >
              <Link
                href="/channels?tab=movies"
                className="mt-2 inline-block text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4"
              >
                Browse Channels
              </Link>
            </ChannelNotice>
          ) : null}

          {movie ? (
            <>
              <section className="grid gap-6 border-b border-border pb-8 sm:grid-cols-[1.6fr_1fr]">
                <div>
                  <h2 className="text-[18px] font-black tracking-tight">About {movie.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">
                    {movie.synopsis || "No synopsis has been added for this title yet."}
                  </p>
                  {movie.genres.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {movie.genres.map((genre) => (
                        <span
                          key={genre}
                          className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <dl className="grid h-fit grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-border bg-card p-4 text-[12px]">
                  {[
                    ["Type", "Movie"],
                    ["Year", movie.year ? String(movie.year) : "—"],
                    ["Runtime", runtimeLabel(movie.runtimeMinutes) ?? "—"],
                    ["Country", movie.country ?? "—"],
                    ["Language", movie.language ?? "—"],
                    ["Added", movie.createdAt ? new Date(movie.createdAt).toLocaleDateString() : "—"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {moreLikeThis.length ? (
                <section className="border-b border-border py-8">
                  <h2 className="text-[18px] font-black tracking-tight">More like this</h2>
                  <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {moreLikeThis.map((title) => (
                      <Link
                        key={title.id}
                        href={`/channels/movie/${encodeURIComponent(title.id)}`}
                        className="group w-[36%] shrink-0 sm:w-[22%]"
                      >
                        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl ring-1 ring-border">
                          <ChannelArt
                            src={title.poster}
                            name={title.title}
                            fit="cover"
                            className="absolute inset-0 h-full w-full"
                            rounded="rounded-xl"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80 transition group-hover:opacity-95" />
                          <span className="absolute inset-x-0 bottom-0 line-clamp-2 px-2 pb-2 text-[12px] font-bold leading-tight text-white">
                            {title.title}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {[title.year, runtimeLabel(title.runtimeMinutes)].filter(Boolean).join(" · ")}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <div id="channel-share" className="scroll-mt-20 pt-8">
                <ChannelDiscussion titleId={movie.id} title={movie.title} kind="movie" />
              </div>
            </>
          ) : null}

          <Link
            href="/channels?tab=movies"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-muted px-4 text-[13px] font-semibold text-foreground ring-1 ring-border transition hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
            All movies
          </Link>
        </div>
      </div>
    </ChannelScreen>
  )
}
