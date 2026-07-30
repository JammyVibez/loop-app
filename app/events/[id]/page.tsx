"use client"

import { useState, useEffect, use } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Radio, Users, Send, ArrowLeft, Mic, MicOff, Video, ShieldCheck, Heart, Gift, MessageSquare, RefreshCw, Crown, UserX, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

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
}

interface Participant {
  id: string
  user_id: string
  username: string
  display_name: string
  avatar_url: string
  role: string
  joined_at: string
}

interface ChatMessage {
  id: string
  sender: string
  avatar: string
  text: string
  timestamp: string
}

export default function SingleEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const { toast } = useToast()

  const [event, setEvent] = useState<EventItem | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "c1", sender: "Loop Bot", avatar: "/placeholder.svg", text: "Welcome to the Event Stage! Keep conversations respectful.", timestamp: "Just now" }
  ])
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(true)
  const [joinedStage, setJoinedStage] = useState(false)
  const [micMuted, setMicMuted] = useState(true)

  const isHostOrAdmin = user && (user.id === event?.host_id || user.is_admin)

  useEffect(() => {
    fetchEventDetails(true)

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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: user?.display_name || user?.user_metadata?.display_name || "Guest",
      avatar: user?.avatar_url || user?.user_metadata?.avatar_url || "/placeholder.svg",
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setChatMessages((prev) => [...prev, newMsg])
    setInputText("")
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

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="rounded-xl h-8 text-xs">
            <Link href="/events"><ArrowLeft className="w-4 h-4 mr-1" /> All Events</Link>
          </Button>
          <Badge className="bg-rose-500 text-white text-xs px-2.5 py-0.5 animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white" />
            LIVE STAGE
          </Badge>
          <Badge variant="outline" className="text-xs">{event.category}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={toggleStageParticipation}
            variant={joinedStage ? "destructive" : "default"}
            size="sm"
            className="rounded-xl text-xs font-semibold"
          >
            {joinedStage ? "Leave Stage" : "Join Stage"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Live Broadcast Stage + Live Chat Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Cols: Video & Speaker Stage */}
        <div className="lg:col-span-2 space-y-4">
          {/* Main Broadcast Screen */}
          <Card className="relative overflow-hidden border-border/60 bg-slate-950 aspect-video rounded-2xl flex flex-col justify-between p-4 shadow-xl">
            <img
              src={event.cover_image || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80"}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

            {/* Stage Top Header */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-xs">
                <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span>Stage Broadcast Room</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 text-xs bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>{participants.length} Active Participants</span>
              </div>
            </div>

            {/* Stage Speakers Grid Simulation */}
            <div className="relative z-10 grid grid-cols-3 gap-3 my-auto max-w-lg mx-auto w-full">
              {participants.slice(0, 3).map((p, idx) => (
                <div key={p.id || idx} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/90 border border-white/10 text-white text-center shadow-md">
                  <Avatar className="w-12 h-12 border-2 border-primary/50 shadow-md">
                    <AvatarImage src={p.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{p.display_name?.charAt(0) || "S"}</AvatarFallback>
                  </Avatar>
                  <p className="text-xs font-bold mt-2 truncate w-full">{p.display_name}</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5 bg-white/10 text-cyan-300">
                    {p.role || "Speaker"}
                  </Badge>
                </div>
              ))}
              {participants.length === 0 && (
                <div className="col-span-3 text-center py-6 text-slate-400 text-xs">
                  Host is on stage. Click "Join Stage" to get speaking access!
                </div>
              )}
            </div>

            {/* Stage Controls Footer */}
            <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-3 text-white">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={event.host_avatar || "/placeholder.svg"} />
                  <AvatarFallback>{event.host_name?.charAt(0) || "H"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs font-bold truncate max-w-[150px]">{event.host_name}</p>
                  <p className="text-[10px] text-slate-400">Host</p>
                </div>
              </div>

              {joinedStage && (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setMicMuted(!micMuted)}
                    className="h-9 w-9 rounded-full bg-slate-900/80 border-white/20 text-white hover:bg-white/10"
                  >
                    {micMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Event Details Card */}
          <Card className="border-border/60 bg-card p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">{event.title}</h2>
              {isHostOrAdmin && (
                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Host / Admin Moderation Enabled
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {event.description || "No description provided."}
            </p>
          </Card>

          {/* Real-time Participant & Moderation Roster */}
          <Card className="border-border/60 bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-500" />
                  Live Participant Roster ({participants.length})
                </h3>
                <p className="text-xs text-muted-foreground">Real-time attendance powered by Supabase Realtime.</p>
              </div>
            </div>

            {participants.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3">No members currently on stage. Be the first to join!</p>
            ) : (
              <div className="divide-y divide-border/30">
                {participants.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage src={p.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{p.display_name?.charAt(0) || "P"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {p.display_name} <span className="text-muted-foreground font-normal">(@{p.username})</span>
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">
                          {p.role || "listener"}
                        </Badge>
                      </div>
                    </div>

                    {isHostOrAdmin && p.user_id !== user.id && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdminUpdateRole(p.user_id, p.role === "speaker" ? "listener" : "speaker", p.display_name)}
                          className="h-7 text-[10px] rounded-lg px-2 border-border/60"
                        >
                          {p.role === "speaker" ? "Make Listener" : "Make Speaker"}
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
        <Card className="border-border/60 bg-card/80 shadow-sm flex flex-col justify-between h-[520px]">
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
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 text-xs">
                <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                  <AvatarImage src={msg.avatar} />
                  <AvatarFallback>{msg.sender?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 bg-muted/60 p-2.5 rounded-xl flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-semibold text-foreground truncate">{msg.sender}</span>
                    <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed break-words">{msg.text}</p>
                </div>
              </div>
            ))}
          </CardContent>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-border/50 flex items-center gap-2">
            <Input
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="rounded-xl text-xs h-9"
            />
            <Button type="submit" size="icon" className="h-9 w-9 rounded-xl shrink-0 bg-primary">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
