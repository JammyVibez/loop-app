"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Radio } from "lucide-react"
import { ChannelPlayer } from "@/components/channels/channel-player"
import {
  ChannelNotice,
  ChannelScreen,
  ChannelSkeleton,
} from "@/components/channels/channel-ui"
import { type ResolvedStream } from "@/lib/channels"
import { loadChannelResource } from "@/lib/channels-client"

interface LiveWatchData extends ResolvedStream {
  group: string | null
}

export default function LiveChannelPage() {
  const params = useParams<{ id: string }>()
  const channelId = params?.id ?? ""

  const [data, setData] = useState<LiveWatchData | null>(null)
  const [configured, setConfigured] = useState(true)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!channelId) {
      setStatus("error")
      setError("This channel link is missing an id.")
      return
    }

    let cancelled = false
    setStatus("loading")
    void loadChannelResource<LiveWatchData>({ kind: "live-watch", id: channelId }).then((result) => {
      if (cancelled) return
      setConfigured(result.configured)
      setData(result.data)
      setError(result.error)
      setStatus(result.error ? "error" : "ready")
    })

    return () => {
      cancelled = true
    }
  }, [channelId])

  const title = data?.title ?? channelId

  return (
    <ChannelScreen title={title}>
      <div className="mx-auto w-full max-w-3xl">
        {status === "loading" ? (
          <ChannelSkeleton className="aspect-video w-full rounded-none" />
        ) : (
          <ChannelPlayer
            src={data?.playbackUrl ?? null}
            title={title}
            live
            className="rounded-none"
          />
        )}

        <div className="space-y-4 px-4 py-4">
          {!configured ? (
            <ChannelNotice
              title="Channel guide is not connected"
              description="Set ULTRASRC_API_URL and ULTRASRC_API_KEY in the server environment to stream live channels."
            />
          ) : null}

          {status === "error" ? (
            <ChannelNotice title="This channel could not be resolved" description={error} tone="warning" />
          ) : null}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                LIVE
              </span>
              {data?.group ? (
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/60">
                  {data.group}
                </span>
              ) : null}
              {data?.engine ? (
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/60">
                  {data.engine}
                </span>
              ) : null}
            </div>

            <h1 className="mt-2.5 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-[13px] text-white/45">
              Live broadcast relayed by the configured UltraSrc instance. Playback can pause when
              the provider rotates its stream token.
            </p>
          </div>

          {data?.errors.length ? (
            <p className="text-[12px] text-amber-200/70">{data.errors[0]}</p>
          ) : null}

          <Link
            href="/channels"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-[13px] font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to the guide
          </Link>

          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-[12px] leading-relaxed text-white/40">
            <Radio className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Live availability depends on the upstream broadcaster. If a channel stops playing,
              reload the page to request a fresh token.
            </p>
          </div>
        </div>
      </div>
    </ChannelScreen>
  )
}
