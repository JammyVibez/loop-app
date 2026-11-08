"use client"

import { useEffect, useRef, useState } from "react"
import { Music2, Pause } from "lucide-react"

const TARGET_VOLUME = 0.32

/**
 * The soundtrack that ships with a purchased profile theme.
 *
 * Browsers refuse to start audio before a gesture, so this tries immediately
 * and otherwise waits for the visitor's first tap or keypress anywhere on the
 * page, then fades the track in softly rather than dropping it at full volume.
 * The pill is the manual control, and the only thing that keeps playing state.
 */
export function ProfileThemeAudio({ src, title }: { src: string; title?: string | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef<number | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
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

    void audio
      .play()
      .then(() => {
        setPlaying(true)
        fadeIn()
        removeGestures()
      })
      .catch(() => {
        // Autoplay is blocked until the visitor interacts — the common case.
        window.addEventListener("pointerdown", startFromGesture, { once: true })
        window.addEventListener("keydown", startFromGesture, { once: true })
      })

    return () => {
      removeGestures()
      stopFade()
      audio.pause()
      audio.src = ""
      audioRef.current = null
    }
  }, [src])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.volume = TARGET_VOLUME
      void audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const label = title ? `${title} — profile soundtrack` : "Profile soundtrack"

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
      title={playing ? `Pause ${label}` : `Play ${label}`}
      className="fixed bottom-20 right-3 z-40 flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 text-[11px] font-medium text-white/90 shadow-lg shadow-black/30 backdrop-blur-md transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:bottom-6 sm:right-6"
    >
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Music2 className="h-3.5 w-3.5" />}
      <span className="hidden max-w-[13rem] truncate sm:inline">
        {playing ? title || "Now playing" : title || "Soundtrack"}
      </span>
      {playing ? (
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
