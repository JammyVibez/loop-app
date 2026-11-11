"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react"
import {
  HMSRoomProvider,
  useHMSActions,
  useHMSStore,
  useVideo,
  selectPeers,
  selectIsConnectedToRoom,
  selectIsLocalScreenShared,
  selectIsLocalAudioEnabled,
  selectIsLocalVideoEnabled,
  selectDominantSpeaker,
} from "@100mslive/react-sdk"
import { Mic } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"
import { unlockAudio } from "@/lib/audio-unlock"
import { Spinner } from "@/components/ui/skeletons"

export interface HmsStreamStageHandle {
  toggleMic: () => void
  toggleCam: () => void
  flipCamera: () => void
  toggleScreenShare: () => void
  leave: () => void
}

interface HmsStreamStageProps {
  token: string
  userName: string
  isOwner: boolean
  audioOnly?: boolean
  /** Called with the current mic-on state whenever it changes. */
  onMicChange?: (on: boolean) => void
  /** Called with the current cam-on state whenever it changes. */
  onCamChange?: (on: boolean) => void
  /** Called with true while a remote peer's video is visible. */
  onRemoteAvailable?: (available: boolean) => void
  /** Called once connected to the 100ms room. */
  onJoined?: () => void
  onError?: (message: string) => void
  /** Mutes the remote (host) video — viewer mute toggle. */
  remoteMuted?: boolean
}

/**
 * Full-bleed 100ms media layer used by the live room.
 *  - Host: renders their own camera (mirrored) or screen share.
 *  - Viewer: renders the host's video (dominant/first remote peer).
 */
export const HmsStreamStage = forwardRef<HmsStreamStageHandle, HmsStreamStageProps>(
  function HmsStreamStage(props, ref) {
    return (
      <HMSRoomProvider>
        <HmsStreamStageInner ref={ref} {...props} />
      </HMSRoomProvider>
    )
  },
)

