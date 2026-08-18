"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import {
  ArrowLeft,
  Eye,
  Gift,
  Heart,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  Send,
  Share2,
  Sparkles,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GiftModal } from "@/components/gifting/gift-modal"
import { HmsStreamStage, type HmsStreamStageHandle } from "@/components/streams/hms-stream-stage"
import { LivekitStreamStage } from "@/components/streams/livekit-stream-stage"
import { cn } from "@/lib/utils"
import { unlockAudio } from "@/lib/audio-unlock"

interface ChatMessage {
  id: string
  user_id: string
  username: string
  display_name: string
  avatar_url?: string
  message: string
  is_verified?: boolean
  is_premium?: boolean
  is_host?: boolean
  is_tip?: boolean
  tip_amount?: number
  timestamp: string
}

interface FloatingHeart {
  id: string
  left: number
  emoji: string
}

interface TipAlert {
  sender: string
  amount?: number
  giftName?: string
}

const REACTIONS = ["❤️", "🔥", "😍", "👏", "😂", "✨"]

export function TikTokLiveRoom({ streamId }: { streamId: string }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [stream, setStream] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [viewerCount, setViewerCount] = useState(1)
  const [muted, setMuted] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [mediaMode, setMediaMode] = useState<"camera" | "screen">("camera")
  const [giftOpen, setGiftOpen] = useState(false)
  const [tipAlert, setTipAlert] = useState<TipAlert | null>(null)
  const [hearts, setHearts] = useState<FloatingHeart[]>([])
  const [connectingMedia, setConnectingMedia] = useState(false)
  const [hasRemote, setHasRemote] = useState(false)
  const [hasLocalPreview, setHasLocalPreview] = useState(false)
  const [hmsToken, setHmsToken] = useState<string | null>(null)
  const [hmsError, setHmsError] = useState<string | null>(null)
  const [mediaProvider, setMediaProvider] = useState<"100ms" | "livekit" | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef<any>(null)
  const stageRef = useRef<HmsStreamStageHandle | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const peerIdRef = useRef(
    user?.id || `guest-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
  )

  const streamer = useMemo(() => {
    const s = stream?.streamer
    return Array.isArray(s) ? s[0] : s
  }, [stream])

  const isOwner = Boolean(user?.id && stream?.streamer_id === user.id)
  const isLive = stream?.status === "live"

  useEffect(() => {
    if (user?.id) peerIdRef.current = user.id
  }, [user?.id])

  // Load stream + chat history
  useEffect(() => {
    if (!streamId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/streams/${streamId}`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Stream not found")
        if (cancelled) return
        setStream(data.data?.stream || data.stream)

        try {
          const chatRes = await fetch(`/api/streams/${streamId}/chat`)
          const chatData = await chatRes.json()
          if (chatData.success && Array.isArray(chatData.messages) && chatData.messages.length) {
            setChatMessages(chatData.messages)
          }
        } catch {}
      } catch (error: any) {
        toast({ title: "Stream unavailable", description: error.message, variant: "destructive" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [streamId, toast])

  const spawnHeart = useCallback((emoji = "❤️") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setHearts((prev) => [...prev.slice(-24), { id, left: 12 + Math.random() * 70, emoji }])
    window.setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id))
    }, 2400)
  }, [])

  // Realtime channel + WebRTC wiring
  useEffect(() => {
    if (!streamId || loading || !stream) return

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
    )
    supabaseRef.current = supabase

    const channel = supabase.channel(`stream:${streamId}`, {
      config: { presence: { key: peerIdRef.current } },
    })
    channelRef.current = channel

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const count = Object.keys(state).length
        setViewerCount(Math.max(1, count))
      })
      .on("broadcast", { event: "stream-chat" }, ({ payload }: any) => {
        if (!payload?.id) return
        setChatMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]))
      })
      .on("broadcast", { event: "stream-gift" }, ({ payload }: any) => {
        if (payload?.tipMsg) setChatMessages((prev) => [...prev, payload.tipMsg])
        if (payload?.senderName) {
          setTipAlert({
            sender: payload.senderName,
            amount: payload.amount,
            giftName: payload.giftName,
          })
          spawnHeart("🎁")
          window.setTimeout(() => setTipAlert(null), 3800)
        }
      })
      .on("broadcast", { event: "stream-reaction" }, ({ payload }: any) => {
        spawnHeart(payload?.emoji || "❤️")
      })
      .on("broadcast", { event: "stream-status-change" }, ({ payload }: any) => {
        if (!payload?.status) return
        setStream((prev: any) => (prev ? { ...prev, status: payload.status } : prev))
        if (payload.status === "ended") {
          toast({ title: "Live ended", description: "The host ended this livestream." })
        }
      })
      .subscribe(async (status: string) => {
        if (status !== "SUBSCRIBED") return
        await channel.track({
          user_id: user?.id || peerIdRef.current,
          username: user?.username || "guest",
          display_name: user?.display_name || user?.username || "Guest",
          avatar_url: user?.avatar_url,
          role: isOwner ? "host" : "viewer",
        })

        // Persist viewer join (best-effort)
        if (!isOwner && user) {
          void fetch(`/api/streams/${streamId}/viewers`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify({ action: "join" }),
          }).catch(() => {})
        }

      })

    return () => {
      if (!isOwner && user) {
        void fetch(`/api/streams/${streamId}/viewers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ action: "leave" }),
        }).catch(() => {})
      }
      stageRef.current?.leave()
      channel.unsubscribe()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, loading, stream?.id, isOwner, user?.id])

  // 100ms media: the host creates the room + host token; viewers fetch a
  // guest token once the stream is live. Media flows through the 100ms SFU
  // instead of the old peer-to-peer mesh (fixes screen share, camera flip
  // and large-audience quality).
  useEffect(() => {
    if (!streamId || !stream?.id) return
    if (!isOwner && stream.status !== "live") {
      setHmsToken(null)
      return
    }
    let cancelled = false
    setConnectingMedia(true)
    const load = async () => {
      try {
        const res = await fetch(`/api/streams/${streamId}/hms`, {
          method: isOwner ? "POST" : "GET",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Live media unavailable")
        if (!cancelled) {
          setHmsToken(data.data?.token || null)
          setMediaProvider((data.data?.provider as "100ms" | "livekit") || "100ms")
          setMediaUrl(data.data?.url || null)
          setHmsError(null)
        }
      } catch (error: any) {
        if (!cancelled) {
          setHmsError(error?.message || "Live media is unavailable — check the media provider keys (100ms or LiveKit).")
          setHmsToken(null)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, stream?.id, isOwner, stream?.status, getAuthHeader])

  // When the stream ends, leave the media room and clear state.
  useEffect(() => {
    if (stream?.status === "ended" && hmsToken) {
      stageRef.current?.leave()
      setHmsToken(null)
      setHasRemote(false)
      setHasLocalPreview(false)
    }
  }, [stream?.status, hmsToken])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const updateStatus = async (status: "live" | "ended" | "paused" | "preparing") => {
    const res = await fetch(`/api/streams/${streamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Failed to update stream")
    const next = data.data?.stream || { ...stream, status }
    setStream(next)
    await channelRef.current?.send({
      type: "broadcast",
      event: "stream-status-change",
      payload: { status },
    })
    return next
  }

  // Host camera preview + publishing is handled by the 100ms stage, which
  // joins as soon as the host token arrives (room created on this page).

  const handleGoLive = async () => {
    if (!isOwner) return
    unlockAudio()
    setBusy(true)
    try {
      if (!hmsToken) {
        throw new Error("Live media isn't ready yet — check the media provider keys (100ms or LiveKit).")
      }
      await updateStatus("live")
      // Notify followers with real Web Push
      void fetch("/api/streams/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ streamId, action: "start" }),
      }).catch(() => {})
      toast({ title: "You're LIVE", description: "Viewers can watch in real time." })
    } catch (error: any) {
      toast({
        title: "Could not go live",
        description: error?.message || "Allow camera & mic access, then try again.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleEndLive = async () => {
    if (!isOwner) return
    setBusy(true)
    try {
      stageRef.current?.leave()
      setHmsToken(null)
      setHasLocalPreview(false)
      await updateStatus("ended")
      toast({ title: "Live ended" })
    } catch (error: any) {
      toast({ title: "Failed to end", description: error.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleScreenShare = () => {
    if (!isOwner) return
    if (!isLive) {
      toast({
        title: "Go live first",
        description: "Screen share is available while you are LIVE.",
        variant: "destructive",
      })
      return
    }
    stageRef.current?.toggleScreenShare()
    setMediaMode((mode) => (mode === "screen" ? "camera" : "screen"))
    toast({ title: mediaMode === "screen" ? "Back to camera" : "Sharing screen", description: "Live SFU streaming" })
  }

  const toggleMic = () => {
    stageRef.current?.toggleMic()
  }

  const toggleCam = () => {
    stageRef.current?.toggleCam()
  }

  const flipCamera = () => {
    if (mediaMode !== "camera") return
    stageRef.current?.flipCamera()
  }

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    if (!user) {
      toast({ title: "Log in to chat", variant: "destructive" })
      return
    }
    const text = chatInput.trim()
    setChatInput("")
    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.id,
      username: user.username || "user",
      display_name: user.display_name || user.username || "User",
      avatar_url: user.avatar_url,
      message: text,
      is_verified: Boolean(user.is_verified),
      is_premium: Boolean(user.is_premium),
      is_host: isOwner,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    setChatMessages((prev) => [...prev, newMsg])
    await channelRef.current?.send({ type: "broadcast", event: "stream-chat", payload: newMsg })
    void fetch(`/api/streams/${streamId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ message: text }),
    }).catch(() => {})
  }

  const sendReaction = async (emoji: string) => {
    spawnHeart(emoji)
    await channelRef.current?.send({
      type: "broadcast",
      event: "stream-reaction",
      payload: { emoji, from: peerIdRef.current },
    })
  }

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    try {
      if (navigator.share) {
        await navigator.share({ title: stream?.title || "Loop Live", url })
      } else {
        await navigator.clipboard.writeText(url)
        toast({ title: "Link copied" })
      }
    } catch {}
  }

  const broadcastGift = async (giftName: string, amount?: number) => {
    if (!user || !streamer) return
    const tipMsg: ChatMessage = {
      id: `gift-${Date.now()}`,
      user_id: user.id,
      username: user.username || "fan",
      display_name: user.display_name || user.username || "Fan",
      avatar_url: user.avatar_url,
      message: `sent ${giftName}${amount ? ` (${amount} coins)` : ""} 🎁`,
      is_tip: true,
      tip_amount: amount,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    setChatMessages((prev) => [...prev, tipMsg])
    setTipAlert({ sender: tipMsg.display_name, giftName, amount })
    spawnHeart("🎁")
    window.setTimeout(() => setTipAlert(null), 3800)
    await channelRef.current?.send({
      type: "broadcast",
      event: "stream-gift",
      payload: {
        tipMsg,
        senderName: tipMsg.display_name,
        amount,
        giftName,
      },
    })
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black text-white">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-rose-500" />
        Loading live room…
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <Radio className="h-12 w-12 text-white/40" />
        <p>This livestream is unavailable.</p>
        <Link href="/streams">
          <Button className="rounded-full bg-rose-500 hover:bg-rose-400">Back to Live</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      {/* Full-bleed video stage — 100ms SFU media layer */}
      <div className="absolute inset-0">
        {mediaProvider === "livekit" ? (
          <LivekitStreamStage
            ref={stageRef}
            token={hmsToken || ""}
            url={mediaUrl || ""}
            userName={user?.display_name || user?.username || "Viewer"}
            isOwner={isOwner}
            onMicChange={setMicOn}
            onCamChange={setCamOn}
            onRemoteAvailable={setHasRemote}
            onJoined={() => {
              setConnectingMedia(false)
              if (isOwner) setHasLocalPreview(true)
            }}
            onError={(msg) => setHmsError(msg)}
            remoteMuted={muted}
          />
        ) : (
          <HmsStreamStage
            ref={stageRef}
            token={hmsToken || ""}
            userName={user?.display_name || user?.username || "Viewer"}
            isOwner={isOwner}
            onMicChange={setMicOn}
            onCamChange={setCamOn}
            onRemoteAvailable={setHasRemote}
            onJoined={() => {
              setConnectingMedia(false)
              if (isOwner) setHasLocalPreview(true)
            }}
            onError={(msg) => setHmsError(msg)}
            remoteMuted={muted}
          />
        )}
        {hmsError && (
          <div className="absolute inset-x-0 bottom-48 z-20 mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-xs text-amber-300 backdrop-blur">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
            {hmsError}
          </div>
        )}
        {!isLive && !isOwner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-950 via-black to-zinc-900">
            {stream.thumbnail_url ? (
              <img src={stream.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
            ) : null}
            <Radio className="relative z-10 h-14 w-14 text-rose-500/80" />
            <p className="relative z-10 text-sm text-white/70">
              {stream.status === "ended" ? "This live has ended" : "Waiting for host to go live…"}
            </p>
          </div>
        )}
        {isOwner && !isLive && stream.status !== "ended" && (
          <div className="absolute inset-x-0 bottom-36 z-20 flex flex-col items-center gap-3 px-4">
            <div className="rounded-2xl bg-black/55 px-4 py-3 text-center backdrop-blur">
              <p className="text-base font-semibold">{stream.title}</p>
              <p className="mt-1 text-xs text-white/70">
                {hasLocalPreview
                  ? "Camera preview ready — go live when you are"
                  : "Allow camera & mic to preview"}
              </p>
            </div>
            <Button
              disabled={busy}
              onClick={handleGoLive}
              className="h-12 rounded-full bg-rose-500 px-8 text-base font-bold hover:bg-rose-400"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radio className="mr-2 h-4 w-4" />}
              Go LIVE
            </Button>
          </div>
        )}
        {connectingMedia && isLive && !isOwner && !hasRemote && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />
      </div>

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-3 px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/streams")}
            className="rounded-full bg-black/40 p-2 backdrop-blur"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Link
            href={streamer?.username ? `/profile/${streamer.username}` : "/streams"}
            className="flex min-w-0 items-center gap-2 rounded-full bg-black/45 py-1 pl-1 pr-3 backdrop-blur"
          >
            <Avatar className="h-9 w-9 border border-white/20">
              <AvatarImage src={streamer?.avatar_url} />
              <AvatarFallback>{streamer?.display_name?.[0] || "L"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {streamer?.display_name || "Host"}
              </p>
              <p className="truncate text-[11px] text-white/70">@{streamer?.username || "loop"}</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2 py-1 text-[11px] font-black tracking-wide">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
          ) : (
            <span className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-semibold uppercase">
              {stream.status}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold backdrop-blur">
            <Eye className="h-3.5 w-3.5" />
            {viewerCount.toLocaleString()}
          </span>
          {isOwner && isLive && (
            <span className="hidden items-center gap-1 rounded-md bg-violet-500/90 px-2 py-1 text-[11px] font-bold sm:inline-flex">
              <Sparkles className="h-3 w-3" /> Live SFU
            </span>
          )}
          {mediaMode === "screen" && (
            <span className="hidden items-center gap-1 rounded-md bg-sky-500/90 px-2 py-1 text-[11px] font-bold sm:inline-flex">
              <MonitorUp className="h-3.5 w-3.5" /> Screen
            </span>
          )}
          <button type="button" onClick={handleShare} className="rounded-full bg-black/40 p-2 backdrop-blur">
            <Share2 className="h-4 w-4" />
          </button>
          {isOwner && isLive && (
            <button
              type="button"
              disabled={busy}
              onClick={handleEndLive}
              className="rounded-full bg-rose-600/90 p-2"
              aria-label="End live"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tip alert */}
      {tipAlert && (
        <div className="absolute left-1/2 top-24 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 px-4 py-2 text-sm font-bold text-black shadow-lg animate-in fade-in slide-in-from-top-2">
          <Gift className="h-4 w-4" />
          <span>
            {tipAlert.sender} sent {tipAlert.giftName || `${tipAlert.amount || ""} coins`}
          </span>
        </div>
      )}

      {/* Floating reactions */}
      <div className="pointer-events-none absolute bottom-36 right-3 z-20 h-64 w-24 overflow-hidden">
        {hearts.map((h) => (
          <span
            key={h.id}
            className="absolute animate-[liveHeart_2.3s_ease-out_forwards] text-2xl"
            style={{ left: `${h.left}%`, bottom: 0 }}
          >
            {h.emoji}
          </span>
        ))}
      </div>

      {/* Chat overlay */}
      <div className="absolute bottom-24 left-0 z-20 w-full max-w-md px-3 sm:bottom-28">
        <div className="mb-2 max-h-44 space-y-1.5 overflow-y-auto pr-10 [mask-image:linear-gradient(to_bottom,transparent,black_18%,black)]">
          <p className="text-xs font-medium text-white/80 drop-shadow">{stream.title}</p>
          {chatMessages.slice(-40).map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[92%] rounded-2xl px-2.5 py-1.5 text-[13px] leading-snug backdrop-blur-md",
                msg.is_tip
                  ? "bg-amber-400/20 text-amber-100"
                  : "bg-black/35 text-white",
              )}
            >
              <span className={cn("mr-1.5 font-semibold", msg.is_host ? "text-rose-300" : "text-sky-200")}>
                {msg.display_name}
              </span>
              <span className="text-white/95">{msg.message}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {isOwner && isLive && (
          <div className="mb-2 flex items-center justify-center gap-2">
            <IconBtn active={micOn} onClick={toggleMic} label="Mic">
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </IconBtn>
            <IconBtn active={camOn} onClick={toggleCam} label="Camera">
              {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </IconBtn>
            <IconBtn onClick={flipCamera} label="Flip">
              <SwitchCamera className="h-4 w-4" />
            </IconBtn>
            <IconBtn active={mediaMode === "screen"} onClick={handleScreenShare} label="Share screen">
              <MonitorUp className="h-4 w-4" />
            </IconBtn>
          </div>
        )}

        <form onSubmit={handleSendChat} className="flex items-center gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={user ? "Say something…" : "Log in to chat"}
            disabled={!user}
            className="h-11 flex-1 rounded-full border-white/15 bg-black/45 text-white placeholder:text-white/50 backdrop-blur"
          />
          <button
            type="submit"
            disabled={!user || !chatInput.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
          {!isOwner && (
            <button
              type="button"
              onClick={() => (user ? setGiftOpen(true) : toast({ title: "Log in to gift", variant: "destructive" }))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500"
            >
              <Gift className="h-4 w-4 text-black" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void sendReaction("❤️")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/90"
          >
            <Heart className="h-4 w-4 fill-white" />
          </button>
          {!isOwner && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
        </form>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void sendReaction(emoji)}
              className="rounded-full bg-black/35 px-2.5 py-1 text-base backdrop-blur"
            >
              {emoji}
            </button>
          ))}
          {isOwner && isLive && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80">
              <Sparkles className="h-3 w-3 text-amber-300" />
              Host controls on
            </span>
          )}
        </div>
      </div>

      {streamer && (
        <GiftModal
          open={giftOpen}
          onOpenChange={setGiftOpen}
          recipient={{
            id: streamer.id,
            username: streamer.username,
            display_name: streamer.display_name,
            avatar_url: streamer.avatar_url,
          }}
          context={{ type: "stream", id: streamId, title: stream.title }}
          onGiftSent={(info) => {
            void broadcastGift(info.name, info.cost)
          }}
        />
      )}

      <style jsx global>{`
        @keyframes liveHeart {
          0% {
            transform: translateY(0) scale(0.7);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            transform: translateY(-220px) scale(1.15);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

function IconBtn({
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
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition",
        active === false ? "bg-rose-600/80" : active ? "bg-sky-500/90" : "bg-black/45",
      )}
    >
      {children}
    </button>
  )
}
