"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { Room, RoomEvent, Track, type LocalParticipant, type Participant, type TrackPublication } from "livekit-client"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LivekitStreamStageHandle {
  toggleMic: () => void
  toggleCam: () => void
  flipCamera: () => void
  toggleScreenShare: () => void
  leave: () => void
}

interface LivekitStreamStageProps {
  token: string
  /** LiveKit connect URL (wss://…). */
  url: string
  userName: string
  isOwner: boolean
  onMicChange?: (on: boolean) => void
  onCamChange?: (on: boolean) => void
  onRemoteAvailable?: (available: boolean) => void
  onJoined?: () => void
  onError?: (message: string) => void
  /** Mutes the remote (host) video — viewer mute toggle. */
  remoteMuted?: boolean
}

interface StageTileInfo {
  id: string
  name: string
  isLocal: boolean
  videoTrack?: TrackPublication
  audioOn: boolean
}

/**
 * LiveKit media layer used by the live room — drop-in for the 100ms stage.
 *  - Host: publishes camera/mic (mirrored self view), screen share supported.
 *  - Viewer: subscribe-only token, renders the host's video.
 */
export const LivekitStreamStage = forwardRef<LivekitStreamStageHandle, LivekitStreamStageProps>(
  function LivekitStreamStage(
    { token, url, userName, isOwner, onMicChange, onCamChange, onRemoteAvailable, onJoined, onError, remoteMuted },
    ref,
  ) {
    const roomRef = useRef<Room | null>(null)
    const [tiles, setTiles] = useState<StageTileInfo[]>([])
    const [joined, setJoined] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const snapshot = useCallback((room: Room) => {
      const local = room.localParticipant
      const list: StageTileInfo[] = []
      const push = (p: Participant, isLocal: boolean) => {
        const screen = Array.from(p.videoTrackPublications.values()).find((pub) => pub.source === Track.Source.ScreenShare)
        const video = Array.from(p.videoTrackPublications.values()).find(
          (pub) => pub.videoTrack && pub.source !== Track.Source.ScreenShare,
        )
        const audioPub = Array.from(p.audioTrackPublications.values())[0]
        list.push({
          id: p.identity,
          name: p.name || p.identity,
          isLocal,
          videoTrack: isLocal && screen ? screen : video,
          audioOn: Boolean(audioPub?.isEnabled),
        })
      }
      push(local, true)
      room.remoteParticipants.forEach((p) => push(p, false))
      setTiles(list)
    }, [])

    useEffect(() => {
      if (!token || !url) return
      let cancelled = false
      const join = async () => {
        try {
          const room = new Room({ adaptiveStream: true, dynacast: true })
          roomRef.current = room
          room
            .on(RoomEvent.TrackSubscribed, () => snapshot(room))
            .on(RoomEvent.TrackUnsubscribed, () => snapshot(room))
            .on(RoomEvent.TrackMuted, () => snapshot(room))
            .on(RoomEvent.TrackUnmuted, () => snapshot(room))
            .on(RoomEvent.ParticipantConnected, () => snapshot(room))
            .on(RoomEvent.ParticipantDisconnected, () => snapshot(room))
            .on(RoomEvent.LocalTrackPublished, () => snapshot(room))
            .on(RoomEvent.LocalTrackUnpublished, () => snapshot(room))
          await room.connect(url, token, { autoSubscribe: true })
          if (cancelled) return
          // The token decides publish permissions — hosts publish cam+mic,
          // viewers get subscribe-only tokens (their publish calls no-op).
          if (isOwner) {
            await room.localParticipant.setCameraEnabled(true).catch(() => {})
            await room.localParticipant.setMicrophoneEnabled(true).catch(() => {})
          }
          if (cancelled) return
          snapshot(room)
          setJoined(true)
          onJoined?.()
        } catch (err: any) {
          console.error("[livekit-stream] connect failed:", err)
          if (!cancelled) {
            const msg = err?.message || "Could not join the stream room"
            setError(msg)
            onError?.(msg)
          }
        }
      }
      void join()
      return () => {
        cancelled = true
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, url, isOwner])

    // Leave cleanly on unmount / tab close.
    useEffect(() => {
      const leave = () => {
        const room = roomRef.current
        if (room && room.state === "connected") void room.disconnect().catch(() => {})
      }
      window.addEventListener("beforeunload", leave)
      return () => {
        window.removeEventListener("beforeunload", leave)
        leave()
      }
    }, [])

    const localTile = useMemo(() => tiles.find((t) => t.isLocal), [tiles])
    const remoteTiles = useMemo(() => tiles.filter((t) => !t.isLocal), [tiles])
    const stageTile = useMemo(() => {
      if (!isOwner) return remoteTiles[0] || null
      return localTile || null
    }, [isOwner, remoteTiles, localTile])

    useEffect(() => {
      onRemoteAvailable?.(remoteTiles.length > 0)
    }, [remoteTiles.length, onRemoteAvailable])

    // Keep parent mic/cam state in sync.
    const local = roomRef.current?.localParticipant
    useEffect(() => {
      onMicChange?.(Boolean(local?.isMicrophoneEnabled))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [local?.isMicrophoneEnabled, onMicChange])
    useEffect(() => {
      onCamChange?.(Boolean(local?.isCameraEnabled))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [local?.isCameraEnabled, onCamChange])

    useImperativeHandle(
      ref,
      () => ({
        toggleMic: () => {
          const room = roomRef.current
          if (!room) return
          void room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled).catch(() => {})
        },
        toggleCam: () => {
          const room = roomRef.current
          if (!room) return
          void room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled).catch(() => {})
        },
        flipCamera: () => {
          const room = roomRef.current
          if (!room) return
          void (async () => {
            const devices = await Room.getLocalDevices("videoinput")
            if (devices.length < 2) return
            const currentTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
            const currentId = currentTrack?.mediaStreamTrack.getSettings().deviceId
            const next = devices.find((d) => d.deviceId !== currentId) || devices[0]
            await room.switchActiveDevice("videoinput", next.deviceId)
          })().catch(() => {})
        },
        toggleScreenShare: () => {
          const room = roomRef.current
          if (!room) return
          void room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled).catch(() => {})
        },
        leave: () => {
          const room = roomRef.current
          if (room && room.state === "connected") void room.disconnect().catch(() => {})
        },
      }),
      [],
    )

    if (error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="rounded-xl bg-black/60 px-4 py-2 text-sm text-white/80 backdrop-blur">{error}</p>
        </div>
      )
    }

    if (!joined) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
        </div>
      )
    }

    const showScreen = localTile?.videoTrack?.source === Track.Source.ScreenShare

    return (
      <StageVideo
        tile={stageTile}
        showScreen={showScreen && isOwner}
        remoteMuted={Boolean(remoteMuted)}
      />
    )
  },
)

function useVideoTrackAttach(track?: TrackPublication) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    const video = track?.videoTrack
    if (!el || !video) return
    video.attach(el)
    return () => {
      video.detach(el)
    }
  }, [track])
  return ref
}

function StageVideo({
  tile,
  showScreen,
  remoteMuted,
}: {
  tile?: StageTileInfo | null
  showScreen: boolean
  remoteMuted: boolean
}) {
  const videoRef = useVideoTrackAttach(tile?.videoTrack)
  const hasVideo = Boolean(tile?.videoTrack?.videoTrack)

  if (showScreen && tile?.videoTrack?.source === Track.Source.ScreenShare) {
    return <video ref={videoRef} autoPlay muted={tile.isLocal} playsInline className="h-full w-full object-cover" />
  }

  if (!tile) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-zinc-950 via-black to-zinc-900">
        <p className="text-sm text-white/60">Waiting for the host…</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        muted={tile.isLocal || remoteMuted}
        playsInline
        className={cn("h-full w-full bg-black object-cover transition-transform", tile.isLocal && "scale-x-[-1]")}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <span className="text-4xl">{tile.isLocal ? "🎥" : "📡"}</span>
        </div>
      )}
    </div>
  )
}
