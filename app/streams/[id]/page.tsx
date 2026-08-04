"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Eye,
  Loader2,
  Radio,
  Play,
  Pause,
  Send,
  Gift,
  Crown,
  CheckCircle2,
  Sparkles,
  Pin,
  Volume2,
  VolumeX,
  Maximize2,
  ShieldCheck,
  Bell,
  MessageSquare,
  Lock,
  Flame,
  UserCheck,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

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

export default function StreamDetailPage() {
  const params = useParams<{ id: string }>()
  const streamId = params?.id
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [stream, setStream] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)

  // Live Stream Chat & Tipping State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      user_id: "system",
      username: "loop_bot",
      display_name: "Loop Studio Bot 🤖",
      message: "Welcome to the live stream chat! Keep conversations respectful and fun.",
      is_host: false,
      timestamp: "Just now",
    },
  ])
  const [chatInput, setChatInput] = useState("")
  const [pinnedMessage, setPinnedMessage] = useState<string | null>(
    "🔥 Welcome everyone! Drop your questions and tip coins to support the channel!",
  )
  const [subscribersOnlyChat, setSubscribersOnlyChat] = useState(false)
  const [recentTipAlert, setRecentTipAlert] = useState<{ sender: string; amount: number } | null>(null)

  // Gifting Modal State
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const [sendingGift, setSendingGift] = useState(false)

  // Streamer tier attributes
  const isOwner = Boolean(user?.id && stream?.streamer_id === user.id)
  const streamer = Array.isArray(stream?.streamer) ? stream.streamer[0] : stream?.streamer
  const isStreamerVerified = Boolean(streamer?.is_verified)
  const isStreamerPro = Boolean(streamer?.is_premium)

  // User tier attributes
  const isUserVerified = Boolean(user?.is_verified)
  const isUserPro = Boolean(user?.is_premium)

  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!streamId) return
    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/streams/${streamId}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Stream not found")
        const st = data.data?.stream || data.stream
        setStream(st)

        // Seed initial chat
        if (st?.streamer?.display_name) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: "host-welcome",
              user_id: st.streamer_id,
              username: st.streamer.username || "streamer",
              display_name: st.streamer.display_name,
              avatar_url: st.streamer.avatar_url,
              message: `Stream started: "${st.title}"! Thanks for tuning in.`,
              is_verified: st.streamer.is_verified,
              is_premium: st.streamer.is_premium,
              is_host: true,
              timestamp: "1m ago",
            },
          ])
        }
      } catch (error: any) {
        toast({ title: "Stream unavailable", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [streamId])

  // Auto scroll chat to bottom
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const setStatus = async (status: "live" | "ended" | "paused") => {
    if (!streamId) return
    setBusy(true)
    try {
      const response = await fetch(`/api/streams/${streamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Update failed")
      setStream(data.data?.stream || { ...stream, status })
      toast({ title: status === "live" ? "You’re live! 🔴" : `Stream ${status}` })
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  // Handle Host Sending Push Alert to Followers
  const handleSendPushToFollowers = async () => {
    if (!isOwner) return
    if (!isStreamerVerified && !isStreamerPro) {
      toast({
        title: "Creator Privilege Required",
        description: "Push broadcast to followers is available for Verified & Pro Creators.",
        variant: "destructive",
      })
      return
    }

    setBusy(true)
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          title: `🔴 ${user?.display_name || user?.username} is LIVE!`,
          message: `Join now: "${stream?.title || "Live Broadcast"}"`,
          url: `/streams/${streamId}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to trigger push broadcast")

      toast({
        title: "Push Broadcast Sent! 🚀",
        description: `Delivered alert to ${data.deliveredCount || "all active follower"} push subscriptions.`,
      })
    } catch (err: any) {
      toast({
        title: "Broadcast Failed",
        description: err.message || "Failed to send push notification.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  // Handle Sending Chat Message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    if (subscribersOnlyChat && !isUserVerified && !isUserPro && !isOwner) {
      toast({
        title: "Subscriber Chat Mode Active",
        description: "Only Verified & Pro members can chat when host enables Subscriber Mode.",
        variant: "destructive",
      })
      return
    }

    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      user_id: user?.id || "guest",
      username: user?.username || "guest",
      display_name: user?.display_name || user?.username || "Guest Viewer",
      avatar_url: user?.avatar_url,
      message: chatInput.trim(),
      is_verified: isUserVerified,
      is_premium: isUserPro,
      is_host: isOwner,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setChatMessages((prev) => [...prev, newMsg])
    setChatInput("")
  }

  // Handle Tipping Stream Coins
  const handleSendGiftCoins = async (amount: number) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to send coin tips to creators.", variant: "destructive" })
      return
    }

    setSendingGift(true)
    try {
      // Bonus earnings for Pro host (+10%)
      const netAmount = isStreamerPro ? Math.floor(amount * 1.1) : amount

      const res = await fetch("/api/gifts/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          recipient_id: streamer?.id,
          amount,
          gift_type: "stream_tip",
          metadata: { stream_id: streamId, is_pro_bonus: isStreamerPro },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gift sending failed")

      // Add Tip Message to live chat
      const tipMsg: ChatMessage = {
        id: `tip-${Date.now()}`,
        user_id: user.id,
        username: user.username || "fan",
        display_name: user.display_name || user.username || "Fan",
        avatar_url: user.avatar_url,
        message: `Tipped ${amount} Loop Coins to the stream! 🎁${isStreamerPro ? " (+10% PRO Bonus)" : ""}`,
        is_verified: isUserVerified,
        is_premium: isUserPro,
        is_tip: true,
        tip_amount: amount,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }

      setChatMessages((prev) => [...prev, tipMsg])
      setRecentTipAlert({ sender: user.display_name || user.username || "Fan", amount })
      setTimeout(() => setRecentTipAlert(null), 4000)

      setGiftModalOpen(false)
      toast({
        title: "Tip Sent! 🌟",
        description: `Successfully tipped ${amount} Loop Coins to ${streamer?.display_name || "Streamer"}.`,
      })
    } catch (err: any) {
      toast({
        title: "Tip Failed",
        description: err.message || "Could not complete coin transfer.",
        variant: "destructive",
      })
    } finally {
      setSendingGift(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-slate-400 bg-[#040814]">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-cyan-400" /> Loading Live Studio…
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-200 bg-[#040814] min-h-screen">
        <Radio className="mx-auto h-16 w-16 text-slate-600 mb-4" />
        <h3 className="text-xl font-bold mb-2">Stream Unavailable</h3>
        <p className="mb-6 text-xs text-slate-400">The requested broadcast does not exist or has been removed.</p>
        <Link href="/streams">
          <Button className="rounded-2xl bg-cyan-500 text-black font-extrabold hover:bg-cyan-400">Return to Livestreams</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#040814] text-slate-100 selection:bg-cyan-500 selection:text-black pb-12">
      {/* Top Header Navigation */}
      <div className="border-b border-white/10 bg-[#070c18]/90 px-4 sm:px-8 py-3 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/streams" className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="mr-1.5 h-4 w-4 text-cyan-400" /> Back to Live Explorer
          </Link>

          {/* User Tier Badge Display */}
          <div className="flex items-center gap-2">
            {isUserVerified && (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] font-bold">
                <CheckCircle2 className="mr-1 h-3 w-3 text-blue-400" /> Verified Member
              </Badge>
            )}
            {isUserPro && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                <Crown className="mr-1 h-3 w-3 text-amber-400" /> PRO Creator
              </Badge>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stage & Stream Info (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Live Video Canvas Card */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl group">
              <div className="relative aspect-video bg-black flex items-center justify-center">
                {stream.thumbnail_url ? (
                  <img src={stream.thumbnail_url} alt={stream.title} className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Radio className="h-20 w-20 text-cyan-400/50 animate-pulse" />
                    <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">
                      {stream.status === "live" ? "Live Stream Broadcast Active" : "Stream Offline"}
                    </p>
                  </div>
                )}

                {/* Overlaid Animated Tip Alert Header */}
                {recentTipAlert && (
                  <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top duration-300 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-6 py-2.5 text-black font-extrabold shadow-2xl flex items-center gap-2 border border-white">
                    <Gift className="h-5 w-5 animate-bounce" />
                    <span className="text-xs">
                      <strong>{recentTipAlert.sender}</strong> just tipped <strong>{recentTipAlert.amount} Coins!</strong> 🎉
                    </span>
                  </div>
                )}

                {/* Video Player Top Badges */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
                  <div className="flex items-center gap-2">
                    {stream.status === "live" ? (
                      <Badge className="bg-rose-600 text-white font-black px-3 py-1 shadow-lg shadow-rose-900/50 animate-pulse">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-white" />
                        LIVE
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-900/80 text-slate-300">
                        {stream.status}
                      </Badge>
                    )}

                    <Badge className="bg-slate-950/80 text-white border border-white/15 backdrop-blur-md">
                      <Eye className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
                      {Number(stream.viewer_count || 1).toLocaleString()} Viewers
                    </Badge>
                  </div>

                  {/* Resolution Quality Badge based on Streamer Tier */}
                  <div className="flex items-center gap-2">
                    {isStreamerPro ? (
                      <Badge className="bg-amber-500/90 text-black font-extrabold border border-amber-300 backdrop-blur-md">
                        <Crown className="mr-1 h-3 w-3" /> 4K Ultra HD
                      </Badge>
                    ) : isStreamerVerified ? (
                      <Badge className="bg-blue-600/90 text-white font-extrabold border border-blue-400 backdrop-blur-md">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> 1080p HD
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-900/80 text-slate-300 border border-white/10 backdrop-blur-md">
                        720p Standard
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Video Controls Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20 bg-slate-950/70 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="text-white hover:text-cyan-400 transition-colors"
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-white hover:text-cyan-400 transition-colors"
                    >
                      {isMuted ? <VolumeX className="h-5 w-5 text-rose-400" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                    <span className="text-xs font-mono text-slate-300">{stream.category || "Gaming"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setGiftModalOpen(true)}
                      className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs h-8 gap-1.5 shadow-lg shadow-amber-500/20"
                    >
                      <Gift className="h-4 w-4" /> Tip Streamer
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stream Meta & Streamer Info Card */}
            <div className="rounded-3xl border border-white/10 bg-[#080d1e]/90 p-5 sm:p-6 backdrop-blur-2xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-white">{stream.title}</h1>
                    {stream.category && (
                      <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-xs">
                        {stream.category}
                      </Badge>
                    )}
                  </div>
                  {stream.description && <p className="text-xs text-slate-300">{stream.description}</p>}
                </div>

                {/* Creator Profile Summary */}
                <div className="flex items-center gap-3 bg-slate-950/60 border border-white/10 p-2.5 rounded-2xl shrink-0">
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-cyan-500/40">
                      <AvatarImage src={streamer?.avatar_url} />
                      <AvatarFallback className="bg-indigo-600 font-bold">{streamer?.display_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {isStreamerVerified && (
                      <div className="absolute -bottom-1 -right-1 rounded-full bg-blue-600 text-white p-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                    )}
                    {isStreamerPro && !isStreamerVerified && (
                      <div className="absolute -bottom-1 -right-1 rounded-full bg-amber-500 text-black p-0.5">
                        <Crown className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-extrabold text-sm text-white">{streamer?.display_name || "Streamer"}</p>
                      {isStreamerVerified && <Badge className="bg-blue-600 text-white text-[9px] px-1 py-0">Verified</Badge>}
                      {isStreamerPro && <Badge className="bg-amber-500 text-black text-[9px] font-black px-1 py-0">PRO</Badge>}
                    </div>
                    <p className="text-xs text-slate-400">@{streamer?.username || "creator"}</p>
                  </div>
                </div>
              </div>

              {/* Host Control Dashboard (Visible only to stream owner) */}
              {isOwner && (
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-cyan-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">Host Broadcast Controls</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {stream.status !== "live" ? (
                        <Button
                          disabled={busy}
                          onClick={() => setStatus("live")}
                          className="rounded-xl bg-rose-600 text-white hover:bg-rose-500 text-xs font-bold h-8"
                        >
                          <Radio className="mr-1.5 h-3.5 w-3.5" /> Start Live Stream
                        </Button>
                      ) : (
                        <Button
                          disabled={busy}
                          variant="outline"
                          onClick={() => setStatus("ended")}
                          className="rounded-xl border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-500/20 text-xs h-8"
                        >
                          End Broadcast
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* Push Notification Broadcast button */}
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white flex items-center gap-1">
                          <Bell className="h-3.5 w-3.5 text-cyan-400" /> Notify Followers
                        </p>
                        <p className="text-[10px] text-slate-400">Send device push alert</p>
                      </div>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={handleSendPushToFollowers}
                        className="rounded-lg bg-cyan-500 text-black font-extrabold text-[11px] h-7 px-2.5"
                      >
                        Push Alert
                      </Button>
                    </div>

                    {/* Subscriber Only Chat Toggle */}
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white flex items-center gap-1">
                          <Lock className="h-3.5 w-3.5 text-amber-400" /> VIP Subscriber Chat
                        </p>
                        <p className="text-[10px] text-slate-400">Restrict chat to Verified/PRO</p>
                      </div>
                      <Switch
                        checked={subscribersOnlyChat}
                        onCheckedChange={(v) => {
                          setSubscribersOnlyChat(v)
                          toast({ title: v ? "Subscriber Mode Active" : "Chat Open to All Viewers" })
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Chat Panel (Right col) */}
          <div className="rounded-3xl border border-white/10 bg-[#070c18]/90 p-4 backdrop-blur-2xl flex flex-col h-[600px] shadow-xl">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-extrabold text-white">Stream Live Chat</h3>
              </div>
              {subscribersOnlyChat && (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                  VIP Mode
                </Badge>
              )}
            </div>

            {/* Pinned Announcement Message */}
            {pinnedMessage && (
              <div className="my-2 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-2.5 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Pin className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-cyan-200 leading-tight font-medium">{pinnedMessage}</p>
                </div>
              </div>
            )}

            {/* Chat Scroll Area */}
            <ScrollArea className="flex-1 py-3 pr-2 space-y-3">
              <div className="space-y-3">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-2xl p-2.5 text-xs space-y-1 transition-all ${
                      msg.is_tip
                        ? "border border-amber-500/50 bg-gradient-to-r from-amber-950/40 to-yellow-950/30 shadow-md shadow-amber-950/30"
                        : msg.is_premium
                        ? "border border-amber-500/30 bg-slate-900/90"
                        : msg.is_host
                        ? "border border-cyan-500/30 bg-cyan-950/30"
                        : "bg-slate-900/50 border border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={msg.avatar_url} />
                          <AvatarFallback className="text-[9px] bg-slate-800">{msg.display_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-slate-200 truncate">{msg.display_name}</span>
                        {msg.is_verified && <CheckCircle2 className="h-3 w-3 text-blue-400 shrink-0" />}
                        {msg.is_premium && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
                        {msg.is_host && <Badge className="bg-cyan-500 text-black text-[9px] font-black px-1 py-0">HOST</Badge>}
                      </div>
                      <span className="text-[9px] text-slate-500 shrink-0">{msg.timestamp}</span>
                    </div>

                    <p className={`text-xs ${msg.is_tip ? "font-extrabold text-amber-200" : "text-slate-300"}`}>
                      {msg.message}
                    </p>
                  </div>
                ))}
                <div ref={chatScrollRef} />
              </div>
            </ScrollArea>

            {/* Chat Input Box */}
            <form onSubmit={handleSendChat} className="pt-3 border-t border-white/10 flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={subscribersOnlyChat ? "Subscriber mode active..." : "Say something in stream chat..."}
                className="rounded-2xl border-white/10 bg-slate-950 text-xs text-white"
              />
              <Button type="submit" size="icon" className="rounded-2xl bg-cyan-500 text-black hover:bg-cyan-400 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Coin Tip Modal */}
      <Dialog open={giftModalOpen} onOpenChange={setGiftModalOpen}>
        <DialogContent className="rounded-3xl border border-amber-500/40 bg-[#080d1e] text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300 font-black">
              <Gift className="h-5 w-5 text-amber-400" /> Tip Stream Coins
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Support {streamer?.display_name || "Streamer"} with Loop Coins live during stream!
              {isStreamerPro && " (Host receives +10% PRO Coin Bonus)"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {[50, 100, 250, 500].map((coins) => (
              <Button
                key={coins}
                onClick={() => handleSendGiftCoins(coins)}
                disabled={sendingGift}
                className="rounded-2xl border border-amber-500/40 bg-amber-950/30 text-amber-200 hover:bg-amber-500/30 font-extrabold text-sm h-14 flex flex-col items-center justify-center gap-0.5"
              >
                <span>🎁 {coins} Coins</span>
                <span className="text-[10px] text-amber-400 font-mono">Tip Creator</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
