"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Loader2, Play, SkipBack, SkipForward } from "lucide-react"
import { ChannelPlayer } from "@/components/channels/channel-player"
import {
  ChannelNotice,
  ChannelScreen,
  posterStyle,
} from "@/components/channels/channel-ui"
import { type ResolvedStream } from "@/lib/channels"
import { loadChannelResource } from "@/lib/channels-client"

const PROVIDER_LABELS: Record<string, string> = {
  kisskh: "KissKH",
  asiaflix: "AsiaFlix",
  dramacool: "DramaCool",
  asianc: "AsianC",
  drama123: "Drama123",
  actv: "AsianC TV",
}

function providerLabel(id: string): string {
  return (
    PROVIDER_LABELS[id] ??
    id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
  )
}

export default function DramaProviderPage() {
  const params = useParams<{ id: string }>()
  const providerId = params?.id ?? ""
  const providerName = providerLabel(providerId)

  const [title, setTitle] = useState("")
  const [episode, setEpisode] = useState(1)
  const [activeTitle, setActiveTitle] = useState<string | null>(null)
  const [stream, setStream] = useState<ResolvedStream | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)

  const resolve = async (term: string, episodeNumber: number) => {
    const clean = term.trim()
    if (!clean) {
      setError("Enter a drama title first.")
      setStatus("error")
      return
    }
    if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
      setError("Episode must be a positive number.")
      setStatus("error")
      return
    }

    setStatus("loading")
    setError(null)
    const result = await loadChannelResource<ResolvedStream>({
      kind: "drama-watch",
      id: clean,
      episode: Math.floor(episodeNumber),
      src: providerId,
    })
    setConfigured(result.configured)
    // Keep the previous episode playing if the next one fails to resolve.
    if (!result.error) setStream(result.data)
    setActiveTitle(result.error ? activeTitle : clean)
    setError(result.error)
    setStatus(result.error ? "error" : "idle")
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void resolve(title, episode)
  }

  const step = (delta: number) => {
    const next = episode + delta
    if (next < 1 || !activeTitle) return
    setEpisode(next)
    void resolve(activeTitle, next)
  }

  return (
    <ChannelScreen title={providerName}>
      <div className="mx-auto w-full max-w-3xl">
        {stream?.playbackUrl ? (
          <ChannelPlayer
            src={stream.playbackUrl}
            title={stream.title ?? activeTitle ?? providerName}
            className="rounded-none"
          />
        ) : (
          <div
            className="relative flex aspect-video w-full items-center justify-center"
            style={posterStyle(providerName)}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                {status === "loading" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/70" />
                ) : (
                  <Play className="h-5 w-5 text-white/70" />
                )}
              </span>
              <p className="text-[13px] font-semibold text-white/80">
                {status === "loading" ? "Resolving episode…" : "No episode loaded"}
              </p>
              <p className="max-w-xs text-[11px] leading-relaxed text-white/45">
                Enter a title below to resolve playback through {providerName}.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5 px-4 py-4">
          {stream ? (
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {stream.title ?? activeTitle}
              </h1>
              <p className="mt-1 text-[13px] text-white/45">
                Episode {episode}
                {stream.engine ? ` · ${stream.engine}` : ""}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={episode <= 1 || status === "loading"}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 text-[12px] font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-40"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={status === "loading"}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-bold text-black transition hover:bg-white/90 disabled:opacity-40"
                >
                  Next episode
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="drama-title" className="block text-[12px] font-semibold text-white/60">
                Drama title
              </label>
              <input
                id="drama-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Hidden Love"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
              />
            </div>

            <div className="flex items-end gap-3">
              <div className="w-24 space-y-1.5">
                <label
                  htmlFor="drama-episode"
                  className="block text-[12px] font-semibold text-white/60"
                >
                  Episode
                </label>
                <input
                  id="drama-episode"
                  type="number"
                  min={1}
                  value={episode}
                  onChange={(event) => setEpisode(Number(event.target.value) || 1)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white focus:border-white/25 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-bold text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-black" />
                )}
                Resolve episode
              </button>
            </div>
          </form>

          {!configured ? (
            <ChannelNotice
              title="Channel guide is not connected"
              description="Set ULTRASRC_API_URL and ULTRASRC_API_KEY in the server environment to resolve dramas."
            />
          ) : null}

          {status === "error" && error ? (
            <ChannelNotice title="Episode unavailable" description={error} tone="warning" />
          ) : null}

          <ChannelNotice
            title={`About ${providerName}`}
            description="UltraSrc resolves drama episodes by title or MyDramaList id. Titles that the provider does not carry will return an extraction error instead of a stream."
          />

          <Link
            href="/channels"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-[13px] font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to the guide
          </Link>
        </div>
      </div>
    </ChannelScreen>
  )
}
