"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Hash,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Mic,
  Minus,
  Paperclip,
  Phone,
  PhoneOff,
  Plus,
  Reply,
  Send,
  Smile,
  Square,
  Zap,
  Video,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { MediaEmojiPicker } from "@/components/content/media-emoji-picker"
import { CallSheet } from "@/components/calls/call-sheet"

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👏", "😮"]

interface PollOption {
  id: string
  text: string
  votes: number
}

interface PollData {
  id: string
  question: string
  options: PollOption[]
  total_votes: number
  created_by?: string
  ends_at?: string | null
  ended?: boolean
  user_vote?: string | null
}

interface CircleRoomMessage {
  id: string
  content: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    video_avatar_url?: string | null
    is_verified?: boolean
    is_premium?: boolean
  }
  timestamp: string
  reply_to_id?: string | null
  media_url?: string | null
  media_type?: string | null
  reactions?: Record<string, number>
  my_reactions?: string[]
  is_bot?: boolean
  bot_name?: string | null
  reply_count?: number
  poll?: PollData | null
}

interface RealtimeCircleChatProps {
  circleId: string
  roomId: string
  roomName: string
  /** Optional back-to-room-list action (shown in the header when provided). */
  onBack?: () => void
}

function mapMessage(message: any): CircleRoomMessage {
  const author = Array.isArray(message.author) ? message.author[0] : message.author
  return {
    id: message.id,
    content: message.content || "",
    author: author || { id: message.author_id, username: "member", display_name: "Member" },
    timestamp: message.created_at || message.timestamp || new Date().toISOString(),
    reply_to_id: message.reply_to_id || null,
    media_url: message.media_url || null,
    media_type: message.media_type || null,
    reactions: message.reactions || {},
    my_reactions: message.my_reactions || [],
    is_bot: Boolean(message.is_bot),
    bot_name: message.bot_name || null,
    reply_count: Number(message.reply_count || 0),
    poll: message.poll || null,
  }
}

function formatDayLabel(date: Date) {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(date, today)) return "Today"
  if (sameDay(date, yesterday)) return "Yesterday"
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" })
}

const POLL_DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
]

