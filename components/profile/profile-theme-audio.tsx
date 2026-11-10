"use client"

import { useEffect, useRef, useState } from "react"
import { Music2, Pause, VolumeX } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"

const TARGET_VOLUME = 0.32
/** Remembers a visitor's sound choice across profiles and reloads. */
const MUTED_STORAGE_KEY = "loop:profile-sound-muted"

function readStoredMuted() {
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function storeMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? "1" : "0")
  } catch {
    /* storage blocked — the choice still holds for this page */
  }
}

/**
 * The soundtrack that ships with a profile theme.
 *
 * Three people can silence it: the owner (who can turn the soundtrack off for
 * everyone) and any visitor (whose choice is remembered on their device, so
 * music never surprises them twice). Browsers refuse to start audio before a
 * gesture, so playback tries immediately, and otherwise waits for the first
 * tap or keypress — unless the owner disabled autoplay or the visitor muted it.
 */
export function ProfileThemeAudio({
  src,
  title,
  enabled = true,
  autoplay = true,
}: {
  src: string
  title?: string | null
  /** Owner switch: off means no soundtrack at all on this profile. */
  enabled?: boolean
  /** Owner switch: off means the track only plays when asked for. */
  autoplay?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [ready, setReady] = useState(false)

  // Read the remembered choice after mount so server and client markup match.
  useEffect(() => {
    setMuted(readStoredMuted())
    setReady(true)
  }, [])

  // The element stays alive while the visitor has sound off, so switching it
  // back on can play inside the tap gesture instead of being blocked by the
  // browser's autoplay policy.
  useEffect(() => {
    if (!ready || !enabled) return

    const audio = new Audio(src)
    audio.loop = true
    audio.preload = "auto"
    audio.volume = 0
    audioRef.current = audio

    const stopFade = () => {
      if (fadeRef.current !== null) {
        window.clearInterval(fadeRef.current)
        fadeRef.current = null
      }
    }

    const fadeIn = () => {
      stopFade()
      fadeRef.current = window.setInterval(() => {
        audio.volume = Math.min(TARGET_VOLUME, audio.volume + 0.04)
        if (audio.volume >= TARGET_VOLUME) stopFade()
      }, 150)
    }

    const removeGestures = () => {
      window.removeEventListener("pointerdown", startFromGesture)
      window.removeEventListener("keydown", startFromGesture)
    }

    const startFromGesture = () => {
      removeGestures()
      void audio
        .play()
        .then(() => {
          setPlaying(true)
          fadeIn()
        })
        .catch(() => setPlaying(false))
    }

    if (autoplay && !readStoredMuted()) {
      void audio
        .play()
        .then(() => {
          setPlaying(true)
          fadeIn()
        })
        .catch(() => {
          // Autoplay is blocked until the visitor interacts — the common case.
          window.addEventListener("pointerdown", startFromGesture, { once: true })
          window.addEventListener("keydown", startFromGesture, { once: true })
        })
    }

    return () => {
      removeGestures()
      stopFade()
      audio.pause()
      audio.src = ""
      audioRef.current = null
      setPlaying(false)
    }
  }, [src, enabled, autoplay, ready])

  const setSoundOn = (next: boolean) => {
    setMuted(!next)
    storeMuted(!next)
    if (!next) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    const audio = audioRef.current
    if (!audio) return
    audio.volume = TARGET_VOLUME
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }

  if (!enabled) {
    return (
      <div
        className="fixed bottom-20 right-3 z-40 flex h-10 items-center gap-2 rounded-full border border-white/12 bg-black/50 px-3 text-[11px] font-medium text-white/65 shadow-lg shadow-black/30 backdrop-blur-md sm:bottom-6 sm:right-6"
        role="status"
        title="The owner turned the profile soundtrack off"
      >
        <VolumeX className="h-3.5 w-3.5" />
        <span className="max-w-[11rem] truncate">Soundtrack off</span>
      </div>
    )
  }

  const toggle = () => {
    if (muted) {
      setSoundOn(true)
      return
    }
    const audio = audioRef.current
    if (!audio) {
      setSoundOn(false)
      return
    }
    if (!audio.paused) {
      setSoundOn(false)
      return
    }
    audio.volume = TARGET_VOLUME
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }

  const label = title ? `${title} — profile soundtrack` : "Profile soundtrack"

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={muted ? `Unmute ${label}` : playing ? `Mute ${label}` : `Play ${label}`}
      title={muted ? "Turn profile sound on" : playing ? "Turn profile sound off" : "Play profile soundtrack"}
      className={cn(
        "fixed bottom-20 right-3 z-40 flex h-10 items-center gap-2 rounded-full border px-3 text-[11px] font-medium shadow-lg shadow-black/30 backdrop-blur-md transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:bottom-6 sm:right-6",
        muted
          ? "border-white/12 bg-black/45 text-white/70 hover:bg-black/60"
          : "border-white/18 bg-black/60 text-white/95 hover:bg-black/75",
      )}
    >
      {muted ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : playing ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Music2 className="h-3.5 w-3.5" />
      )}
      <span className="hidden max-w-[13rem] truncate sm:inline">
        {muted ? "Sound off" : playing ? title || "Now playing" : title || "Soundtrack"}
      </span>
      {!muted && playing ? (
        <span aria-hidden="true" className="flex items-end gap-0.5">
          {[7, 12, 9].map((height, index) => (
            <span
              key={height}
              className="w-0.5 animate-pulse rounded-full bg-current"
              style={{ height, animationDelay: `${index * 160}ms` }}
            />
          ))}
        </span>
      ) : null}
    </button>
  )
}
