"use client"

import { createElement, useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from "react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-responsive"

/** The subset of the engine's props this app uses. */
interface LottieEngineProps {
  src: object
  autoplay?: boolean
  loop?: boolean | number
  className?: string
  lottieRef?: Ref<LottieHandle>
  subscriptions?: { ready?: () => void; complete?: () => void }
  "aria-hidden"?: boolean
  role?: string
  "aria-label"?: string
}

/** Commands the engine accepts on its imperative handle. */
export interface LottieHandle {
  play: () => void
  pause: () => void
  stop: () => void
  seek: (target: number | { frame: number } | { percent: number } | { seconds: number }) => void
  setSpeed: (speed: number | ((current: number) => number)) => void
}

/**
 * The player, loaded on the client only.
 *
 * lottie-web is a sizeable parser and nothing above the fold needs it, so it
 * arrives in its own chunk the first time an animation actually mounts. The
 * library's component is generic over the element it renders; that generality
 * is settled here, in one place, so every caller gets a plain `<div>` player.
 */
const LottieEngine = dynamic(
  () =>
    import("lottie-react").then((mod) => {
      const Engine = (props: LottieEngineProps) =>
        createElement(mod.Lottie as unknown as ComponentType<LottieEngineProps>, props)
      return { default: Engine }
    }),
  { ssr: false, loading: () => null },
)

/**
 * Motion preference, from both places the app can express it: the OS media
 * query and the in-app Accessibility toggle, which flips a class on `<html>`.
 * Watching the class means a toggle mid-session stops the animations already
 * on screen, instead of only affecting the next mount.
 */
export function useLoopReducedMotion(): boolean {
  const media = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [flagged, setFlagged] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const read = () => setFlagged(root.classList.contains("loop-reduced-motion"))
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return media || flagged
}

export interface LottieProps {
  /** The animation, as returned by `lib/lottie/animations`. */
  animation: object
  className?: string
  /** `true` forever, a number for that many repeats, `false` to play once. */
  loop?: boolean | number
  /** Accessible name. Without one the mark is treated as decoration. */
  label?: string
  /**
   * Only build and play the animation while it is on screen (with a viewport
   * of slack, so it is ready before it is looked at). Off only for marks that
   * must be mid-motion the instant they scroll in.
   */
  playInView?: boolean
}

/**
 * An animated mark.
 *
 * Sized by the caller's `className` — an animation fills the box it is given,
 * so a box with no height shows nothing.
 */
export function Lottie({ animation, className, loop = true, label, playInView = true }: LottieProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<LottieHandle | null>(null)
  const [visible, setVisible] = useState(false)
  const reduced = useLoopReducedMotion()
  const showEngine = !playInView || visible
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  // One stable subscriptions object for the life of the component: handing the
  // engine a fresh one every render would tear the handlers down and back up,
  // and a `ready` that has already fired is not announced twice.
  const subscriptions = useMemo(
    () => ({
      // With motion turned down, park on the finished frame: the mark is still
      // shown, it just is not moving.
      ready: () => {
        if (reducedRef.current) handleRef.current?.seek({ percent: 1 })
      },
    }),
    [],
  )

  // Build the animation once it is near the viewport.
  useEffect(() => {
    if (!playInView) {
      setVisible(true)
      return
    }
    const host = hostRef.current
    if (!host) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
            return
          }
        }
      },
      { rootMargin: "200px" },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [playInView])

  // Pause what is off screen: a shopping grid can hold a dozen players, and
  // paying for frames nobody is looking at is the difference between smooth
  // and janky on a phone.
  useEffect(() => {
    if (!playInView || reduced || !showEngine) return
    const host = hostRef.current
    if (!host || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) handleRef.current?.play()
          else handleRef.current?.pause()
        }
      },
      { rootMargin: "120px" },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [playInView, reduced, showEngine])

  return (
    <div
      ref={hostRef}
      className={cn("relative", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {showEngine ? (
        <LottieEngine
          src={animation}
          className="h-full w-full"
          autoplay={!reduced}
          loop={reduced ? false : loop}
          lottieRef={handleRef}
          subscriptions={subscriptions}
        />
      ) : null}
    </div>
  )
}
