"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Flag,
  Gift,
  Heart,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  MoreHorizontal,
  Radio,
  Send,
  Share2,
  SwitchCamera,
  UserPlus,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { ProxyImg } from "@/components/ui/proxy-img"
import { GiftPanel } from "@/components/gifting/gift-panel"
import { GiftArtwork } from "@/components/gifting/gift-art"
import {
  GiftCelebration,
  useGiftCelebration,
  type GiftSendEvent,
} from "@/components/gifting/gift-celebration"
import { HmsStreamStage, type HmsStreamStageHandle } from "@/components/streams/hms-stream-stage"
import { LivekitStreamStage } from "@/components/streams/livekit-stream-stage"
import { cn } from "@/lib/utils"
import { unlockAudio } from "@/lib/audio-unlock"
import { Spinner } from "@/components/ui/skeletons"

interface StreamGift {
  name: string
  cost: number
  rarity: string
  art?: string | null
  message?: string | null
  anonymous?: boolean
}

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
  gift?: StreamGift
}

interface FloatingHeart {
  id: string
  left: number
  emoji: string
}

const REACTIONS = ["❤️", "🔥", "😍", "👏", "😂", "✨"]
const GIFT_SOUND_KEY = "loop:live:gift-sound"

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
  const [hearts, setHearts] = useState<FloatingHeart[]>([])
  const [connectingMedia, setConnectingMedia] = useState(false)
  const [hasRemote, setHasRemote] = useState(false)
  const [hasLocalPreview, setHasLocalPreview] = useState(false)
  const [hmsToken, setHmsToken] = useState<string | null>(null)
  const [hmsError, setHmsError] = useState<string | null>(null)
  const [mediaProvider, setMediaProvider] = useState<"100ms" | "livekit" | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [giftSounds, setGiftSounds] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const stageRef = useRef<HmsStreamStageHandle | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const pendingGiftsRef = useRef<Map<string, GiftSendEvent>>(new Map())
  const peerIdRef = useRef(
    user?.id ||
      `guest-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
  )

  const {
    current: activeGift,
    queue: giftQueue,
    enqueue: enqueueGift,
    finish: finishGift,
    clear: clearGifts,
  } = useGiftCelebration()

  const streamer = useMemo(() => {
    const s = stream?.streamer
    return Array.isArray(s) ? s[0] : s
  }, [stream])

  const isOwner = Boolean(user?.id && stream?.streamer_id === user.id)
  const isLive = stream?.status === "live"
  const audioOnly = stream?.stream_type === "audio"

  useEffect(() => {
    if (user?.id) peerIdRef.current = user.id
  }, [user?.id])

  useEffect(() => {
    try {
      setGiftSounds(window.localStorage.getItem(GIFT_SOUND_KEY) === "on")
    } catch {
      /* storage can be blocked */
    }
  }, [])

  const toggleGiftSounds = useCallback(() => {
    setGiftSounds((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(GIFT_SOUND_KEY, next ? "on" : "off")
      } catch {
        /* ignore */
      }
      toast({
        title: next ? "Gift sounds on" : "Gift sounds muted",
        description: next ? "Gift effects now play a short sound." : "Gift animations stay silent.",
      })
      return next
    })
  }, [toast])

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
        } catch {
          /* chat history is optional */
        }
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

  // Follow state
  useEffect(() => {
    let cancelled = false
    if (!user?.id || !streamer?.id || streamer.id === user.id) {
      setIsFollowing(false)
      return
    }
    void (async () => {
      try {
        const res = await fetch(`/api/users/follow?target_user_id=${streamer.id}`, {
          headers: getAuthHeader(),
        })
        const data = await res.json()
        if (!cancelled && res.ok) setIsFollowing(Boolean(data.is_following))
      } catch {
        /* best-effort */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getAuthHeader, streamer?.id, user?.id])

  const toggleFollow = useCallback(async () => {
    if (!streamer?.id) return
    if (!user) {
      toast({ title: "Sign in to follow", variant: "destructive" })
      return
    }
    setFollowBusy(true)
    const next = !isFollowing
    setIsFollowing(next)
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          target_user_id: streamer.id,
          action: next ? "follow" : "unfollow",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not update follow")
      setIsFollowing(Boolean(data.is_following))
      if (data.requires_approval) {
        toast({ title: "Follow request sent", description: "This profile is private." })
      } else {
        toast({ title: next ? `Following ${streamer.display_name || streamer.username}` : "Unfollowed" })
      }
    } catch (error: any) {
      setIsFollowing(!next)
      toast({ title: "Could not update follow", description: error.message, variant: "destructive" })
    } finally {
      setFollowBusy(false)
    }
  }, [getAuthHeader, isFollowing, streamer, toast, user])

  const spawnHeart = useCallback((emoji = "❤️") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setHearts((prev) => [...prev.slice(-24), { id, left: 12 + Math.random() * 70, emoji }])
    window.setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id))
    }, 2400)
  }, [])

  const appendGiftMessage = useCallback((event: GiftSendEvent) => {
    const tipMsg: ChatMessage = {
      id: `gift-${event.key}`,
      user_id: event.sender?.username || "guest",
      username: event.sender?.username || "guest",
      display_name: event.anonymous ? "Someone" : event.sender?.display_name || event.sender?.username || "A fan",
      avatar_url: event.sender?.avatar_url || undefined,
      message: `sent ${event.name}${event.message ? ` · “${event.message}”` : ""}`,
      is_tip: true,
      tip_amount: event.cost,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      gift: {
        name: event.name,
        cost: event.cost,
        rarity: event.rarity,
        art: event.art,
        message: event.message,
        anonymous: event.anonymous,
      },
    }
    setChatMessages((prev) => [...prev.slice(-120), tipMsg])
  }, [])

  /** Optimistic: the animation and comment appear before the network resolves. */
  const handleGiftQueued = useCallback(
    (event: GiftSendEvent) => {
      pendingGiftsRef.current.set(`${event.name}|${event.cost}`, event)
      enqueueGift(event)
      appendGiftMessage(event)
    },
    [appendGiftMessage, enqueueGift],
  )

  const broadcastGift = useCallback(
    async (info: { id: string; name: string; cost: number; type: string; rarity: string; art?: string | null }) => {
      const pendingKey = `${info.name}|${info.cost}`
      const queued = pendingGiftsRef.current.get(pendingKey) || null
      pendingGiftsRef.current.delete(pendingKey)
      const event: GiftSendEvent = {
        key: queued?.key || `gift-${Date.now()}`,
        giftId: info.id,
        name: info.name,
        cost: info.cost,
        type: info.type,
        rarity: info.rarity,
        art: info.art || queued?.art,
        celebration: queued?.celebration,
        durationMs: queued?.durationMs,
        palette: queued?.palette,
        sender: queued?.sender || {
          display_name: user?.display_name,
          username: user?.username,
          avatar_url: user?.avatar_url,
        },
        message: queued?.message,
        anonymous: queued?.anonymous,
        sound: queued?.sound,
      }

      await channelRef.current?.send({
        type: "broadcast",
        event: "stream-gift",
        payload: { event },
      })

      // Persist the tip in the room's chat history.
      void fetch(`/api/streams/${streamId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          message: `sent ${info.name}`,
          is_tip: true,
          tip_amount: info.cost,
          gift_name: info.name,
          gift_rarity: info.rarity,
          gift_art: info.art || null,
          gift_message: queued?.message || null,
        }),
      }).catch(() => {})
    },
    [getAuthHeader, streamId, user?.avatar_url, user?.display_name, user?.username],
  )

  // Realtime channel + WebRTC wiring
  useEffect(() => {
    if (!streamId || loading || !stream) return

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
    )

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
        const event = payload?.event as GiftSendEvent | undefined
        if (event?.name) {
          enqueueGift({
            ...event,
            key: event.key || `gift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            optimistic: false,
          })
          appendGiftMessage({ ...event, optimistic: false })
        } else if (payload?.giftName) {
          // Legacy payloads from older clients.
          const legacy: GiftSendEvent = {
            key: `gift-${Date.now()}`,
            giftId: "legacy",
            name: payload.giftName,
            cost: Number(payload.amount || 0),
            type: "badge",
            rarity: "rare",
            sender: { display_name: payload.senderName },
          }
          enqueueGift(legacy)
          appendGiftMessage(legacy)
        }
        if (payload?.tipMsg) {
          const message = payload.tipMsg as ChatMessage
          setChatMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
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
  }, [streamId, loading, stream?.id, isOwner, user?.id, enqueueGift, appendGiftMessage, spawnHeart])

  // 100ms / LiveKit media token
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
          setHmsError(
            error?.message ||
              "Live media is unavailable — check the media provider keys (100ms or LiveKit).",
          )
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

  useEffect(() => {
    if (stream?.status === "ended" && hmsToken) {
      stageRef.current?.leave()
      setHmsToken(null)
      setHasRemote(false)
      setHasLocalPreview(false)
    }
  }, [stream?.status, hmsToken])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [chatMessages])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  useEffect(() => {
    if (!giftOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGiftOpen(false)
        setMoreOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [giftOpen])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await shellRef.current?.requestFullscreen?.()
      } else {
        await document.exitFullscreen?.()
      }
    } catch {
      toast({ title: "Fullscreen unavailable", variant: "destructive" })
    }
  }, [toast])

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

  const handleGoLive = async () => {
    if (!isOwner) return
    unlockAudio()
    setBusy(true)
    try {
      if (!hmsToken) {
        throw new Error("Live media isn't ready yet — check the media provider keys (100ms or LiveKit).")
      }
      await updateStatus("live")
      void fetch("/api/streams/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ streamId, action: "start" }),
      }).catch(() => {})
      toast({ title: "You're live", description: "Listeners can join the room now." })
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
      clearGifts()
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
    toast({ title: mediaMode === "screen" ? "Back to camera" : "Sharing screen" })
  }

  const toggleMic = () => stageRef.current?.toggleMic()
  const toggleCam = () => stageRef.current?.toggleCam()
  const flipCamera = () => {
    if (mediaMode !== "camera") return
    stageRef.current?.flipCamera()
  }

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    if (!user) {
      toast({ title: "Sign in to chat", variant: "destructive" })
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
    } catch {
      /* user cancelled */
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast({ title: "Link copied" })
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" })
    }
    setMoreOpen(false)
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#04050a] text-white">
        <Spinner className="mr-2 h-6 w-6 text-violet-400" />
        Entering the room…
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-[#04050a] px-6 text-center text-white">
        <Radio className="h-12 w-12 text-white/40" />
        <p>This live room is unavailable.</p>
        <Link href="/streams">
          <Button className="rounded-full">Back to Live</Button>
        </Link>
      </div>
    )
  }

  return (
    <div
      ref={shellRef}
      className="dark relative h-[100dvh] w-full overflow-hidden bg-[#04050a] text-white"
    >
      {/* ── Stage: full-bleed media with a cinematic grade ─────────────── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
          {mediaProvider === "livekit" ? (
            <LivekitStreamStage
              ref={stageRef}
              token={hmsToken || ""}
              url={mediaUrl || ""}
              userName={user?.display_name || user?.username || "Viewer"}
              isOwner={isOwner}
              audioOnly={audioOnly}
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
              audioOnly={audioOnly}
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
        </div>

        {/* Cinema grade: vignette + colour wash + scanline grain */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.62)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/90" />
        <div className="live-room-grain pointer-events-none absolute inset-0 opacity-[0.05]" />

        {hmsError && (
          <div className="absolute inset-x-0 top-20 z-20 mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-full border border-amber-300/25 bg-black/70 px-4 py-2 text-[11px] text-amber-200 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-300" />
            {hmsError}
          </div>
        )}

        {!isLive && !isOwner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#0b0d18] via-[#05060b] to-[#0a0712]">
            {stream.thumbnail_url ? (
              <ProxyImg
                src={stream.thumbnail_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-25 blur-[2px]"
              />
            ) : null}
            <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl">
              {audioOnly ? (
                <Mic className="h-8 w-8 text-violet-300" />
              ) : (
                <Radio className="h-8 w-8 text-violet-300" />
              )}
            </div>
            <p className="relative z-10 text-sm font-semibold text-white/80">
              {stream.status === "ended" ? "This live room has ended" : "The stage is warming up"}
            </p>
            <p className="relative z-10 max-w-xs text-center text-[11px] text-white/40">
              {stream.status === "ended"
                ? "Follow the creator to catch the next one."
                : "Stay in the room — the stream will start automatically."}
            </p>
            <Link href="/streams" className="relative z-10 mt-1 text-[11px] font-semibold text-violet-300 underline underline-offset-4">
              Browse other rooms
            </Link>
          </div>
        )}

        {isOwner && !isLive && stream.status !== "ended" && (
          <div className="absolute inset-x-0 bottom-40 z-20 flex flex-col items-center gap-3 px-4 sm:bottom-44">
            <div className="rounded-2xl border border-white/10 bg-black/55 px-5 py-3 text-center backdrop-blur-xl">
              <p className="text-sm font-semibold text-white">{stream.title}</p>
              <p className="mt-1 text-[11px] text-white/50">
                {hasLocalPreview
                  ? "Microphone ready — start when you're set."
                  : "Allow camera & mic access to start the room."}
              </p>
            </div>
            <Button
              disabled={busy}
              onClick={handleGoLive}
              className="h-12 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 text-sm font-black text-white shadow-[0_18px_50px_-18px_rgba(168,85,247,0.9)]"
            >
              {busy ? <Spinner className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
              Start live
            </Button>
          </div>
        )}

        {connectingMedia && isLive && !isOwner && !hasRemote && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Spinner className="h-8 w-8 text-violet-300" />
          </div>
        )}
      </div>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <header className="absolute inset-x-0 top-0 z-30 px-3 pb-6 pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-4">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => router.push("/streams")}
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur-xl transition hover:bg-black/55"
            aria-label="Back to live"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <Link
            href={streamer?.username ? `/profile/${streamer.username}` : "/streams"}
            className="flex min-w-0 items-center gap-2.5 rounded-full border border-white/10 bg-black/35 py-1 pl-1 pr-3 backdrop-blur-xl transition hover:bg-black/50"
          >
            <VideoAvatar
              src={streamer?.avatar_url}
              videoSrc={(streamer as any)?.video_avatar_url}
              isPremium={(streamer as any)?.is_premium}
              fallback={streamer?.display_name?.[0] || "L"}
              size="sm"
              className="h-8 w-8 rounded-full border border-white/20"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-bold leading-none text-white">
                  {streamer?.display_name || "Host"}
                </span>
                {isLive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black tracking-wider">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                    LIVE
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-white/50">
                <Eye className="h-2.5 w-2.5" />
                {viewerCount.toLocaleString()} watching
                <span className="mx-0.5">·</span>
                @{streamer?.username || "loop"}
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            {!isOwner ? (
              <button
                type="button"
                onClick={() => void toggleFollow()}
                disabled={followBusy}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition",
                  isFollowing
                    ? "border border-white/20 bg-white/10 text-white backdrop-blur-xl hover:bg-white/15"
                    : "bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-[0_10px_28px_-12px_rgba(244,63,94,0.9)] hover:brightness-110",
                )}
                aria-label={isFollowing ? "Unfollow" : "Follow"}
              >
                {isFollowing ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                <span className="hidden xs:inline">{isFollowing ? "Following" : "Follow"}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void handleShare()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur-xl transition hover:bg-black/55"
              aria-label="Share room"
            >
              <Share2 className="h-4 w-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur-xl transition hover:bg-black/55"
                aria-label="More options"
                aria-expanded={moreOpen}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {moreOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30 cursor-default"
                    aria-label="Close menu"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d16]/95 p-1 shadow-2xl backdrop-blur-2xl">
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-white/80 hover:bg-white/10"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy room link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        toggleGiftSounds()
                        setMoreOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-white/80 hover:bg-white/10"
                    >
                      {giftSounds ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                      {giftSounds ? "Gift sounds: on" : "Gift sounds: muted"}
                    </button>
                    <a
                      href="/support"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-rose-300 hover:bg-rose-500/10"
                    >
                      <Flag className="h-3.5 w-3.5" /> Report room
                    </a>
                  </div>
                </>
              ) : null}
            </div>

            {isOwner && isLive ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleEndLive}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600/90 text-white transition hover:bg-rose-600"
                aria-label="End live"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 pl-[3.25rem]">
          <p className="truncate text-[11px] font-medium text-white/55">{stream.title}</p>
          {stream.category ? (
            <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/50 sm:inline">
              {stream.category}
            </span>
          ) : null}
        </div>
      </header>

      {/* ── Comment stream (left on desktop, bottom-left on mobile) ───── */}
      <section
        className="pointer-events-none absolute bottom-[8.5rem] left-0 z-20 w-full max-w-[min(92vw,360px)] px-3 sm:bottom-[9.5rem] sm:px-4 lg:bottom-24"
        aria-label="Live chat"
      >
        <div className="pointer-events-auto max-h-[34dvh] overflow-y-auto rounded-2xl bg-gradient-to-t from-black/55 via-black/20 to-transparent px-2 py-2 [mask-image:linear-gradient(to_bottom,transparent_0%,black_14%,black_100%)] sm:max-h-[42dvh] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mb-1.5 flex items-center gap-1.5 pl-0.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10">
              <Zap className="h-2.5 w-2.5 text-white/70" />
            </span>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
              Live chat
            </p>
          </div>

          <div className="space-y-1.5">
            {chatMessages.length === 0 ? (
              <p className="rounded-xl bg-black/30 px-2.5 py-2 text-[11px] text-white/45 backdrop-blur">
                Say hello — the creator can see your messages.
              </p>
            ) : null}

            {chatMessages.slice(-50).map((msg) =>
              msg.is_tip && !msg.gift ? (
                <div
                  key={msg.id}
                  className="live-comment-in flex w-fit max-w-full items-center gap-1.5 rounded-2xl border border-amber-300/20 bg-gradient-to-r from-amber-400/12 to-transparent px-2.5 py-1.5 text-[11px] text-amber-100/90 backdrop-blur-md"
                >
                  <Gift className="h-3 w-3 shrink-0 text-amber-300" />
                  <span className="truncate">
                    <span className="font-bold text-amber-200">{msg.display_name}</span> {msg.message}
                  </span>
                </div>
              ) : msg.gift ? (
                <div
                  key={msg.id}
                  className="live-comment-in relative flex items-center gap-2 overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-r from-amber-400/15 via-rose-500/10 to-transparent px-2 py-1.5 backdrop-blur-md"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30">
                    <GiftArtwork art={msg.gift.art} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] leading-snug text-white/85">
                      <span className="font-bold text-amber-200">{msg.display_name}</span>{" "}
                      sent <span className="font-semibold text-white">{msg.gift.name}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[9px] text-white/45">
                      <Gift className="h-2.5 w-2.5" />
                      {msg.gift.cost.toLocaleString()} coins
                      {msg.gift.message ? ` · “${msg.gift.message}”` : ""}
                    </span>
                  </span>
                </div>
              ) : (
                <div
                  key={msg.id}
                  className="live-comment-in w-fit max-w-full rounded-2xl bg-black/35 px-2.5 py-1.5 text-[11px] leading-snug text-white/85 backdrop-blur-md"
                >
                  <span
                    className={cn(
                      "mr-1.5 font-bold",
                      msg.is_host ? "text-fuchsia-300" : msg.is_verified ? "text-sky-300" : "text-violet-300",
                    )}
                  >
                    {msg.display_name}
                  </span>
                  <span className="text-white/80">{msg.message}</span>
                </div>
              ),
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </section>

      {/* ── Floating reactions ────────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-32 right-3 z-20 h-64 w-20 overflow-hidden sm:bottom-36 sm:right-5">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            className="absolute animate-[liveHeart_2.3s_ease-out_forwards] text-2xl drop-shadow"
            style={{ left: `${heart.left}%`, bottom: 0 }}
          >
            {heart.emoji}
          </span>
        ))}
      </div>

      {/* ── Host media controls ───────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-[5.6rem] z-30 flex justify-center px-3 sm:bottom-[6.1rem]">
        {isOwner && isLive ? (
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 p-1.5 backdrop-blur-xl">
            <IconBtn active={micOn} onClick={toggleMic} label="Microphone">
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </IconBtn>
            {!audioOnly ? (
              <>
                <IconBtn active={camOn} onClick={toggleCam} label="Camera">
                  {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </IconBtn>
                <IconBtn onClick={flipCamera} label="Flip camera">
                  <SwitchCamera className="h-4 w-4" />
                </IconBtn>
                <IconBtn active={mediaMode === "screen"} onClick={handleScreenShare} label="Share screen">
                  <MonitorUp className="h-4 w-4" />
                </IconBtn>
              </>
            ) : null}
            <IconBtn onClick={toggleGiftSounds} label="Gift sounds" active={giftSounds}>
              {giftSounds ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </IconBtn>
          </div>
        ) : null}
      </div>

      {/* ── Bottom control bar ────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <form onSubmit={handleSendChat} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-white/10 bg-black/45 py-1 pl-3.5 pr-1 backdrop-blur-xl">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={user ? "Add to the conversation…" : "Sign in to chat"}
              disabled={!user}
              aria-label="Chat message"
              className="h-9 min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!user || !chatInput.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <button
            type="button"
            onClick={() => (user ? setGiftOpen(true) : toast({ title: "Sign in to gift", variant: "destructive" }))}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-rose-400 to-fuchsia-500 text-black shadow-[0_12px_34px_-12px_rgba(251,113,133,0.9)] transition hover:brightness-110 active:scale-95"
            aria-label="Open gift panel"
          >
            <Gift className="h-5 w-5" strokeWidth={2.4} />
            {giftQueue.length > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-black text-black">
                {giftQueue.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => void sendReaction("❤️")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-rose-400 backdrop-blur-xl transition hover:bg-white/15 active:scale-95"
            aria-label="Like"
          >
            <Heart className="h-5 w-5 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/15 sm:flex"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/15 sm:flex"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/15"
            aria-label={muted ? "Unmute stream" : "Mute stream"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        <div className="mx-auto mt-2 flex max-w-3xl items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void sendReaction(emoji)}
              className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-sm backdrop-blur transition hover:bg-white/10 active:scale-95"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-white/40 backdrop-blur">
            <Zap className="h-2.5 w-2.5 text-amber-300" />
            {isOwner ? "Host" : "Coins welcome"}
          </span>
        </div>
      </div>

      {/* ── Gift panel: right sheet on desktop, bottom sheet on mobile ── */}
      {giftOpen ? (
        <>
          <button
            type="button"
            aria-label="Close gift panel"
            onClick={() => setGiftOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Gift panel"
            className="gift-sheet fixed inset-x-0 bottom-0 z-50 flex h-[82dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#080910] shadow-[0_-30px_90px_-30px_rgba(0,0,0,0.95)] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[402px] sm:rounded-none sm:border-l sm:border-t-0"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-black tracking-tight text-white">Send a gift</p>
                <p className="text-[10px] text-white/40">
                  Full-screen effects play for everyone in the room
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGiftOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close gift panel"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <GiftPanel
                recipient={{
                  id: streamer?.id || "",
                  username: streamer?.username || "creator",
                  display_name: streamer?.display_name || "Creator",
                  avatar_url: streamer?.avatar_url,
                  video_avatar_url: (streamer as any)?.video_avatar_url,
                  is_premium: Boolean((streamer as any)?.is_premium),
                }}
                context={{ type: "stream", id: streamId, title: stream.title }}
                onGiftQueued={handleGiftQueued}
                onGiftSent={(gift) => {
                  if (!isOwner) void broadcastGift(gift)
                }}
                className="h-full"
                tone="dark"
              />
            </div>
          </aside>
        </>
      ) : null}

      {/* ── Full-screen gift celebration ─────────────────────────────── */}
      {activeGift ? (
        <GiftCelebration
          key={activeGift.key}
          event={activeGift}
          queued={giftQueue.length}
          muted={!giftSounds}
          onDone={finishGift}
        />
      ) : null}

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
        @keyframes live-comment-enter {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .live-comment-in {
          animation: live-comment-enter 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes gift-sheet-in {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .gift-sheet {
          animation: gift-sheet-in 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (min-width: 640px) {
          @keyframes gift-sheet-in {
            from {
              opacity: 0;
              transform: translateX(28px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        }
        .live-room-grain {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.9) 0px,
            rgba(255, 255, 255, 0.9) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: overlay;
        }
        @media (prefers-reduced-motion: reduce) {
          .live-comment-in,
          .gift-sheet {
            animation: none !important;
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full transition",
        active === false
          ? "bg-rose-500/90 text-white"
          : active
            ? "bg-white/20 text-white"
            : "bg-white/10 text-white/80 hover:bg-white/15",
      )}
    >
      {children}
    </button>
  )
}
