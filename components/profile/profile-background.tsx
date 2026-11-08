"use client"

import { useEffect, useState } from "react"
import { isVideoProfileBackground } from "@/lib/profile-theme"

/**
 * The artwork behind a profile, painted the same way as the landing page's
 * backdrop: fixed to the viewport, cropped to cover, with a scrim on top so
 * the identity column and posts keep their contrast.
 *
 * The source can be a picture, an animated GIF or a short video. Video is
 * always muted and inline — it is decoration, never a soundtrack — and it
 * holds its first frame when the visitor asks for reduced motion. The
 * `data-profile-background-*` hooks stay stable so theme CSS keeps working.
 */
export function ProfileBackground({ url }: { url: string }) {
  const isVideo = isVideoProfileBackground(url)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    if (!isVideo || typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(query.matches)
    sync()
    query.addEventListener?.("change", sync)
    return () => query.removeEventListener?.("change", sync)
  }, [isVideo])

  return (
    <div
      aria-hidden="true"
      data-profile-background=""
      data-profile-background-kind={isVideo ? "video" : "image"}
      className="loop-profile-background pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div data-profile-background-image="" className="absolute inset-0 bg-cover bg-top bg-no-repeat">
        {isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={url}
            src={url}
            autoPlay={!reduceMotion}
            loop
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            tabIndex={-1}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            draggable={false}
            className="h-full w-full object-cover object-top"
          />
        )}
      </div>
      {/* Only enough smoke for contrast: the artwork is the point of the
          theme, so the panels below keep it visible rather than hiding it
          behind an opaque page background. */}
      <div
        data-profile-background-scrim=""
        className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background/85"
      />
    </div>
  )
}