const HmsStreamStageInner = forwardRef<HmsStreamStageHandle, HmsStreamStageProps>(
  function HmsStreamStageInner(
    { token, userName, isOwner, audioOnly = false, onMicChange, onCamChange, onRemoteAvailable, onJoined, onError, remoteMuted },
    ref,
  ) {
    const hmsActions = useHMSActions()
    const isConnected = useHMSStore(selectIsConnectedToRoom)
    const peers = useHMSStore(selectPeers)
    const isScreenShared = useHMSStore(selectIsLocalScreenShared)
    const localAudioEnabled = useHMSStore(selectIsLocalAudioEnabled)
    const localVideoEnabled = useHMSStore(selectIsLocalVideoEnabled)
    const dominantSpeaker = useHMSStore(selectDominantSpeaker)
    const [joined, setJoined] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Join the room once a token arrives.
    useEffect(() => {
      if (!token) return
      let cancelled = false
      const join = async () => {
        try {
          await hmsActions.join({ userName, authToken: token })
          if (isOwner && audioOnly) await hmsActions.setLocalVideoEnabled(false).catch(() => {})
          if (!cancelled) {
            setJoined(true)
            onJoined?.()
          }
        } catch (err: any) {
          console.error("[hms-stream] join failed:", err)
          if (!cancelled) {
            setError(err?.message || "Could not join the stream room")
            onError?.(err?.message || "Could not join the stream room")
          }
        }
      }
      void join()
      return () => {
        cancelled = true
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    // Unlock audio playback on the first user gesture (autoplay policy).
    useEffect(() => {
      const unlock = () => {
        unlockAudio()
        window.removeEventListener("pointerdown", unlock)
      }
      window.addEventListener("pointerdown", unlock)
      return () => window.removeEventListener("pointerdown", unlock)
    }, [])

    // Leave cleanly on unmount / tab close.
    useEffect(() => {
      const leave = () => {
        void hmsActions.leave().catch(() => {})
      }
      window.addEventListener("beforeunload", leave)
      return () => {
        window.removeEventListener("beforeunload", leave)
        leave()
      }
    }, [hmsActions])

    useImperativeHandle(
      ref,
      () => ({
        toggleMic: () => {
          void hmsActions.setLocalAudioEnabled(!localAudioEnabled).catch(() => {})
        },
        toggleCam: () => {
          void hmsActions.setLocalVideoEnabled(!localVideoEnabled).catch(() => {})
        },
        flipCamera: () => {
          void hmsActions.switchCamera().catch(() => {})
        },
        toggleScreenShare: () => {
          void hmsActions.setScreenShareEnabled(!isScreenShared).catch(() => {})
        },
        leave: () => {
          void hmsActions.leave().catch(() => {})
        },
      }),
      [hmsActions, localAudioEnabled, localVideoEnabled, isScreenShared],
    )

    // Report local media state to the parent (room controls stay in sync).
    useEffect(() => {
      onMicChange?.(localAudioEnabled)
    }, [localAudioEnabled, onMicChange])
    useEffect(() => {
      onCamChange?.(localVideoEnabled)
    }, [localVideoEnabled, onCamChange])

    const remotePeers = useMemo(() => peers.filter((p) => !p.isLocal), [peers])
    const localPeer = useMemo(() => peers.find((p) => p.isLocal), [peers])
    const stagePeer = useMemo(() => {
      if (!isOwner) {
        // Viewers watch the host — prefer the dominant speaker, else first remote.
        if (dominantSpeaker && !dominantSpeaker.isLocal) return dominantSpeaker
        return remotePeers[0] || null
      }
      // Hosts see themselves; if screen sharing, the screen tile is what matters.
      return localPeer || null
    }, [isOwner, dominantSpeaker, remotePeers, localPeer])

    // Report whether a remote stream is visible.
    useEffect(() => {
      onRemoteAvailable?.(remotePeers.length > 0)
    }, [remotePeers.length, onRemoteAvailable])

    const showScreenShare = isOwner && isScreenShared

    if (error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <p className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground backdrop-blur">{error}</p>
        </div>
      )
    }

    if (!isConnected || !joined) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      )
    }

    return (
      <StageVideo
        peerId={stagePeer?.id}
        showSelf={isOwner}
        showScreen={showScreenShare && !audioOnly}
        screenPeerId={localPeer?.id}
        audioOnly={audioOnly}
        remoteMuted={Boolean(remoteMuted)}
      />
    )
  },
)

function StageVideo({
  peerId,
  showSelf,
  showScreen,
  screenPeerId,
  audioOnly,
  remoteMuted,
}: {
  peerId?: string
  showSelf: boolean
  showScreen: boolean
  screenPeerId?: string
  audioOnly: boolean
  remoteMuted: boolean
}) {
  const peers = useHMSStore(selectPeers)
  const peer = peers.find((p) => p.id === peerId)
  const { videoRef } = useVideo({ trackId: peer?.videoTrack, attach: Boolean(peer) })
  const screenShare = peers.find((p) => p.id === screenPeerId && p.auxiliaryTracks?.length)
  const { videoRef: screenRef } = useVideo({ trackId: screenShare?.auxiliaryTracks?.[0], attach: Boolean(showScreen) })

  const hasVideo = Boolean(peer?.videoTrack)

  if (audioOnly) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-muted via-background to-card text-foreground">
        <Mic className="h-16 w-16 text-primary/80" />
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Audio room</p>
          <p className="mt-1 text-sm text-muted-foreground">Listen live, chat and send gifts</p>
        </div>
      </div>
    )
  }

  if (showScreen && screenShare) {
    return <video ref={screenRef} autoPlay muted={screenShare.isLocal} playsInline className="h-full w-full object-cover" />
  }

  if (!peer) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">Waiting for the host…</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        muted={peer.isLocal || remoteMuted}
        playsInline
        className={cn("h-full w-full bg-black object-cover transition-transform", peer.isLocal && showSelf && "scale-x-[-1]")}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <span className="text-4xl">{peer.isLocal ? "🎥" : "📡"}</span>
        </div>
      )}
    </div>
  )
}
