"use client"

import { useState, useEffect, use, useRef, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Radio, Users, Send, ArrowLeft, Mic, MicOff, Video, VideoOff, Gift, MessageSquare, RefreshCw, Crown, UserX, Shield, Square, Trash2, Volume2, VolumeX, Lock, ShieldCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { GiftModal } from "@/components/gifting/gift-modal"
import { getEventStatus, formatEventTime, getEventStatusBadge } from "@/lib/events"
import { useLiveEventTimer } from "@/hooks/use-events-state"

interface EventItem {
  id: string
  title: string
  description: string
  host_id: string
  host_name: string
  host_avatar: string
  category: string
  status: string
  start_time: string
  cover_image?: string
  participants_count: number
  is_live: boolean
  allow_type?: string
}

interface Participant {
  id: string
  user_id: string
  username: string
  display_name: string
  avatar_url: string
  role: string
  joined_at: string
  is_muted?: boolean
}

interface ChatMessage {
  id: string
  sender: string
  avatar: string
  text: string
  timestamp: string
  user_id?: string
  is_deleted?: boolean
}

const ALLOW_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  everyone: { label: "Open to everyone", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  pro: { label: "🔒 Pro members only", className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  verified: { label: "✔ Verified accounts only", className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  organization: { label: "🏢 Organizations only", className: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400" },
}

export default function SingleEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const { toast } = useToast()
  const { checkStatus } = useLiveEventTimer(15000)

  const [event, setEvent] = useState<EventItem | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joinedStage, setJoinedStage] = useState(false)
  const [micMuted, setMicMuted] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [endingEvent, setEndingEvent] = useState(false)
  const [mutingAll, setMutingAll] = useState(false)
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const [giftRecipient, setGiftRecipient] = useState<{ id: string; username: string; display_name: string; avatar_url?: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const isHostOrAdmin = user && (user.id === event?.host_id || user.is_admin)
  const myParticipant = participants.find((p) => p.user_id === user?.id)
  const isMod = Boolean(isHostOrAdmin || myParticipant?.role === "moderator")
  const amMuted = Boolean(myParticipant?.is_muted)
  const allowCfg = event ? ALLOW_TYPE_LABELS[event.allow_type || "everyone"] : null

  useEffect(() => {
    if (joinedStage && videoEnabled) {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: !micMuted })
        .then((stream) => {
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch((err) => {
          console.warn("Media devices error or permission denied:", err)
          toast({ title: "Camera Error", description: "Could not access video camera feed.", variant: "destructive" })
          setVideoEnabled(false)
        })
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [joinedStage, videoEnabled, micMuted])

  const handleEndEvent = async () => {
    if (!confirm("Are you sure you want to end this live event for everyone?")) return
    setEndingEvent(true)
    try {
      const token = user?.access_token
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "end_event" }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: "Event Ended 🔴", description: "The live broadcast event has been ended." })
        setEvent((prev) => prev ? { ...prev, status: "ended", is_live: false } : null)
      } else {
        toast({ title: "Failed to end event", description: data.error || "Something went wrong", variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to end event", variant: "destructive" })
    } finally {
      setEndingEvent(false)
    }
  }

  const handleMuteAll = async (mute: boolean) => {
    if (!isMod) return
    setMutingAll(true)
    try {
      const token = user?.access_token
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: mute ? "mute_all" : "unmute_all" }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: mute ? "Stage muted" : "Stage unmuted", description: data.message })
        setParticipants((prev) => prev.map((p) => (mute ? { ...p, is_muted: true } : { ...p, is_muted: false })))
      } else {
        toast({ title: "Action failed", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Moderation command failed", variant: "destructive" })
    } finally {
      setMutingAll(false)
    }
  }

  const mapEventMessage = useCallback((row: any): ChatMessage => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author
    return {
      id: row.id,
      sender: author?.display_name || author?.username || "Member",
      avatar: author?.avatar_url || "/placeholder.svg",
      text: row.content,
      timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      user_id: row.user_id,
      is_deleted: Boolean(row.is_deleted),
    }
  }, [])

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}/messages`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setChatMessages((data.messages || []).map(mapEventMessage))
      }
    } catch (err) {
      console.error("Error loading event chat:", err)
    }
  }, [id, mapEventMessage])

  useEffect(() => {
    fetchEventDetails(true)
    loadMessages()

    // Supabase Real-Time Subscriptions for Event Room
    const channel = supabase
      .channel(`event_room_${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_participants", filter: `event_id=eq.${id}` },
        () => {
          fetchEventDetails(false)
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${id}` },
        (payload) => {
          setEvent(payload.new as EventItem)
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_messages", filter: `event_id=eq.${id}` },
        () => {
          loadMessages()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_mutes", filter: `event_id=eq.${id}` },
        () => {
          fetchEventDetails(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, user])

  const fetchEventDetails = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch(`/api/events/${id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setEvent(data.event)
          setParticipants(data.participants || [])
          if (user && data.participants?.some((p: Participant) => p.user_id === user.id)) {
            setJoinedStage(true)
          } else if (user) {
            setJoinedStage(false)
          }
        }
      }
    } catch (err) {
      console.error("Error loading event:", err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const toggleStageParticipation = async () => {
    if (!user) {
      toast({ title: "Auth Required", description: "Please sign in to join the stage", variant: "destructive" })
      return
    }

    const action = joinedStage ? "leave" : "join"
    try {
      const token = user.access_token
      const res = await fetch(`/api/events/${id}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setJoinedStage(!joinedStage)
        fetchEventDetails()
        toast({
          title: joinedStage ? "Left Stage" : "Joined Stage! 🎤",
          description: data.message,
        })
      } else {
        toast({
          title: "Could not join",
          description: data.error || "Something went wrong",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({ title: "Error", description: "Could not update stage status", variant: "destructive" })
    }
  }

  const handleAdminKick = async (targetUserId: string, targetName: string) => {
    try {
      const token = user?.access_token
      const res = await fetch(`/api/events/${id}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "kick", target_user_id: targetUserId }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: "Admin Action", description: `Removed ${targetName} from the stage.` })
        fetchEventDetails()
      } else {
        toast({ title: "Action Failed", description: data.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Admin command failed", variant: "destructive" })
    }
  }

  const handleAdminUpdateRole = async (targetUserId: string, newRole: string, targetName: string) => {
    try {
      const token = user?.access_token
      const res = await fetch(`/api/events/${id}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "update_role", target_user_id: targetUserId, role: newRole }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: "Role Updated", description: `Set ${targetName} as ${newRole}.` })
        fetchEventDetails()
      } else {
        toast({ title: "Action Failed", description: data.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Role update failed", variant: "destructive" })
    }
  }

  const handleMuteParticipant = async (targetUserId: string, targetName: string, mute: boolean) => {
    try {
      const token = user?.access_token
      const res = await fetch(`/api/events/${id}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: mute ? "mute" : "unmute", target_user_id: targetUserId }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: mute ? "Muted" : "Unmuted", description: `${targetName} is ${mute ? "muted" : "unmuted"} on stage.` })
        setParticipants((prev) =>
          prev.map((p) => (p.user_id === targetUserId ? { ...p, is_muted: mute } : p)),
        )
      } else {
        toast({ title: "Action Failed", description: data.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Mute command failed", variant: "destructive" })
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!isMod && messageId !== myParticipant?.id) return
    try {
      const token = user?.access_token
      const res = await fetch(`/api/events/${id}/messages?message_id=${messageId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setChatMessages((prev) => prev.filter((m) => m.id !== messageId))
        toast({ title: "Message deleted" })
      } else {
        toast({ title: "Delete failed", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Could not delete message", variant: "destructive" })
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputText.trim()
    if (!text || sendingMessage) return

    if (!user) {
      toast({ title: "Sign in to chat", variant: "destructive" })
      return
    }

    if (amMuted) {
      toast({ title: "You're muted", description: "A moderator muted you in this event chat.", variant: "destructive" })
      return
    }

    setSendingMessage(true)
    setInputText("")

    // Optimistic bubble, replaced by the real one once the Realtime INSERT
    // event round-trips (same pattern as circle room chat).
    const optimisticId = `pending-${Date.now()}`
    setChatMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        sender: user.display_name || user.user_metadata?.display_name || "You",
        avatar: user.avatar_url || user.user_metadata?.avatar_url || "/placeholder.svg",
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ])

    try {
      const token = user.access_token
      const res = await fetch(`/api/events/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to send message")
      }
      await loadMessages()
    } catch (err: any) {
      setChatMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      toast({ title: "Message not sent", description: err.message, variant: "destructive" })
    } finally {
      setSendingMessage(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-sm text-muted-foreground gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        Connecting to Stage Room...
      </div>
    )
  }

  if (!event) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold">Event Not Found</h2>
        <p className="text-sm text-muted-foreground">This event stage may have ended or been removed.</p>
        <Button asChild variant="outline" className="rounded-full text-xs">
          <Link href="/events"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Events Hub</Link>
        </Button>
      </div>
    )
  }

  const currentStatus = event ? checkStatus(event) : "ended"
  const badgeConfig = getEventStatusBadge(currentStatus)

  return (
    <div className="container max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-xl h-8 text-xs">
            <Link href="/events"><ArrowLeft className="w-4 h-4 mr-1" /> All Events</Link>
          </Button>
          <Badge className={`${badgeConfig.className} text-xs px-2.5 py-0.5 flex items-center gap-1.5`}>
            {badgeConfig.dot && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
            {badgeConfig.label}
          </Badge>
          <Badge variant="outline" className="text-xs">{event.category}</Badge>
          {allowCfg && event.allow_type && event.allow_type !== "everyone" && (
            <Badge className={`${allowCfg.className} text-[10px] px-2 py-0.5`}>
              <Lock className="w-2.5 h-2.5 mr-1" />
              {allowCfg.label}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isHostOrAdmin && event.is_live && (
            <Button
              onClick={handleEndEvent}
              disabled={endingEvent}
              variant="destructive"
              size="sm"
              className="rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700"
            >
              <Square className="w-3 h-3 mr-1 fill-white" />
              {endingEvent ? "Ending..." : "End Event"}
            </Button>
          )}
          <Button
            onClick={() => {
              setGiftRecipient({
                id: event.host_id,
                username: event.host_name.toLowerCase().replace(/\s+/g, ""),
                display_name: event.host_name,
                avatar_url: event.host_avatar
              })
              setGiftModalOpen(true)
            }}
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-semibold border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
          >
            <Gift className="w-3.5 h-3.5 mr-1" />
            Send Gift
          </Button>
          <Button
            onClick={toggleStageParticipation}
            variant={joinedStage ? "secondary" : "default"}
            size="sm"
            className="rounded-xl text-xs font-semibold"
          >
            {joinedStage ? "Leave Stage" : "Join Stage"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Live Broadcast Stage + Live Chat Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2-Cols: Video & Speaker Stage */}
        <div className="min-w-0 lg:col-span-2 space-y-4">
          {/* Main Broadcast Screen */}
          <Card className="relative overflow-hidden border-border/60 bg-slate-950 aspect-video rounded-2xl flex flex-col justify-between p-3 sm:p-4 shadow-xl">
            {joinedStage && videoEnabled ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src={event.cover_image || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80"}
                alt={event.title}
                className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

            {/* Stage Top Header */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-[11px] sm:text-xs">
                <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span>{event.is_live ? "Live Broadcast Room" : "Broadcast Ended"}</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 text-[11px] sm:text-xs bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>{participants.length} Active</span>
              </div>
            </div>

            {/* Stage Speakers Grid Simulation */}
            {(!joinedStage || !videoEnabled) && (
              <div className="relative z-10 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 my-auto max-w-lg mx-auto w-full">
                {participants.slice(0, 3).map((p, idx) => (
                  <div key={p.id || idx} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/90 border border-white/10 text-white text-center shadow-md">
                    <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-primary/50 shadow-md">
                      <AvatarImage src={p.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{p.display_name?.charAt(0) || "S"}</AvatarFallback>
                    </Avatar>
                    <p className="text-xs font-bold mt-2 truncate w-full">{p.display_name}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5 bg-white/10 text-cyan-300">
                      {p.role === "host" ? "Host" : p.role === "moderator" ? "Mod" : p.role || "Speaker"}
                    </Badge>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="col-span-full text-center py-6 text-slate-400 text-xs">
                    Host is on stage. Click &quot;Join Stage&quot; to get speaking access!
                  </div>
                )}
              </div>
            )}

            {/* Stage Controls Footer */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-white">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={event.host_avatar || "/placeholder.svg"} />
                  <AvatarFallback>{event.host_name?.charAt(0) || "H"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate max-w-[120px] sm:max-w-[150px]">{event.host_name}</p>
                  <p className="text-[10px] text-slate-400">Host</p>
                </div>
              </div>

              {joinedStage && (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setMicMuted(!micMuted)}
                    title={micMuted ? "Unmute Mic" : "Mute Mic"}
                    className="h-9 w-9 rounded-full bg-slate-900/80 border-white/20 text-white hover:bg-white/10"
                  >
                    {micMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setVideoEnabled(!videoEnabled)}
                    title={videoEnabled ? "Turn Camera Off" : "Turn Camera On"}
                    className="h-9 w-9 rounded-full bg-slate-900/80 border-white/20 text-white hover:bg-white/10"
                  >
                    {videoEnabled ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-rose-400" />}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Event Details Card */}
          <Card className="border-border/60 bg-card p-5 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">{event.title}</h2>
              {isMod && (
                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Host / Mod Moderation Enabled
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {event.description || "No description provided."}
            </p>
            {amMuted && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                <VolumeX className="w-4 h-4 shrink-0" />
                You&apos;re muted on this stage — a moderator muted you. You can still watch and join the stage.
              </div>
            )}
          </Card>

          {/* Real-time Participant & Moderation Roster */}
          <Card className="border-border/60 bg-card p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-500" />
                  Live Participant Roster ({participants.length})
                </h3>
                <p className="text-xs text-muted-foreground">Real-time attendance powered by Supabase Realtime.</p>
              </div>
              {isMod && event.is_live && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutingAll}
                    onClick={() => handleMuteAll(true)}
                    className="h-7 text-[10px] rounded-lg px-2 border-amber-500/40 text-amber-600 dark:text-amber-400"
                    title="Mute everyone's chat"
                  >
                    <VolumeX className="w-3 h-3 mr-1" />
                    Mute All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutingAll}
                    onClick={() => handleMuteAll(false)}
                    className="h-7 text-[10px] rounded-lg px-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    title="Unmute everyone"
                  >
                    <Volume2 className="w-3 h-3 mr-1" />
                    Unmute All
                  </Button>
                </div>
              )}
            </div>

            {participants.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3">No members currently on stage. Be the first to join!</p>
            ) : (
              <div className="divide-y divide-border/30">
                {participants.map((p) => (
                  <div key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage src={p.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{p.display_name?.charAt(0) || "P"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {p.display_name} <span className="text-muted-foreground font-normal">(@{p.username})</span>
                          {p.role === "host" && <Crown className="w-3 h-3 inline ml-1 text-amber-400" />}
                          {p.role === "moderator" && <ShieldCheck className="w-3 h-3 inline ml-1 text-sky-400" />}
                          {p.is_muted && <VolumeX className="w-3 h-3 inline ml-1 text-rose-400" />}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 capitalize">
                          {p.role || "listener"}
                        </Badge>
                      </div>
                    </div>

                    {isMod && p.user_id !== user?.id && (
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdminUpdateRole(p.user_id, p.role === "speaker" ? "listener" : "speaker", p.display_name)}
                          className="h-7 text-[10px] rounded-lg px-2 border-border/60"
                        >
                          {p.role === "speaker" ? "Make Listener" : "Make Speaker"}
                        </Button>
                        {p.role !== "moderator" && p.role !== "host" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAdminUpdateRole(p.user_id, "moderator", p.display_name)}
                            className="h-7 text-[10px] rounded-lg px-2 border-sky-500/40 text-sky-600 dark:text-sky-400"
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Give Mod
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMuteParticipant(p.user_id, p.display_name, !p.is_muted)}
                          className="h-7 text-[10px] rounded-lg px-2 border-amber-500/40 text-amber-600 dark:text-amber-400"
                        >
                          {p.is_muted ? <Volume2 className="w-3 h-3 mr-1" /> : <VolumeX className="w-3 h-3 mr-1" />}
                          {p.is_muted ? "Unmute" : "Mute"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAdminKick(p.user_id, p.display_name)}
                          className="h-7 text-[10px] rounded-lg px-2"
                        >
                          <UserX className="w-3 h-3 mr-1" />
                          Kick
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right 1-Col: Live Chat Room */}
        <Card className="min-w-0 border-border/60 bg-card/80 shadow-sm flex flex-col justify-between h-[480px] sm:h-[520px]">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              Stage Chat Room
            </CardTitle>
            <CardDescription className="text-xs">
              Live discussion with speakers and attendees.
            </CardDescription>
          </CardHeader>

          {/* Messages Scroll Area */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {chatMessages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">
                No messages yet. Say hello to the stage.
              </p>
            )}
            {chatMessages.map((msg) => (
              <div key={msg.id} className="group flex items-start gap-2 text-xs">
                <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                  <AvatarImage src={msg.avatar} />
                  <AvatarFallback>{msg.sender?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="min-w-0 bg-muted/60 p-2.5 rounded-xl">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-foreground truncate">{msg.sender}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{msg.timestamp}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed break-words">{msg.text}</p>
                  </div>
                  {(isMod || msg.user_id === user?.id) && (
                    <div className="mt-0.5 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3 h-3" />
                        {isMod && msg.user_id !== user?.id ? "Remove" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-border/50 flex items-center gap-2">
            <Input
              placeholder={amMuted ? "You're muted in this chat" : user ? "Type a message..." : "Sign in to chat"}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!user || sendingMessage || amMuted}
              className="rounded-xl text-xs h-9"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!user || sendingMessage || !inputText.trim() || amMuted}
              className="h-9 w-9 rounded-xl shrink-0 bg-primary"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      </div>

      {giftRecipient && (
        <GiftModal
          open={giftModalOpen}
          onOpenChange={setGiftModalOpen}
          recipient={giftRecipient}
          context={{ type: "stream", id: event.id, title: event.title }}
        />
      )}
    </div>
  )
}
