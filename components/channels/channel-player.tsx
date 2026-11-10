"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  TriangleAlert,
  Tv,
  Volume2,
  VolumeX,
} from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"

const ACCENT = "#e50914"
const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const HIDE_DELAY_MS = 2800

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
  return `${minutes}:${String(rest).padStart(2, "0")}`
}

/**
 * Cinematic player for channel titles.
 *
 * hls.js is still loaded lazily (native HLS on iOS/Safari), but playback is
 * driven by our own control layer so a movie feels like a streaming service:
 * gradient scrims, a scrubber with buffered range, skip/volume/speed/fullscreen
 * controls that fade away while watching, resume position, and keyboard keys.
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
  const shellRef = useRef<HTMLDivElement | null>(null)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const hideTimer = useRef<number | null>(null)
  const lastSaved = useRef(0)

  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [quality, setQuality] = useState("HD")

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    if (!playing || settingsOpen) return
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), HIDE_DELAY_MS)
  }, [clearHideTimer, playing, settingsOpen])

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    revealControls()
    return clearHideTimer
  }, [revealControls, clearHideTimer])

  // Close the speed menu when the pointer lands anywhere else.
  useEffect(() => {
    if (!settingsOpen) return
    const close = (event: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [settingsOpen])

  // Fullscreen can be left with Escape or the browser chrome.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  // Attach the source (including HLS) and restore the last watch position.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setError(null)
    setStarted(false)
    setPlaying(false)
    setWaiting(Boolean(src))
    setCurrent(0)
    setDuration(0)
    setBuffered(0)
    if (!src) return

    let disposed = false
    let destroying = false
    let teardown: (() => void) | null = null

    const resumeKey = `loop:watch:${src}`
    const restore = () => {
      try {
        const saved = Number(window.localStorage.getItem(resumeKey) || 0)
        if (Number.isFinite(saved) && saved > 5 && saved < video.duration - 10) {
          video.currentTime = saved
          setCurrent(saved)
        }
      } catch {
        // Private mode / storage disabled — start from the beginning.
      }
    }

    const isHls = /\.m3u8([?#]|$)/i.test(src) || src.includes(".m3u8")

    const start = async () => {
      if (!isHls) {
        video.src = src
        video.addEventListener("loadedmetadata", restore, { once: true })
        void video.play().catch(() => undefined)
        return
      }

      // Safari and iOS play HLS natively; hls.js is only needed elsewhere.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src
        video.addEventListener("loadedmetadata", restore, { once: true })
        void video.play().catch(() => undefined)
        return
      }

      try {
        const { default: Hls } = await import("hls.js")
        if (disposed) return
        if (!Hls.isSupported()) {
          setError("This browser cannot play HLS video.")
          setWaiting(false)
          return
        }

        const hls = new Hls({ enableWorker: true, lowLatencyMode: true })
        hls.attachMedia(video)
        hls.loadSource(src)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const levels = hls.levels
          const tallest = levels.reduce((max, level) => Math.max(max, level.height || 0), 0)
          if (tallest >= 2160) setQuality("4K")
          else if (tallest >= 1080) setQuality("1080p")
          else if (tallest >= 720) setQuality("HD")
          else if (tallest) setQuality("SD")
          restore()
          void video.play().catch(() => undefined)
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return
          setError(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? "This title is not responding right now."
              : "This title could not be played.",
          )
          setWaiting(false)
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
        setWaiting(false)
      }
    }

    void start()

    return () => {
      disposed = true
      video.removeEventListener("loadedmetadata", restore)
      teardown?.()
      video.removeAttribute("src")
      video.load()
    }
  }, [src])

  // The title page's hero Play button dispatches this while the browser still
  // treats the click as a user gesture, so playback is allowed to start.
  useEffect(() => {
    if (!src) return
    const onRequest = () => {
      revealControls()
      void videoRef.current?.play().catch(() => undefined)
    }
    window.addEventListener("loop:channel-play", onRequest)
    return () => window.removeEventListener("loop:channel-play", onRequest)
  }, [revealControls, src])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video || !src) return
    if (video.paused) void video.play().catch(() => undefined)
    else video.pause()
    revealControls()
  }, [revealControls, src])

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration || 0)
      setCurrent(video.currentTime)
      revealControls()
    },
    [revealControls],
  )

  const seekTo = useCallback((value: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = value
    setCurrent(value)
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }, [])

  const changeVolume = useCallback((value: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = value
    video.muted = value === 0
    setVolume(value)
    setMuted(value === 0)
  }, [])

  const changeRate = useCallback((value: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = value
    setRate(value)
    setSettingsOpen(false)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current
    if (!shell) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await shell.requestFullscreen()
    } catch {
      // Fullscreen can be blocked inside an iframe — leave the button inert.
    }
    revealControls()
  }, [revealControls])

  const togglePip = useCallback(async () => {
    const video = videoRef.current
    if (!video || !document.pictureInPictureEnabled) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await video.requestPictureInPicture()
    } catch {
      // Not available for this source/browser.
    }
  }, [])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    const key = event.key.toLowerCase()
    if (key === " " || key === "k") {
      event.preventDefault()
      togglePlay()
    } else if (key === "arrowleft" || key === "j") {
      event.preventDefault()
      seekBy(-10)
    } else if (key === "arrowright" || key === "l") {
      event.preventDefault()
      seekBy(10)
    } else if (key === "m") {
      toggleMute()
    } else if (key === "f") {
      event.preventDefault()
      void toggleFullscreen()
    }
  }

  const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0
  const bufferedPercent = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0
  const chromeVisible = controlsVisible || !playing || settingsOpen || waiting || Boolean(error)

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      role="region"
      aria-label={`${title} video player`}
      onKeyDown={onKeyDown}
      onPointerMove={revealControls}
      onMouseLeave={() => {
        if (playing) setControlsVisible(false)
      }}
      className={cn(
        "group relative aspect-video w-full select-none overflow-hidden bg-black text-white outline-none ring-1 ring-white/10",
        "rounded-2xl",
        className,
      )}
    >
      <video
        ref={videoRef}
        title={title}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
        onClick={(event) => {
          if (event.detail === 1) togglePlay()
        }}
        onDoubleClick={() => void toggleFullscreen()}
        onLoadedData={() => {
          setStarted(true)
          setWaiting(false)
        }}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          setDuration(Number.isFinite(video.duration) ? video.duration : 0)
          if (video.videoHeight >= 1080) setQuality("1080p")
          else if (video.videoHeight >= 720) setQuality("HD")
          else if (video.videoHeight) setQuality("SD")
          setVolume(video.volume)
          setMuted(video.muted)
          video.playbackRate = rate
        }}
        onPlay={() => {
          setPlaying(true)
          setWaiting(false)
          revealControls()
        }}
        onPause={() => {
          setPlaying(false)
          setControlsVisible(true)
        }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => {
          setWaiting(false)
          setStarted(true)
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget
          setCurrent(video.currentTime)
          if (video.buffered.length) {
            setBuffered(video.buffered.end(video.buffered.length - 1))
          }
          if (src && Math.abs(video.currentTime - lastSaved.current) > 4) {
            lastSaved.current = video.currentTime
            try {
              window.localStorage.setItem(`loop:watch:${src}`, String(video.currentTime))
            } catch {
              // Ignore storage failures.
            }
          }
        }}
        onEnded={() => {
          setPlaying(false)
          setControlsVisible(true)
          if (src) {
            try {
              window.localStorage.removeItem(`loop:watch:${src}`)
            } catch {
              // Ignore.
            }
          }
        }}
        onError={() => {
          if (!src) return
          setError("This video could not be loaded.")
          setWaiting(false)
        }}
      />

      {/* Cinematic vignette so the chrome always reads over bright frames. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_45%,rgba(0,0,0,0.35)_100%)]" />

      {!src && !error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/[0.03] text-white/45">
          <Tv className="h-8 w-8" />
          <p className="text-xs font-medium">Stream unavailable</p>
        </div>
      ) : null}

      {waiting && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur">
            <Loader2 className="h-7 w-7 animate-spin text-white/80" />
          </span>
        </div>
      ) : null}

      {!playing && started && !waiting && !error ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-white/25">
            <Play className="ml-1 h-9 w-9 fill-white text-white" />
          </span>
        </button>
      ) : null}

      {error ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80 px-6 text-center">
          <TriangleAlert className="h-7 w-7 text-amber-300" />
          <p className="text-sm font-semibold text-white">{error}</p>
          <p className="text-xs text-white/50">Try reloading the page or another title.</p>
        </div>
      ) : null}

      {/* Top scrim: title + quality, like a streaming player's title bar. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent px-4 pb-12 pt-4 transition-opacity duration-300 sm:px-6",
          chromeVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Now playing
            </p>
            <h2 className="mt-1 truncate text-base font-black tracking-tight text-white sm:text-xl">{title}</h2>
          </div>
          <span className="shrink-0 rounded border border-white/25 bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white/80 backdrop-blur">
            {quality}
          </span>
        </div>
      </div>

      {/* Bottom scrim + controls. */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pb-3 pt-16 transition-all duration-300 sm:px-5 sm:pb-4",
          chromeVisible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
        onMouseEnter={clearHideTimer}
        onFocus={clearHideTimer}
      >
        <div className="group/seek relative flex h-5 items-center">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 transition-all duration-150 group-hover/seek:h-2.5">
            <div className="relative h-full w-full">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                style={{ width: `${bufferedPercent}%` }}
              />
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${percent}%`, backgroundColor: ACCENT }}
              />
            </div>
          </div>
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full opacity-0 shadow-[0_0_0_4px_rgba(229,9,20,0.25)] transition-opacity group-hover/seek:opacity-100"
            style={{ left: `${percent}%`, backgroundColor: ACCENT }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label="Seek"
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>

        <div className="mt-1.5 flex items-center gap-1 text-white sm:gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15"
          >
            {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="ml-0.5 h-5 w-5 fill-white" />}
          </button>

          <button
            type="button"
            onClick={() => seekBy(-10)}
            aria-label="Back 10 seconds"
            className="hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15 sm:flex"
          >
            <RotateCcw className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => seekBy(10)}
            aria-label="Forward 10 seconds"
            className="hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15 sm:flex"
          >
            <RotateCw className="h-[18px] w-[18px]" />
          </button>

          <div className="group/volume flex items-center">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15"
            >
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              aria-label="Volume"
              className="hidden w-0 cursor-pointer accent-white transition-all duration-200 group-hover/volume:w-20 sm:block"
            />
          </div>

          <p className="ml-1 text-[11px] font-medium tabular-nums text-white/85 sm:text-xs">
            {clock(current)} <span className="text-white/45">/ {clock(duration)}</span>
          </p>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <div ref={settingsRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((open) => !open)
                  setControlsVisible(true)
                }}
                aria-label="Playback settings"
                aria-expanded={settingsOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15"
              >
                <Settings2 className="h-5 w-5" />
              </button>

              {settingsOpen ? (
                <div className="absolute bottom-full right-0 mb-2 w-48 overflow-hidden rounded-xl border border-white/15 bg-black/90 p-2 shadow-2xl backdrop-blur-xl">
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                    Playback speed
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => changeRate(speed)}
                        className={cn(
                          "rounded-lg px-2 py-1.5 text-[11px] font-semibold transition",
                          rate === speed ? "bg-white text-black" : "text-white/80 hover:bg-white/10",
                        )}
                      >
                        {speed === 1 ? "Normal" : `${speed}×`}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                    Quality
                  </p>
                  <p className="px-2 pb-1 text-[11px] text-white/75">Auto · {quality}</p>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void togglePip()}
              aria-label="Picture in picture"
              className="hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15 sm:flex"
            >
              <PictureInPicture2 className="h-[18px] w-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15"
            >
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
