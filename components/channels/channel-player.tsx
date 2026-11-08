"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, TriangleAlert, Tv } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * HLS player for channel streams.
 *
 * hls.js is imported lazily so it never runs during server rendering, and the
 * component degrades to the native player on iOS/Safari where HLS is built in.
 */
export function ChannelPlayer({
  src,
  title,
  poster,
  className,
}: {
  src: string | null
  title: string
  poster?: string | null
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setError(null)
    setStarted(false)
    if (!src) return

    let disposed = false
    let destroying = false
    let teardown: (() => void) | null = null

    const isHls = /\.m3u8([?#]|$)/i.test(src) || src.includes(".m3u8")

    const start = async () => {
      if (!isHls) {
        video.src = src
        void video.play().catch(() => undefined)
        return
      }

      // Safari and iOS play HLS natively; hls.js is only needed elsewhere.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src
        void video.play().catch(() => undefined)
        return
      }

      try {
        const { default: Hls } = await import("hls.js")
        if (disposed) return
        if (!Hls.isSupported()) {
          setError("This browser cannot play HLS video.")
          return
        }

        const hls = new Hls({ enableWorker: true, lowLatencyMode: true })
        hls.attachMedia(video)
        hls.loadSource(src)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => undefined)
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return
          setError(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? "This channel is not responding right now."
              : "This stream could not be played.",
          )
          if (!destroying) {
            destroying = true
            hls.destroy()
          }
        })
        teardown = () => {
          if (destroying) return
          destroying = true
          hls.destroy()
        }
      } catch {
        setError("The video player failed to load.")
      }
    }

    void start()

    return () => {
      disposed = true
      teardown?.()
      video.removeAttribute("src")
      video.load()
    }
  }, [src])

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        title={title}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full bg-black"
        onLoadedData={() => setStarted(true)}
        onPlaying={() => setStarted(true)}
      />

      {!src && !error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/45">
          <Tv className="h-7 w-7" />
          <p className="text-xs font-medium">Stream unavailable</p>
        </div>
      ) : null}

      {src && !started && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center">
          <TriangleAlert className="h-6 w-6 text-amber-300" />
          <p className="text-sm font-semibold text-white">{error}</p>
          <p className="text-xs text-white/50">Try another channel or reload the page.</p>
        </div>
      ) : null}
    </div>
  )
}
