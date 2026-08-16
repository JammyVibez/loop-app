"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Hash, MessageCircle, Mic, Paperclip, Reply, Send, Smile, Square, Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { uploadMediaFile } from "@/lib/client-media-upload"

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👏", "😮"]

interface CircleRoomMessage {
  id: string
  content: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
      setMessages((data.messages || []).map(mapMessage))
    } catch (error) {
      console.error("Failed to load room messages:", error)
    }
  }

  useEffect(() => {
    loadMessages()
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
        () => loadMessages(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_room_message_reactions" },
        () => loadMessages(),
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

  const handleSendMessage = async (opts?: { content?: string; media_url?: string | null; media_type?: string | null }) => {
    const content = (opts?.content ?? newMessage).trim()
    const mediaUrl = opts?.media_url ?? null
    const mediaType = opts?.media_type ?? null
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
      reply_to_id: replyTo?.id || null,
      media_url: mediaUrl,
      media_type: mediaType,
    }

    setMessages((prev) => [...prev, optimisticMessage])
    if (!opts?.media_url) setNewMessage("")
    const replied = replyTo
    setReplyTo(null)
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
          reply_to_id: replied?.id || null,
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
          {messages.map((message, index) => {
            const parent = message.reply_to_id ? messageById.get(message.reply_to_id) : null
            const isMine = message.author.id === user?.id
            const prev = messages[index - 1]
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
                >
                  <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border">
                    <AvatarImage src={message.author.avatar_url} alt={message.author.display_name} />
                    <AvatarFallback>{message.author.display_name?.charAt(0) || "M"}</AvatarFallback>
                  </Avatar>
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
                      {message.media_url && (message.media_type === "audio" || /\\.(webm|mp3|ogg|m4a|wav)(\\?|$)/i.test(message.media_url)) && (
                        <audio controls src={message.media_url} className="mb-1 w-full max-w-[240px]" />
                      )}
                      {message.media_url && message.media_type === "image" && (
                        <img src={message.media_url} alt="" className="mb-1 max-h-48 rounded-xl object-cover" />
                      )}
                      {message.media_url && message.media_type === "video" && (
                        <video src={message.media_url} controls className="mb-1 max-h-48 w-full rounded-xl" />
                      )}
                      {message.content && !(message.media_type === "audio" && message.content === "Voice note") && (
                        <RichContent text={message.content} as="p" />
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
                    </div>
                  </div>
                </div>
              </Fragment>
            )
          })}
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
            <Sparkles className="h-3 w-3" /> Markdown
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
  )
}
