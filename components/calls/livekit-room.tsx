"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Room, RoomEvent, Track, type LocalParticipant, type Participant, type TrackPublication } from "livekit-client"
import { playRemoteAudio, unlockAudio } from "@/lib/audio-unlock"
import {
  
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
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

export type LivekitRoomLayout = "grid" | "stage"

export interface LivekitRoomProps {
  /** LiveKit access token minted server-side. */
  token: string
  /** LiveKit connect URL (wss://…). */
  url: string
  userName: string
  /** Audio-only call — camera stays muted and cam controls are hidden. */
  audioOnly?: boolean
  layout?: LivekitRoomLayout
  title?: string
  subtitle?: string
  /** Called once the user has actually connected to the room. */
  onJoined?: () => void
  /** Called when the user leaves (or the room ends). */
  onLeave: () => void
  /** Show a self-view tile in grid layout. Default true. */
  showSelf?: boolean
}

interface TileInfo {
  id: string
  name: string
  isLocal: boolean
  videoTrack?: TrackPublication
  audioOn: boolean
}

/**
 * LiveKit fallback room — same UX as the 100ms room (grid/stage layouts,
 * mic/cam/screen-share/flip controls) but powered by the free, open-source
 * LiveKit SFU. Rooms are implicit: any valid token + room name just works.
 */
export function LivekitRoom(props: LivekitRoomProps) {
  return <LivekitRoomInner {...props} />
}

function LivekitRoomInner({
  token,
  url,
  userName,
  audioOnly,
  layout = "grid",
  title,
  subtitle,
  onJoined,
  onLeave,
  showSelf = true,
}: LivekitRoomProps) {
  const roomRef = useRef<Room | null>(null)
  const [tiles, setTiles] = useState<TileInfo[]>([])
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isScreenShared, setIsScreenShared] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(!audioOnly)
  const joinedRef = useRef(false)
  /** Remote audio elements keyed by track SID — LiveKit does NOT attach audio
   *  automatically, so without this nobody on the other end can hear anyone. */
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  const getRoom = useCallback(() => {
    if (roomRef.current) return roomRef.current
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room
    return room
  }, [])

  // Build a participant list snapshot from the room.
  const snapshot = useCallback((room: Room, local: LocalParticipant) => {
    const list: TileInfo[] = []
    const push = (p: Participant, isLocal: boolean) => {
      const video = Array.from(p.videoTrackPublications.values()).find(
        (pub) => pub.videoTrack && pub.source !== Track.Source.ScreenShare,
      )
      const screen = Array.from(p.videoTrackPublications.values()).find((pub) => pub.source === Track.Source.ScreenShare)
      const audioPub = Array.from(p.audioTrackPublications.values())[0]
      // Show the screen share as the tile's video when the local user shares.
      const videoPub = isLocal && screen ? screen : video
      list.push({
        id: p.identity,
        name: p.name || p.identity,
        isLocal,
        videoTrack: videoPub,
        audioOn: Boolean(audioPub?.isEnabled),
      })
    }
    push(local, true)
    room.remoteParticipants.forEach((p) => push(p, false))
    setTiles(list)
  }, [])

  // Unlock audio playback on the first user gesture (autoplay policy).
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      window.removeEventListener("pointerdown", unlock)
    }
    window.addEventListener("pointerdown", unlock)
    return () => window.removeEventListener("pointerdown", unlock)
  }, [])

  // Connect once a token + url are available.
  useEffect(() => {
    if (!token || !url) return
    let cancelled = false
    const join = async () => {
      try {
        const room = getRoom()
        room
          .on(RoomEvent.TrackSubscribed, (track: Track) => {
            // LiveKit delivers remote audio as raw tracks — attach each to a
            // dedicated <audio> element so the peer's voice is actually heard.
            if (track.kind === Track.Kind.Audio && track.sid) {
              // The same sid can re-subscribe (adaptive stream, mute cycles) —
              // reuse the element instead of stacking duplicate playbacks.
              let el = audioElsRef.current.get(track.sid)
              if (!el) {
                el = new Audio()
                el.autoplay = true
                audioElsRef.current.set(track.sid, el)
              }
              el.srcObject = new MediaStream([track.mediaStreamTrack])
              playRemoteAudio(el)
            }
            snapshot(room, room.localParticipant)
          })
          .on(RoomEvent.TrackUnsubscribed, (track: Track) => {
            if (track.kind === Track.Kind.Audio && track.sid) {
              const el = audioElsRef.current.get(track.sid)
              if (el) {
                el.pause()
                el.srcObject = null
                audioElsRef.current.delete(track.sid)
              }
            }
            snapshot(room, room.localParticipant)
          })
          .on(RoomEvent.TrackMuted, () => snapshot(room, room.localParticipant))
          .on(RoomEvent.TrackUnmuted, () => snapshot(room, room.localParticipant))
          .on(RoomEvent.ParticipantConnected, () => snapshot(room, room.localParticipant))
          .on(RoomEvent.ParticipantDisconnected, () => snapshot(room, room.localParticipant))
          .on(RoomEvent.LocalTrackPublished, () => snapshot(room, room.localParticipant))
          .on(RoomEvent.LocalTrackUnpublished, () => snapshot(room, room.localParticipant))
          .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            setActiveSpeakerId(speakers[0]?.identity ?? null)
          })
        await room.connect(url, token, { autoSubscribe: true })
        if (cancelled) return
        // Publish local media (token decides whether that's allowed).
        if (!audioOnly) {
          await room.localParticipant.setCameraEnabled(true).catch(() => {})
        } else {
          await room.localParticipant.setCameraEnabled(false).catch(() => {})
        }
        await room.localParticipant.setMicrophoneEnabled(true).catch(() => {})
        if (cancelled) return
        snapshot(room, room.localParticipant)
        setConnected(true)
        if (!joinedRef.current) {
          joinedRef.current = true
          onJoined?.()
        }
      } catch (err: any) {
        console.error("[livekit] connect failed:", err)
        if (!cancelled) setJoinError(err?.message || "Could not join the call")
      }
    }
    void join()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, url])

  // Leave cleanly on unmount / tab close.
  useEffect(() => {
    const leave = () => {
      const room = roomRef.current
      if (room && room.state === "connected") {
        void room.disconnect().catch(() => {})
      }
      audioElsRef.current.forEach((el) => {
        el.pause()
        el.srcObject = null
      })
      audioElsRef.current.clear()
    }
    window.addEventListener("beforeunload", leave)
    return () => {
      window.removeEventListener("beforeunload", leave)
      leave()
    }
  }, [])

  const local = roomRef.current?.localParticipant

  const handleLeave = useCallback(() => {
    const room = roomRef.current
    if (room && room.state === "connected") void room.disconnect().catch(() => {})
    onLeave()
  }, [onLeave])

  const toggleMic = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const next = !micOn
    setMicOn(next)
    void room.localParticipant.setMicrophoneEnabled(next).catch(() => {})
  }, [micOn])

  const toggleCam = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const next = !camOn
    setCamOn(next)
    void room.localParticipant.setCameraEnabled(next).catch(() => {})
  }, [camOn])

  const toggleScreenShare = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const next = !isScreenShared
    setIsScreenShared(next)
    void room.localParticipant.setScreenShareEnabled(next).catch(() => {})
  }, [isScreenShared])

  const flipCamera = useCallback(() => {
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
  }, [])

  const remoteTiles = useMemo(() => tiles.filter((t) => !t.isLocal), [tiles])
  const stageTile = useMemo(() => {
    if (layout !== "stage") return null
    if (activeSpeakerId) {
      const sp = tiles.find((t) => t.id === activeSpeakerId)
      if (sp && !sp.isLocal) return sp
    }
    return remoteTiles[0] || tiles.find((t) => t.isLocal) || null
  }, [layout, activeSpeakerId, remoteTiles, tiles])

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

  if (!connected) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white">
        <Spinner className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-white/70">Joining{audioOnly ? " voice" : ""} call…</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-white">
      {/* Video stage */}
      <div className="relative min-h-0 flex-1">
        {layout === "stage" && stageTile ? (
          <StageTile tile={stageTile} muted={stageTile.isLocal} />
        ) : (
          <div
            className={cn(
              "grid h-full w-full gap-1.5 p-1.5",
              tiles.length <= 1
                ? "grid-cols-1"
                : tiles.length === 2
                  ? "grid-cols-2"
                  : tiles.length <= 4
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3",
            )}
          >
            {tiles
              .filter((t) => showSelf || !t.isLocal)
              .map((tile) => (
                <TileView key={tile.id} tile={tile} muted={tile.isLocal} audioOnly={Boolean(audioOnly)} />
              ))}
          </div>
        )}

        {(title || subtitle) && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 text-center">
            {title && <p className="text-sm font-semibold drop-shadow">{title}</p>}
            {subtitle && <p className="text-xs text-white/70 drop-shadow">{subtitle}</p>}
          </div>
        )}

        {remoteTiles.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur">
              Waiting for others to join…
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <ControlBtn active={micOn} onClick={toggleMic} label={micOn ? "Mute" : "Unmute"}>
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlBtn>
        {!audioOnly && (
          <>
            <ControlBtn active={camOn} onClick={toggleCam} label={camOn ? "Hide camera" : "Show camera"}>
              {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </ControlBtn>
            <ControlBtn active={isScreenShared} onClick={toggleScreenShare} label={isScreenShared ? "Stop sharing" : "Share screen"}>
              {isScreenShared ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
            </ControlBtn>
            <ControlBtn onClick={flipCamera} label="Flip camera">
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

function TileView({ tile, muted, audioOnly }: { tile: TileInfo; muted: boolean; audioOnly: boolean }) {
  const videoRef = useVideoTrackAttach(tile.videoTrack)
  const hasVideo = Boolean(tile.videoTrack?.videoTrack) && !audioOnly
  const isScreen = tile.videoTrack?.source === Track.Source.ScreenShare

  return (
    <div className={cn("relative min-h-0 overflow-hidden rounded-xl bg-zinc-900", isScreen ? "border border-sky-500/60" : "")}>
      {hasVideo ? (
        <video ref={videoRef} autoPlay muted={muted} playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
            <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-xl font-bold sm:text-2xl">
              {tile.name.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute bottom-1.5 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] backdrop-blur">
        <span className={cn("h-1.5 w-1.5 rounded-full", tile.audioOn ? "bg-emerald-400" : "bg-rose-400")} />
        <span className="truncate">{tile.isLocal ? `${tile.name} (You)` : tile.name}</span>
      </div>
      {isScreen && (
        <span className="absolute right-1.5 top-1.5 rounded bg-sky-500/90 px-1.5 py-0.5 text-[10px] font-semibold">Screen</span>
      )}
    </div>
  )
}

function StageTile({ tile, muted }: { tile: TileInfo; muted: boolean }) {
  const videoRef = useVideoTrackAttach(tile.videoTrack)
  const hasVideo = Boolean(tile.videoTrack?.videoTrack)

  return (
    <div className="relative h-full w-full">
      <video ref={videoRef} autoPlay muted={muted} playsInline className="h-full w-full object-cover" />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <Avatar className="h-24 w-24">
            <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-3xl font-bold">
              {tile.name.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute bottom-2 left-3 flex items-center gap-2 rounded-full bg-black/50 px-2.5 py-1 text-xs backdrop-blur">
        <span className={cn("h-2 w-2 rounded-full", tile.audioOn ? "bg-emerald-400" : "bg-rose-400")} />
        <span>{tile.isLocal ? `${tile.name} (You)` : tile.name}</span>
      </div>
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
