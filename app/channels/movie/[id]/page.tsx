"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Loader2 } from "lucide-react"
import { ChannelPlayer } from "@/components/channels/channel-player"
import { ChannelNotice, ChannelScreen, posterStyle } from "@/components/channels/channel-ui"
import { runtimeLabel, type ChannelTitleDetails } from "@/lib/channels-library"
import { loadLibraryTitle } from "@/lib/channels-client"
import { ChannelDiscussion } from "@/components/channels/channel-discussion"

export default function MoviePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""

  const [movie, setMovie] = useState<ChannelTitleDetails | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!id) return
    setStatus("loading")
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

  const meta = movie
    ? [
        movie.year ? String(movie.year) : null,
        runtimeLabel(movie.runtimeMinutes),
        movie.country,
        movie.language,
      ].filter(Boolean)
    : []

  return (
    <ChannelScreen title={movie?.title ?? "Movie"}>
      <div className="mx-auto w-full max-w-3xl pb-12">
        {status === "loading" ? (
          <div
            className="flex aspect-video w-full items-center justify-center"
            style={posterStyle(movie?.title ?? "Movie")}
          >
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : (
          <ChannelPlayer
            src={movie?.videoUrl ?? null}
            title={movie?.title ?? "Movie"}
            poster={movie?.backdrop ?? movie?.poster ?? null}
            className="rounded-none"
          />
        )}

        <div className="space-y-5 px-4 py-4">
          {status === "error" ? (
            <ChannelNotice
              title="This title is not available"
              description={error ?? "It may have been unpublished or removed from the library."}
              tone="warning"
            >
              <Link href="/channels" className="mt-2 inline-block text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4">
                Browse Channels
              </Link>
            </ChannelNotice>
          ) : null}

          {movie ? (
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{movie.title}</h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {meta.join(" · ")}
                {movie.genres.length ? `${meta.length ? " · " : ""}${movie.genres.join(", ")}` : ""}
              </p>

              {movie.synopsis ? (
                <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{movie.synopsis}</p>
              ) : null}
            </div>
          ) : null}

          {movie ? <ChannelDiscussion titleId={movie.id} title={movie.title} kind="movie" /> : null}

          <Link
            href="/channels?tab=movies"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-muted px-4 text-[13px] font-semibold text-foreground ring-1 ring-border transition hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
            All movies
          </Link>
        </div>
      </div>
    </ChannelScreen>
  )
}
