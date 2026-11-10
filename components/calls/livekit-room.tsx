"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type Participant,
  type TrackPublication,
} from "livekit-client"
import { playRemoteAudio, unlockAudio } from "@/lib/audio-unlock"
import {
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  RefreshCw,
  SwitchCamera,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from "@/components/icons/lucide-compat"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  /** Re-fetch a token and try connecting again after a failure. */
  onRetry?: () => void
  /** Show a self-view tile in grid layout. Default true. */
  showSelf?: boolean
}

interface TileInfo {
  id: string
  name: string
  isLocal: boolean
  videoTrack?: TrackPublication
  audioOn: boolean
  speaking: boolean
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`
}

const QUALITY_STYLE: Record<ConnectionQuality, { bars: number; label: string; tone: string }> = {
  [ConnectionQuality.Excellent]: { bars: 3, label: "Strong connection", tone: "text-emerald-400" },
  [ConnectionQuality.Good]: { bars: 2, label: "Good connection", tone: "text-emerald-400" },
  [ConnectionQuality.Poor]: { bars: 1, label: "Poor connection", tone: "text-amber-400" },
  [ConnectionQuality.Lost]: { bars: 0, label: "Reconnecting…", tone: "text-rose-400" },
  [ConnectionQuality.Unknown]: { bars: 2, label: "Connecting…", tone: "text-white/60" },
}

function ConnectionBars({ quality }: { quality: ConnectionQuality }) {
  const { bars, label, tone } = QUALITY_STYLE[quality] ?? QUALITY_STYLE[ConnectionQuality.Unknown]
  return (
    <span className={cn("flex items-end gap-[2px]", tone)} title={label} aria-label={label}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn("w-[3px] rounded-full bg-current", n <= bars ? "opacity-100" : "opacity-25")}
          style={{ height: 4 + n * 3 }}
        />
      ))}
    </span>
  )
}

/**
 * LiveKit room — premium call surface with grid/stage layouts, a live duration
 * timer, active-speaker highlighting, connection quality and mic/cam/screen
 * controls. Rooms are implicit: any valid token + room name just works.
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
  onRetry,
  showSelf = true,
}: LivekitRoomProps) {
  const roomRef = useRef<Room | null>(null)
  const [tiles, setTiles] = useState<TileInfo[]>([])
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [quality, setQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown)
  const [connected, setConnected] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isScreenShared, setIsScreenShared] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(!audioOnly)
  const [elapsed, setElapsed] = useState(0)
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
    const speaker = room.activeSpeakers[0]?.identity ?? null
    const list: TileInfo[] = []
    const push = (p: Participant, isLocal: boolean) => {
      const video = Array.from(p.videoTrackPublications.values()).find(
        (pub) => pub.videoTrack && pub.source !== Track.Source.ScreenShare,
      )
      const screen = Array.from(p.videoTrackPublications.values()).find((pub) => pub.source === Track.Source.ScreenShare)
      const audioPub = Array.from(p.audioTrackPublications.values())[0]
      const videoPub = isLocal && screen ? screen : video
      const speaking = isLocal ? Boolean(audioPub?.isEnabled) : speaker === p.identity
      list.push({
        id: p.identity,
        name: p.name || p.identity,
        isLocal,
        videoTrack: videoPub,
        audioOn: Boolean(audioPub?.isEnabled),
        speaking,
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
    setJoinError(null)
    const join = async () => {
      try {
        const room = getRoom()
        room
          .on(RoomEvent.TrackSubscribed, (track: Track) => {
            if (track.kind === Track.Kind.Audio && track.sid) {
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
            snapshot(room, room.localParticipant)
          })
          .on(RoomEvent.ConnectionQualityChanged, (q: ConnectionQuality, participant?: Participant) => {
            if (!participant || participant.identity === room.localParticipant.identity) setQuality(q)
          })
        await room.connect(url, token, { autoSubscribe: true })
        if (cancelled) return
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

  // Live duration timer, only while connected.
  useEffect(() => {
    if (!connected) return
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [connected])

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

  const handleLeave = useCallback(() => {
    const room = roomRef.current
    if (room && room.state === "connected") void room.disconnect().catch(() => {})
    onLeave()
  }, [onLeave])

  const handleRetry = useCallback(() => {
    const room = roomRef.current
    if (room && room.state === "connected") void room.disconnect().catch(() => {})
    setJoinError(null)
    setConnected(false)
    setQuality(ConnectionQuality.Unknown)
    onRetry?.()
  }, [onRetry])

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

  const headerTitle = title || (audioOnly ? "Voice call" : "Call")
  const headerSubtitle = connected
    ? formatDuration(elapsed)
    : subtitle || `Connecting${audioOnly ? " voice" : ""} call…`

  // ── Error state ──────────────────────────────────────────────────────────
  if (joinError) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-5 overflow-hidden bg-[#07080d] p-8 text-center text-white">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-rose-600/20 blur-3xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-500/30">
          <WifiOff className="h-7 w-7 text-rose-400" />
        </div>
        <div className="relative">
          <p className="text-lg font-semibold">Couldn&apos;t join the call</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/50">{joinError}</p>
        </div>
        <div className="relative flex items-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            Leave
          </button>
        </div>
      </div>
    )
  }

  // ── Connecting state ─────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden bg-[#07080d] text-white">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
          <Avatar className="relative h-24 w-24 ring-4 ring-white/10">
            <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-3xl font-bold">
              {(title || userName).charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="relative text-center">
          <p className="text-lg font-semibold">{headerTitle}</p>
          <p className="mt-1 text-sm text-white/50">Connecting securely…</p>
        </div>
        <Spinner className="relative h-6 w-6 text-sky-400" />
      </div>
    )
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#07080d] text-white">
      {/* Ambient light */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-sky-500/[0.10] blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{headerTitle}</p>
          <p className="flex items-center gap-1.5 text-xs text-white/50">
            <span className="tabular-nums">{formatDuration(elapsed)}</span>
            <span className="opacity-40">·</span>
            <span>{remoteTiles.length + 1} {remoteTiles.length + 1 === 1 ? "person" : "people"}</span>
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-[11px] font-medium backdrop-blur">
          <ConnectionBars quality={quality} />
          <span className="hidden text-white/60 sm:inline">{QUALITY_STYLE[quality]?.label}</span>
        </span>
      </div>

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
                  ? "grid-cols-1 sm:grid-cols-2"
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

        {remoteTiles.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="rounded-full bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur">
              Waiting for others to join…
            </p>
            <span className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 px-[max(1rem,env(safe-area-inset-left))] pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] p-2 shadow-2xl shadow-black/50 backdrop-blur-xl sm:gap-3 sm:p-2.5">
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
            className="ml-1 flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 active:scale-95"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
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
    <div
      className={cn(
        "relative min-h-0 overflow-hidden rounded-2xl bg-zinc-900 transition-shadow duration-200",
        isScreen ? "border border-sky-500/60" : "border border-white/[0.06]",
        tile.speaking && !tile.isLocal && "ring-2 ring-emerald-400/70 shadow-[0_0_24px_-4px_rgba(52,211,153,0.5)]",
      )}
    >
      {hasVideo ? (
        <video ref={videoRef} autoPlay muted={muted} playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-1 ring-white/10">
            <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-xl font-bold sm:text-2xl">
              {tile.name.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute bottom-1.5 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] backdrop-blur">
        <span className={cn("h-1.5 w-1.5 rounded-full", tile.audioOn ? "bg-emerald-400" : "bg-rose-400")} />
        <span className="max-w-[9rem] truncate">{tile.isLocal ? `${tile.name} (You)` : tile.name}</span>
      </div>
      {isScreen && (
        <span className="absolute right-1.5 top-1.5 rounded bg-sky-500/90 px-1.5 py-0.5 text-[10px] font-semibold">
          Screen
        </span>
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
          <Avatar className="h-24 w-24 ring-1 ring-white/10">
            <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-3xl font-bold">
              {tile.name.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/50 px-2.5 py-1 text-xs backdrop-blur">
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
        "flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95",
        active === false ? "bg-rose-600/90 text-white" : active ? "bg-sky-500/90 text-white" : "bg-white/10 text-white hover:bg-white/15",
      )}
    >
      {children}
    </button>
  )
}
