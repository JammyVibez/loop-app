"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  HMSRoomProvider,
  useHMSActions,
  useHMSStore,
  useVideo,
  useAVToggle,
  selectPeers,
  selectIsConnectedToRoom,
  selectIsLocalScreenShared,
  selectPeersScreenSharing,
  selectDominantSpeaker,
} from "@100mslive/react-sdk"
import {
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export type HmsRoomLayout = "grid" | "stage"

export interface HmsRoomProps {
  /** 100ms app token minted server-side. */
  token: string
  userName: string
  /** Audio-only call — camera stays muted and cam controls are hidden. */
  audioOnly?: boolean
  layout?: HmsRoomLayout
  title?: string
  subtitle?: string
  /** Called once the user has actually joined the 100ms room. */
  onJoined?: () => void
  /** Called when the user leaves (or the room ends). */
  onLeave: () => void
  /** Show a self-view tile in grid layout. Default true. */
  showSelf?: boolean
}

export function HmsRoom(props: HmsRoomProps) {
  return (
    <HMSRoomProvider>
      <HmsRoomInner {...props} />
    </HMSRoomProvider>
  )
}

function HmsRoomInner({
  token,
  userName,
  audioOnly,
  layout = "grid",
  title,
  subtitle,
  onJoined,
  onLeave,
  showSelf = true,
}: HmsRoomProps) {
  const hmsActions = useHMSActions()
  const isConnected = useHMSStore(selectIsConnectedToRoom)
  const peers = useHMSStore(selectPeers)
  const screenShares = useHMSStore(selectPeersScreenSharing)
  const isScreenShared = useHMSStore(selectIsLocalScreenShared)
  const dominantSpeaker = useHMSStore(selectDominantSpeaker)
  const { isLocalAudioEnabled, isLocalVideoEnabled, toggleAudio, toggleVideo } = useAVToggle()

  const [joinError, setJoinError] = useState<string | null>(null)
  const [localJoined, setLocalJoined] = useState(false)
  const joinedRef = useCallback(() => {
    setLocalJoined(true)
    onJoined?.()
  }, [onJoined])

  // Join the room once we have a token.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const joined = async () => {
      try {
        await hmsActions.join({
          userName,
          authToken: token,
          settings: { isAudioMuted: false, isVideoMuted: Boolean(audioOnly) },
        })
        if (!cancelled) joinedRef()
      } catch (err: any) {
        console.error("[hms] join failed:", err)
        if (!cancelled) setJoinError(err?.message || "Could not join the call")
      }
    }
    void joined()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Leave cleanly when the component unmounts / tab closes.
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

  const handleLeave = useCallback(() => {
    void hmsActions.leave().catch(() => {})
    onLeave()
  }, [hmsActions, onLeave])

  const flipCamera = useCallback(() => {
    void hmsActions.switchCamera().catch(() => {})
  }, [hmsActions])

  const toggleScreenShare = useCallback(() => {
    void hmsActions.setScreenShareEnabled(!isScreenShared).catch((err) => {
      console.error("[hms] screen share failed:", err)
    })
  }, [hmsActions, isScreenShared])

  const remotePeers = useMemo(() => peers.filter((p) => !p.isLocal), [peers])
  const stagePeer = useMemo(() => {
    if (layout !== "stage") return null
    // Prefer whoever is sharing their screen, then the dominant speaker,
    // then any remote peer, then ourselves (host preview while waiting).
    const sharing = screenShares.find((p) => !p.isLocal)
    if (sharing) return sharing
    if (dominantSpeaker && !dominantSpeaker.isLocal) return dominantSpeaker
    return remotePeers[0] || peers.find((p) => p.isLocal)
  }, [layout, screenShares, dominantSpeaker, remotePeers, peers])

  if (joinError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white">
        <p className="text-sm text-white/80">Couldn't join the call.</p>
        <p className="max-w-sm text-xs text-white/50">{joinError}</p>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold hover:bg-rose-400"
        >
          Back
        </button>
      </div>
    )
  }

  if (!isConnected || !localJoined) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        <p className="text-sm text-white/70">Joining{audioOnly ? " voice" : ""} call…</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-white">
      {/* Video stage */}
      <div className="relative min-h-0 flex-1">
        {layout === "stage" && stagePeer ? (
          <StageView peerId={stagePeer.id} />
        ) : (
          <div
            className={cn(
              "grid h-full w-full gap-1.5 p-1.5",
              peers.length <= 1
                ? "grid-cols-1"
                : peers.length === 2
                  ? "grid-cols-2"
                  : peers.length <= 4
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3",
            )}
          >
            {peers
              .filter((p) => showSelf || !p.isLocal)
              .map((peer) => (
                <PeerTile key={peer.id} peerId={peer.id} audioOnly={Boolean(audioOnly)} />
              ))}
          </div>
        )}

        {/* Call meta */}
        {(title || subtitle) && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 text-center">
            {title && <p className="text-sm font-semibold drop-shadow">{title}</p>}
            {subtitle && <p className="text-xs text-white/70 drop-shadow">{subtitle}</p>}
          </div>
        )}

        {/* Joining indicator */}
        {remotePeers.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur">
              Waiting for others to join…
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <ControlBtn active={isLocalAudioEnabled} onClick={() => void toggleAudio?.()} label={isLocalAudioEnabled ? "Mute" : "Unmute"}>
          {isLocalAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlBtn>
        {!audioOnly && (
          <>
            <ControlBtn active={isLocalVideoEnabled} onClick={() => void toggleVideo?.()} label={isLocalVideoEnabled ? "Hide camera" : "Show camera"}>
              {isLocalVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </ControlBtn>
            <ControlBtn active={isScreenShared} onClick={toggleScreenShare} label={isScreenShared ? "Stop sharing" : "Share screen"}>
              {isScreenShared ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
            </ControlBtn>
            <ControlBtn onClick={() => void flipCamera()} label="Flip camera">
              <SwitchCamera className="h-5 w-5" />
            </ControlBtn>
          </>
        )}
        <button
          type="button"
          onClick={handleLeave}
          aria-label="Leave call"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-500"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

function StageView({ peerId }: { peerId: string }) {
  const peers = useHMSStore(selectPeers)
  const peer = peers.find((p) => p.id === peerId)
  const { videoRef } = useVideo({ trackId: peer?.videoTrack, attach: Boolean(peer) })

  if (!peer) return null
  const hasVideo = Boolean(peer.videoTrack)

  return (
    <div className="relative h-full w-full">
      <video ref={videoRef} autoPlay muted={peer.isLocal} playsInline className="h-full w-full object-cover" />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <Avatar className="h-24 w-24">
            <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-3xl font-bold">
              {peer.name?.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute bottom-2 left-3 flex items-center gap-2 rounded-full bg-black/50 px-2.5 py-1 text-xs backdrop-blur">
        <span className={cn("h-2 w-2 rounded-full", peer.audioTrack ? "bg-emerald-400" : "bg-rose-400")} />
        <span>{peer.isLocal ? `${peer.name} (You)` : peer.name}</span>
      </div>
    </div>
  )
}

function PeerTile({ peerId, audioOnly }: { peerId: string; audioOnly: boolean }) {
  const peers = useHMSStore(selectPeers)
  const peer = peers.find((p) => p.id === peerId)
  const { videoRef } = useVideo({ trackId: peer?.videoTrack, attach: Boolean(peer) })
  const isScreenShare = Boolean(peer?.auxiliaryTracks?.length)

  if (!peer) return null
  const hasVideo = Boolean(peer.videoTrack) && !audioOnly

  return (
    <div
      className={cn(
        "relative min-h-0 overflow-hidden rounded-xl bg-zinc-900",
        peer.isLocal && isScreenShare ? "border border-sky-500/60" : "",
      )}
    >
      {hasVideo ? (
        <video ref={videoRef} autoPlay muted={peer.isLocal} playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
            <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-xl font-bold sm:text-2xl">
              {peer.name?.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute bottom-1.5 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] backdrop-blur">
        <span className={cn("h-1.5 w-1.5 rounded-full", peer.audioTrack ? "bg-emerald-400" : "bg-rose-400")} />
        <span className="truncate">{peer.isLocal ? `${peer.name} (You)` : peer.name}</span>
      </div>
      {isScreenShare && (
        <span className="absolute right-1.5 top-1.5 rounded bg-sky-500/90 px-1.5 py-0.5 text-[10px] font-semibold">
          Screen
        </span>
      )}
    </div>
  )
}

function ControlBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition",
        active === false ? "bg-rose-600/90" : active ? "bg-sky-500/90" : "bg-white/10",
      )}
    >
      {children}
    </button>
  )
}