function PollCard({
  poll,
  onVote,
  disabled,
}: {
  poll: PollData
  onVote: (pollId: string, optionId: string) => void
  disabled?: boolean
}) {
  const total = Math.max(1, Number(poll.total_votes || 0))
  const ended = Boolean(poll.ended) || (poll.ends_at ? new Date(poll.ends_at).getTime() <= Date.now() : false)
  const maxVotes = Math.max(1, ...(poll.options || []).map((o) => Number(o.votes || 0)))

  return (
    <div className="mt-2 w-full max-w-md space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold leading-snug">{poll.question}</p>
        <Badge variant="outline" className="shrink-0 text-[9px]">
          📊 Poll
        </Badge>
      </div>
      <div className="space-y-1.5">
        {(poll.options || []).map((option) => {
          const votes = Number(option.votes || 0)
          const pct = Math.round((votes / total) * 100)
          const isMine = poll.user_vote === option.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={Boolean(disabled) || ended || Boolean(poll.user_vote)}
              onClick={() => onVote(poll.id, option.id)}
              className={cn(
                "relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition",
                ended || poll.user_vote
                  ? "border-border bg-muted/40"
                  : "border-primary/30 bg-background hover:border-primary/60 hover:bg-primary/5",
                isMine && "border-primary/70 bg-primary/15",
              )}
            >
              <div
                className={cn(
                  "absolute inset-y-0 left-0 bg-gradient-to-r opacity-15",
                  isMine ? "from-primary to-primary" : "from-primary to-cyan-400",
                )}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="font-medium">{option.text}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                  {isMine && <Badge className="rounded-full px-1.5 py-0 text-[9px]">You</Badge>}
                  {votes} · {pct}%
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {poll.total_votes || 0} vote{(poll.total_votes || 0) === 1 ? "" : "s"}
        {ended ? " · Ended" : poll.ends_at ? ` · ends ${formatDistanceToNow(new Date(poll.ends_at), { addSuffix: true })}` : ""}
        {!ended && !poll.user_vote && " · tap an option to vote"}
      </p>
    </div>
  )
}

export function RealtimeCircleChat({ circleId, roomId, roomName, onBack }: RealtimeCircleChatProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<CircleRoomMessage[]>([])
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [replyTo, setReplyTo] = useState<CircleRoomMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const [openReactionFor, setOpenReactionFor] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [uploadingAudio, setUploadingAudio] = useState(false)

  // Threads — Slack-style side panel for replies to a parent message.
  const [threadMessage, setThreadMessage] = useState<CircleRoomMessage | null>(null)
  const [threadReplies, setThreadReplies] = useState<CircleRoomMessage[]>([])
  const [threadDraft, setThreadDraft] = useState("")
  const [threadLoading, setThreadLoading] = useState(false)
  const [sendingThread, setSendingThread] = useState(false)

  // Polls — rendered inline on poll messages; state lives here so realtime
  // vote updates patch counts without re-fetching the whole message list.
  const [pollsByMessage, setPollsByMessage] = useState<Record<string, PollData>>({})
  const [pollOpen, setPollOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""])
  const [pollDuration, setPollDuration] = useState(24)
  const [creatingPoll, setCreatingPoll] = useState(false)

  // Voice / video calls (100ms) — one session per circle, anyone can join.
  const [activeCall, setActiveCall] = useState<{ sessionId: string; mode: "video" | "audio" } | null>(null)
  const [incomingCall, setIncomingCall] = useState<{
    sessionId: string
    mode: "video" | "audio"
    fromName: string
    avatarUrl?: string
  } | null>(null)
  const [startingCall, setStartingCall] = useState<"video" | "audio" | null>(null)
  const activeCallRef = useRef<{ sessionId: string; mode: "video" | "audio" } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  // Kept in a ref so the realtime channel doesn't need to re-subscribe when
  // the thread panel opens/closes.
  const threadIdRef = useRef<string | null>(null)
  threadIdRef.current = threadMessage?.id ?? null
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const messageById = useMemo(() => {
    const map = new Map<string, CircleRoomMessage>()
    messages.forEach((m) => map.set(m.id, m))
    return map
  }, [messages])

  const loadMessages = async () => {
    if (!user || !roomId) return

    try {
      const response = await fetch(`/api/circles/${circleId}/rooms/${roomId}/messages?limit=80`, {
        headers: getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load messages")
      const mapped = (data.messages || []).map(mapMessage)
      setMessages(mapped)

      // Seed the poll store from the message payloads so poll cards render
      // immediately on first load. The messages API attaches each poll (with
      // the viewer's own vote) to its message row; without this the poll
      // cards only appeared after a realtime event fired for the first time.
      const seeded: Record<string, PollData> = {}
      for (const message of mapped) {
        if (message.poll) seeded[message.id] = message.poll
      }
      if (Object.keys(seeded).length > 0) {
        setPollsByMessage((prev) => {
          const next = { ...prev, ...seeded }
          // Preserve an in-session vote that hasn't been persisted yet
          // (optimistic vote before the realtime refresh landed).
          for (const [messageId, poll] of Object.entries(next)) {
            const incoming = seeded[messageId]
            if (incoming && prev[messageId]?.id === incoming.id && prev[messageId]?.user_vote) {
              next[messageId] = { ...incoming, user_vote: prev[messageId]!.user_vote }
            }
          }
          return next
        })
      }
    } catch (error) {
      console.error("Failed to load room messages:", error)
    }
  }

  const refreshPolls = useCallback(async () => {
    if (!user || !roomId) return
    try {
      const response = await fetch(`/api/circles/${circleId}/rooms/${roomId}/polls`, {
        headers: getAuthHeader(),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) return
      setPollsByMessage((prev) => {
        const next: Record<string, PollData> = {}
        for (const p of data.polls || []) {
          if (p.message_id) next[p.message_id] = { ...p, user_vote: prev[p.message_id]?.user_vote || null }
        }
        return next
      })
    } catch {
      /* non-critical */
    }
  }, [circleId, roomId, user, getAuthHeader])

  const loadThread = useCallback(
    async (messageId: string) => {
      if (!user || !messageId) return
      setThreadLoading(true)
      try {
        const response = await fetch(
          `/api/circles/${circleId}/rooms/${roomId}/messages?limit=200&thread_of=${messageId}`,
          { headers: getAuthHeader() },
        )
        const data = await response.json().catch(() => ({}))
        if (response.ok) setThreadReplies((data.messages || []).map(mapMessage))
      } catch {
        /* ignore */
      } finally {
        setThreadLoading(false)
      }
    },
    [circleId, roomId, user, getAuthHeader],
  )

  useEffect(() => {
    loadMessages()
    // Polls live on their own table, so also fetch them directly on room
    // change — this catches polls attached to messages outside the loaded
    // window and guarantees the store is warm even before any realtime event.
    void refreshPolls()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, roomId, user?.id])

  // Pull the room's member count so the header can show it without the parent
  // needing to thread the room card data through.
  useEffect(() => {
    let cancelled = false
    const loadMemberCount = async () => {
      try {
        const response = await fetch(`/api/circles/${circleId}/rooms`, { headers: getAuthHeader() })
        const data = await response.json().catch(() => ({}))
        if (cancelled || !response.ok) return
        const room = (data.rooms || []).find((r: any) => r.id === roomId)
        if (room) setMemberCount(Number(room.member_count || 0))
      } catch {
        // Non-critical — the header just omits the count.
      }
    }
    void loadMemberCount()
    return () => {
      cancelled = true
    }
  }, [circleId, roomId, getAuthHeader])

  useEffect(() => {
    if (!roomId || !user?.id) return

    const channel = supabase.channel(`circle-room:${roomId}`, {
      config: { broadcast: { self: false } },
    })
    channelRef.current = channel

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_room_messages", filter: `room_id=eq.${roomId}` },
        () => {
          loadMessages()
          if (threadIdRef.current) void loadThread(threadIdRef.current)
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_room_message_reactions" },
        () => loadMessages(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_room_polls", filter: `room_id=eq.${roomId}` },
        () => void refreshPolls(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "circle_room_poll_votes" },
        () => void refreshPolls(),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload?.user_id || payload.user_id === user.id) return
        setTypingUsers((prev) => ({ ...prev, [payload.user_id]: payload.display_name || "Someone" }))
        window.setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev }
            delete next[payload.user_id]
            return next
          })
        }, 2500)
      })
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"))

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      setIsConnected(false)
    }
  }, [roomId, user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingUsers])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [threadReplies])

  // ---- Circle calls (100ms) -------------------------------------------

  const startCircleCall = async (mode: "video" | "audio") => {
    if (!user || startingCall) return
    setStartingCall(mode)
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ circle_id: circleId, is_video: mode === "video" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not start the call")
      const sessionId: string = data.data?.session?.id
      if (!sessionId) throw new Error("Could not start the call")
      setActiveCall({ sessionId, mode })
      activeCallRef.current = { sessionId, mode }
    } catch (error: any) {
      toast({ title: "Call failed", description: error?.message || "Please try again.", variant: "destructive" })
    } finally {
      setStartingCall(null)
    }
  }

  const acceptIncomingCall = () => {
    if (!incomingCall) return
    const next = { sessionId: incomingCall.sessionId, mode: incomingCall.mode }
    setIncomingCall(null)
    setActiveCall(next)
    activeCallRef.current = next
  }

  const declineIncomingCall = () => {
    if (!incomingCall) return
    void fetch(`/api/calls/${incomingCall.sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ action: "end" }),
    }).catch(() => {})
    setIncomingCall(null)
  }

  // Ring for circle calls + react when a call ends (RLS-scoped realtime).
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase.channel(`calls-circle:${circleId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_sessions", filter: `circle_id=eq.${circleId}` },
        (payload: any) => {
          const session = payload.new
          if (!session || session.creator_id === user.id) return
          if (session.status !== "ringing") return
          void (async () => {
            try {
              const { data: creator } = await supabase
                .from("profiles")
                .select("username, display_name, avatar_url")
                .eq("id", session.creator_id)
                .maybeSingle()
              if (!creator) return
              setIncomingCall({
                sessionId: session.id,
                mode: session.is_video ? "video" : "audio",
                fromName: creator.display_name || creator.username || "Someone",
                avatarUrl: creator.avatar_url,
              })
            } catch {
              /* ignore */
            }
          })()
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_sessions", filter: `circle_id=eq.${circleId}` },
        (payload: any) => {
          const session = payload.new
          if (!session) return
          setIncomingCall((prev) =>
            prev && prev.sessionId === session.id && session.status === "ended" ? null : prev,
          )
          if (
            activeCallRef.current &&
            session.id === activeCallRef.current.sessionId &&
            session.status === "ended"
          ) {
            setActiveCall(null)
            activeCallRef.current = null
            toast({ title: "Call ended" })
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, user?.id])

  const broadcastTyping = () => {
    if (!user || !channelRef.current) return
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      void channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: user.id, display_name: user.display_name || user.username },
      })
    }, 180)
  }

  const handleSendMessage = async (opts?: {
    content?: string
    media_url?: string | null
    media_type?: string | null
    reply_to_id?: string | null
    skipClear?: boolean
  }) => {
    const content = (opts?.content ?? newMessage).trim()
    const mediaUrl = opts?.media_url ?? null
    const mediaType = opts?.media_type ?? null
    const replyId = opts?.reply_to_id !== undefined ? opts.reply_to_id : replyTo?.id
    if ((!content && !mediaUrl) || !user) return

    const optimisticMessage: CircleRoomMessage = {
      id: `temp-${Date.now()}`,
      content: content || (mediaType === "audio" ? "Voice note" : ""),
      author: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
        is_premium: user.is_premium,
      },
      timestamp: new Date().toISOString(),
      reply_to_id: replyId || null,
      media_url: mediaUrl,
      media_type: mediaType,
    }

    setMessages((prev) => [...prev, optimisticMessage])
    if (!opts?.skipClear && !opts?.media_url) setNewMessage("")
    const replied = replyTo
    if (!opts?.skipClear) setReplyTo(null)
    setIsSending(true)

    try {
      const response = await fetch(`/api/circles/${circleId}/rooms/${roomId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          content: optimisticMessage.content,
          media_url: mediaUrl,
          media_type: mediaType,
          reply_to_id: replyId || replied?.id || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to send message")
      setMessages((prev) =>
        prev.map((item) => (item.id === optimisticMessage.id ? mapMessage(data.data) : item)),
      )
    } catch (error: any) {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticMessage.id))
      toast({ title: "Message failed", description: error?.message || "Please try again.", variant: "destructive" })
    } finally {
      setIsSending(false)
    }
  }

  const sendThreadReply = async () => {
    const content = threadDraft.trim()
    if (!content || !threadMessage || !user || sendingThread) return
    setSendingThread(true)
    try {
      await handleSendMessage({ content, reply_to_id: threadMessage.id, skipClear: true })
      setThreadDraft("")
      await loadThread(threadMessage.id)
    } finally {
      setSendingThread(false)
    }
  }

  const openThread = (message: CircleRoomMessage) => {
    setThreadMessage(message)
    void loadThread(message.id)
  }

  const closeThread = () => {
    setThreadMessage(null)
    setThreadReplies([])
  }

  const createPoll = async () => {
    const question = pollQuestion.trim()
    const options = pollOptions.map((o) => o.trim()).filter(Boolean)
    if (!question || options.length < 2 || creatingPoll) return
    setCreatingPoll(true)
    try {
      const response = await fetch(`/api/circles/${circleId}/rooms/${roomId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ question, options, durationHours: pollDuration }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create poll")
      setPollOpen(false)
      setPollQuestion("")
      setPollOptions(["", ""])
      setPollDuration(24)
      await loadMessages()
      toast({ title: "Poll posted", description: "Members can start voting now." })
    } catch (error: any) {
      toast({ title: "Couldn't create poll", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setCreatingPoll(false)
    }
  }

  const votePoll = async (pollId: string, optionId: string) => {
    if (!user) return
    // Optimistic — lock the user's choice instantly, roll back on failure.
    setPollsByMessage((prev) => {
      const next = { ...prev }
      for (const [messageId, poll] of Object.entries(next)) {
        if (poll.id === pollId) {
          const option = (poll.options || []).find((o) => o.id === optionId)
          next[messageId] = {
            ...poll,
            user_vote: optionId,
            total_votes: Number(poll.total_votes || 0) + 1,
            options: (poll.options || []).map((o) =>
              o.id === optionId ? { ...o, votes: Number(o.votes || 0) + 1 } : o,
            ),
          }
        }
      }
      return next
    })
    try {
      const response = await fetch(`/api/circles/${circleId}/rooms/${roomId}/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ optionId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Vote failed")
      setPollsByMessage((prev) => {
        const next = { ...prev }
        for (const [messageId, poll] of Object.entries(next)) {
          if (poll.id === pollId) next[messageId] = { ...data.poll, user_vote: optionId }
        }
        return next
      })
    } catch (error: any) {
      await refreshPolls()
      toast({ title: "Vote failed", description: error?.message, variant: "destructive" })
    }
  }

  const uploadAndSendMedia = async (file: File, mediaType: "audio" | "image" | "video") => {
    if (!user) return
    setUploadingAudio(true)
    try {
      const uploaded = await uploadMediaFile(file, {
        type: mediaType,
        folder: "circle-chat",
        authHeaders: getAuthHeader(),
      })
      await handleSendMessage({
        content: mediaType === "audio" ? "Voice note" : "",
        media_url: uploaded.url,
        media_type: mediaType,
      })
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" })
    } finally {
      setUploadingAudio(false)
    }
  }

  const toggleRecording = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" })
        await uploadAndSendMedia(file, "audio")
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      toast({ title: "Microphone blocked", description: "Allow mic access to send voice notes.", variant: "destructive" })
    }
  }

  const handleReact = async (messageId: string, reactionType: string) => {
    if (!user) return
    setOpenReactionFor(null)
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg
        const mine = new Set(msg.my_reactions || [])
        const counts = { ...(msg.reactions || {}) }
        if (mine.has(reactionType)) {
          mine.delete(reactionType)
          counts[reactionType] = Math.max(0, Number(counts[reactionType] || 1) - 1)
          if (!counts[reactionType]) delete counts[reactionType]
        } else {
          mine.add(reactionType)
          counts[reactionType] = Number(counts[reactionType] || 0) + 1
        }
        return { ...msg, my_reactions: Array.from(mine), reactions: counts }
      }),
    )

    try {
      const response = await fetch(
        `/api/circles/${circleId}/rooms/${roomId}/messages/${messageId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ reactionType }),
        },
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Reaction failed")
      }
    } catch (error: any) {
      toast({ title: "Reaction failed", description: error?.message, variant: "destructive" })
      loadMessages()
    }
  }

  const typingLabel = Object.values(typingUsers).slice(0, 2).join(", ")

  const renderMessageRow = (message: CircleRoomMessage, index: number, list: CircleRoomMessage[]) => {
    const parent = message.reply_to_id ? messageById.get(message.reply_to_id) : null
    const isMine = message.author.id === user?.id
    const prev = list[index - 1]
    const showDayDivider =
      index === 0 ||
      !prev ||
      new Date(prev.timestamp).toDateString() !== new Date(message.timestamp).toDateString()
    return (
      <Fragment key={message.id}>
        {showDayDivider && (
          <div className="my-4 flex items-center gap-3 px-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {formatDayLabel(new Date(message.timestamp))}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
        <div
          className={cn(
            "group flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/40",
            isMine && "flex-row-reverse",
          )}
        >                <VideoAvatar
                  src={message.author.avatar_url}
                  videoSrc={message.author.video_avatar_url || null}
                  isPremium={message.author.is_premium}
                  alt={message.author.display_name}
                  size="sm"
                  className="ring-1 ring-border"
                />
          <div className={cn("min-w-0 max-w-[85%] flex-1", isMine && "flex flex-col items-end")}>
            <div className={cn("mb-0.5 flex items-baseline gap-2", isMine && "flex-row-reverse")}>
              <span className="text-[13px] font-semibold leading-tight text-foreground">
                {message.is_bot ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-2 py-0.5 text-[11px] font-bold text-white">
                    🤖 {message.bot_name || "Bot"}
                  </span>
                ) : (
                  message.author.display_name
                )}
                {!message.is_bot && message.author.is_verified && <span className="ml-1 text-sky-500">✓</span>}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
              </span>
            </div>
            {parent && (
              <div
                className={cn(
                  "mb-1 max-w-full truncate rounded-lg border border-border bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground",
                  isMine && "text-right",
                )}
              >
                <span className="font-semibold text-foreground/80">↪ {parent.author.display_name}</span>{" "}
                {parent.content}
              </div>
            )}
            <div
              className={cn(
                "rounded-2xl border px-3 py-2 text-sm shadow-sm",
                message.is_bot
                  ? "border-violet-500/30 bg-violet-500/10 text-foreground"
                  : isMine
                    ? "border-primary/25 bg-primary/10 text-foreground"
                    : "border-border bg-muted/40 text-foreground",
              )}
            >
              {message.media_url && (message.media_type === "audio" || /\.(webm|mp3|ogg|m4a|wav)(\?|$)/i.test(message.media_url)) && (
                <audio controls src={message.media_url} className="mb-1 w-full max-w-[240px]" />
              )}
              {message.media_url && (message.media_type === "image" || message.media_type === "sticker") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={message.media_url} alt="" className="mb-1 max-h-48 rounded-xl object-cover" />
              )}
              {message.media_url && message.media_type === "video" && (
                <video src={message.media_url} controls className="mb-1 max-h-48 w-full rounded-xl" />
              )}
              {message.content && !(message.media_type === "audio" && message.content === "Voice note") && (
                <RichContent text={message.content} as="p" />
              )}
              {(pollsByMessage[message.id] || message.poll) && (
                <PollCard
                  poll={pollsByMessage[message.id] || (message.poll as PollData)}
                  onVote={votePoll}
                  disabled={!user}
                />
              )}
            </div>
            <div className={cn("mt-1 flex flex-wrap items-center gap-1", isMine && "justify-end")}>
              {Object.entries(message.reactions || {}).map(([emoji, count]) =>
                count > 0 ? (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(message.id, emoji)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs transition",
                      (message.my_reactions || []).includes(emoji)
                        ? "border-primary/40 bg-primary/15"
                        : "border-border bg-muted/40 hover:bg-muted",
                    )}
                  >
                    {emoji} {count}
                  </button>
                ) : null,
              )}
              <div className="relative opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setOpenReactionFor((id) => (id === message.id ? null : message.id))}
                >
                  <Smile className="h-3.5 w-3.5" />
                </Button>
                {openReactionFor === message.id && (
                  <div className="absolute bottom-8 left-0 z-20 flex gap-1 rounded-full border border-border bg-popover p-1 shadow-xl">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded-full px-1.5 py-0.5 text-sm hover:bg-muted"
                        onClick={() => handleReact(message.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                onClick={() => setReplyTo(message)}
              >
                <Reply className="mr-1 h-3.5 w-3.5" />
                Reply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                onClick={() => openThread(message)}
              >
                <MessageSquareText className="mr-1 h-3.5 w-3.5" />
                Thread{Number(message.reply_count || 0) > 0 && ` · ${message.reply_count}`}
              </Button>
            </div>
          </div>
        </div>
      </Fragment>
    )
  }

  return (
    <div className="flex h-full min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      {/* Room header */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-3 py-2.5 sm:px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Back to rooms"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-violet-500 ring-1 ring-inset ring-border">
          <Hash className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{roomName}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isConnected ? "bg-emerald-500" : "bg-amber-400")} />
            {isConnected ? `${memberCount != null ? `${memberCount} members · ` : ""}Realtime` : "Syncing…"}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-emerald-500"
          title="Voice call"
          disabled={Boolean(startingCall) || Boolean(activeCall)}
          onClick={() => void startCircleCall("audio")}
        >
          {startingCall === "audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-violet-500"
          title="Video call"
          disabled={Boolean(startingCall) || Boolean(activeCall)}
          onClick={() => void startCircleCall("video")}
        >
          {startingCall === "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
        </Button>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            isConnected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
          )}
        >
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-amber-400")} />
          </span>
          {isConnected ? "Live" : "Offline"}
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Main pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Message list */}
          <ScrollArea className="flex-1 bg-background/40">
            <div className="space-y-0.5 px-2 py-4 sm:px-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 text-violet-500">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold">Welcome to #{roomName}</p>
                  <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    This is the start of the room. Say hi, share an idea, and keep the conversation going.
                  </p>
                </div>
              )}
              {messages.map((message, index) => renderMessageRow(message, index, messages))}
              {typingLabel && (
                <p className="px-3 pt-2 text-xs text-muted-foreground animate-pulse">{typingLabel} typing…</p>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Composer */}
          <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
            {/* Markdown Formatting Toolbar */}
            <div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 text-xs">
              <span className="mr-1.5 flex items-center gap-1 px-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-500">
                <Zap className="h-3 w-3" /> Markdown
              </span>
              <button
                type="button"
                onClick={() => setNewMessage((prev) => prev + "**bold**")}
                className="rounded border border-border/50 px-2 py-0.5 font-bold text-foreground hover:bg-muted"
                title="Bold (**text**)"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => setNewMessage((prev) => prev + "*italic*")}
                className="rounded border border-border/50 px-2 py-0.5 italic text-foreground hover:bg-muted"
                title="Italic (*text*)"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => setNewMessage((prev) => prev + "\n# Heading")}
                className="rounded border border-border/50 px-2 py-0.5 font-extrabold text-foreground hover:bg-muted"
                title="Heading (# text)"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => setNewMessage((prev) => prev + "~~strikethrough~~")}
                className="rounded border border-border/50 px-2 py-0.5 text-foreground line-through hover:bg-muted"
                title="Strikethrough (~~text~~)"
              >
                S
              </button>
              <button
                type="button"
                onClick={() => setNewMessage((prev) => prev + "\n> blockquote")}
                className="rounded border border-border/50 px-2 py-0.5 font-serif text-foreground hover:bg-muted"
                title="Blockquote (> text)"
              >
                &ldquo;
              </button>
              <button
                type="button"
                onClick={() => setNewMessage((prev) => prev + "`code`")}
                className="rounded border border-border/50 px-2 py-0.5 font-mono text-[10px] text-foreground hover:bg-muted"
                title="Inline Code (`text`)"
              >
                &lt;/&gt;
              </button>
              <button
                type="button"
                onClick={() => setNewMessage((prev) => prev + "\n---\n")}
                className="rounded border border-border/50 px-2 py-0.5 text-foreground hover:bg-muted"
                title="Horizontal Divider (---)"
              >
                &mdash;
              </button>
              <button
                type="button"
                onClick={() => setPollOpen(true)}
                className="ml-auto flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-bold text-primary hover:bg-primary/20"
                title="Create a poll"
              >
                <BarChart3 className="h-3 w-3" /> Poll
              </button>
            </div>

            {replyTo && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                <span className="truncate">
                  Replying to <strong className="text-foreground">{replyTo.author.display_name}</strong>: {replyTo.content}
                </span>
                <button type="button" className="ml-2 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setReplyTo(null)}>
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const type = file.type.startsWith("video")
                    ? "video"
                    : file.type.startsWith("audio")
                      ? "audio"
                      : "image"
                  void uploadAndSendMedia(file, type)
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                disabled={uploadingAudio || isSending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <MediaEmojiPicker
                onSelectEmoji={(emoji) => setNewMessage((prev) => `${prev}${emoji}`)}
                onSelectGif={(url) => { void handleSendMessage({ content: "", media_url: url, media_type: "gif" }) }}
                onSelectSticker={(url) => { void handleSendMessage({ content: "", media_url: url, media_type: "sticker" }) }}
                isPro={Boolean((user as any)?.is_premium)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn("shrink-0", recording ? "text-destructive" : "text-muted-foreground hover:text-foreground")}
                disabled={uploadingAudio || isSending}
                onClick={toggleRecording}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                disabled={isSending}
                onClick={() => setPollOpen(true)}
                title="Create a poll"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <MentionTextarea
                placeholder={recording ? "Recording…" : `Message #${roomName}… @ to tag`}
                value={newMessage}
                onChange={(value) => {
                  setNewMessage(value)
                  broadcastTyping()
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void handleSendMessage()
                  }
                }}
                rows={2}
                className="min-h-[44px] max-h-32 resize-none border-border bg-background text-foreground"
              />
              <Button
                onClick={() => void handleSendMessage()}
                disabled={!newMessage.trim() || isSending || uploadingAudio}
                className="shrink-0 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Thread panel — Slack-style right rail (full-screen overlay on mobile) */}
        {threadMessage && (
          <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl md:static md:z-auto md:w-80 lg:w-[22rem]">
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2.5">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              <p className="min-w-0 flex-1 truncate text-sm font-bold">Thread · #{roomName}</p>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={closeThread}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Parent message */}
            <div className="border-b border-border bg-muted/20 px-3 py-3">
              <div className="flex items-center gap-2">
                <VideoAvatar
                  src={threadMessage.author.avatar_url}
                  videoSrc={threadMessage.author.video_avatar_url || null}
                  isPremium={threadMessage.author.is_premium}
                  alt={threadMessage.author.display_name}
                  size="sm"
                />
                <span className="truncate text-xs font-semibold">{threadMessage.author.display_name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(threadMessage.timestamp), { addSuffix: true })}
                </span>
              </div>
              <div className="mt-1.5 pl-8 text-sm leading-relaxed">
                <RichContent text={threadMessage.content} as="p" />
              </div>
              {(pollsByMessage[threadMessage.id] || threadMessage.poll) && (
                <div className="pl-8">
                  <PollCard
                    poll={pollsByMessage[threadMessage.id] || (threadMessage.poll as PollData)}
                    onVote={votePoll}
                    disabled={!user}
                  />
                </div>
              )}
            </div>

            {/* Replies */}
            <ScrollArea className="flex-1 bg-background/40">
              <div className="space-y-0.5 px-2 py-3">
                {threadLoading && threadReplies.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">Loading replies…</p>
                )}
                {!threadLoading && threadReplies.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No replies yet — start the thread conversation.
                  </p>
                )}
                {threadReplies.map((message, index) => renderMessageRow(message, index, threadReplies))}
                <div ref={threadEndRef} />
              </div>
            </ScrollArea>

            {/* Thread composer */}
            <div className="border-t border-border bg-muted/20 p-3">
              <MentionTextarea
                placeholder={`Reply in thread…`}
                value={threadDraft}
                onChange={setThreadDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendThreadReply()
                  }
                }}
                rows={2}
                className="min-h-[44px] max-h-28 resize-none border-border bg-background text-foreground"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => void sendThreadReply()}
                  disabled={!threadDraft.trim() || sendingThread}
                >
                  {sendingThread ? <Send className="h-3.5 w-3.5 animate-pulse" /> : <Send className="h-3.5 w-3.5" />}
                  Reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Poll composer dialog */}
      <Dialog open={pollOpen} onOpenChange={setPollOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Create a poll
            </DialogTitle>
            <DialogDescription>
              Ask the community a question. One vote per member — live results as people vote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="poll-q">Question</Label>
              <Input
                id="poll-q"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="e.g. Which game are we playing this Friday?"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Options</Label>
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) =>
                      setPollOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))
                    }
                    placeholder={`Option ${index + 1}`}
                    maxLength={120}
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {pollOptions.length < 8 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setPollOptions((prev) => [...prev, ""])}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add option
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Duration
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {POLL_DURATIONS.map((d) => (
                  <button
                    key={d.hours}
                    type="button"
                    onClick={() => setPollDuration(d.hours)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      pollDuration === d.hours
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPollOpen(false)}>Cancel</Button>
            <Button
              onClick={() => void createPoll()}
              disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2 || creatingPoll}
            >
              {creatingPoll ? <BarChart3 className="mr-1.5 h-4 w-4 animate-pulse" /> : <BarChart3 className="mr-1.5 h-4 w-4" />}
              Post poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incoming circle call banner */}
      {incomingCall && (
        <div className="fixed left-1/2 top-4 z-[115] w-[min(94vw,430px)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
            <VideoAvatar
              src={incomingCall.avatarUrl}
              videoSrc={(incomingCall as any).video_avatar_url}
              alt={incomingCall.fromName}
              fallback={incomingCall.fromName?.charAt(0) || "?"}
              size="md"
              className="ring-2 ring-emerald-500/50"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {incomingCall.mode === "video" ? "Incoming video call" : "Incoming voice call"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{incomingCall.fromName}</p>
            </div>
            <Button
              size="sm"
              className="h-9 w-9 rounded-full bg-rose-600 p-0 hover:bg-rose-500"
              title="Decline"
              onClick={declineIncomingCall}
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="h-9 w-9 rounded-full bg-emerald-600 p-0 hover:bg-emerald-500"
              title="Accept"
              onClick={acceptIncomingCall}
            >
              {incomingCall.mode === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <CallSheet
        open={Boolean(activeCall)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveCall(null)
            activeCallRef.current = null
          }
        }}
        sessionId={activeCall?.sessionId || null}
        mode={activeCall?.mode || "video"}
        title={roomName ? `#${roomName}` : "Circle call"}
        subtitle="Circle voice & video room"
        onEnded={() => {
          setActiveCall(null)
          activeCallRef.current = null
        }}
      />
    </div>
  )
}
