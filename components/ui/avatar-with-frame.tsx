"use client"

import { usePfpFrame } from "@/hooks/use-pfp-frame"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { getDiceBearUrl } from "@/lib/dicebear"

interface AvatarWithFrameProps {
  avatarUrl?: string | null
  videoAvatarUrl?: string | null
  frameId?: string | number | null
  seed?: string | null
  size?: number
  className?: string
  alt?: string
  showFrame?: boolean
}

function getSizeLabel(px: number): "sm" | "md" | "lg" | "xl" {
  if (px <= 28) return "sm"
  if (px <= 40) return "md"
  if (px <= 56) return "lg"
  return "xl"
}

/**
 * Avatar that automatically shows the user's equipped PFP frame.
 * Falls back to a normal avatar if no frame is equipped.
 */
export function AvatarWithFrame({
  avatarUrl,
  videoAvatarUrl,
  frameId,
  seed,
  size = 40,
  className = "",
  alt = "",
  showFrame = true,
}: AvatarWithFrameProps) {
  const frame = usePfpFrame(showFrame ? frameId : null)
  const hasCustomFrame = frame && frame.image_url

  const padding = hasCustomFrame ? Math.max(2, size * 0.1) : 0
  const innerSize = size - padding * 2

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Avatar */}
      <div
        className="w-full h-full rounded-full overflow-hidden bg-muted"
        style={{ padding }}
      >
        {videoAvatarUrl ? (
          <VideoAvatar
            src={avatarUrl || undefined}
            videoSrc={videoAvatarUrl}
            alt={alt}
            size={getSizeLabel(innerSize)}
            className="w-full h-full"
          />
        ) : avatarUrl ? (
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(avatarUrl)}`}
            alt={alt}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <img
            src={getDiceBearUrl(seed)}
            alt=""
            className="w-full h-full object-cover rounded-full animate-[dicebear-breathe_3s_ease-in-out_infinite]"
            draggable={false}
          />
        )}
      </div>

      {/* Frame overlay — custom image */}
      {hasCustomFrame && (
        <img
          src={frame.image_url.startsWith("http") ? `/api/image-proxy?url=${encodeURIComponent(frame.image_url)}` : frame.image_url}
          alt=""
          className="absolute inset-0 pointer-events-none object-contain"
          style={{ width: size, height: size }}
          draggable={false}
        />
      )}
    </div>
  )
}
