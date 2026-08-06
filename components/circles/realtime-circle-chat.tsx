"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Mic, Paperclip, Reply, Send, Smile, Square, Wifi, WifiOff } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
}

interface RealtimeCircleChatProps {
  circleId: string
  roomId: string
  roomName: string
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

export function RealtimeCircleChat({ circleId, roomId, roomName }: RealtimeCircleChatProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<CircleRoomMessage[]>([])
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
    <Card className="flex h-full min-h-[28rem] flex-col border-border bg-card text-card-foreground">
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span># {roomName}</span>
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            {isConnected ? <Wifi className="h-3.5 w-3.5 text-emerald-300" /> : <WifiOff className="h-3.5 w-3.5 text-amber-300" />}
            {isConnected ? "Realtime" : "Syncing"}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                No messages yet. Start the room conversation.
              </div>
            )}
            {messages.map((message) => {
              const parent = message.reply_to_id ? messageById.get(message.reply_to_id) : null
              const isMine = message.author.id === user?.id
              return (
                <div
                  key={message.id}
                  className={cn("group flex items-start gap-3", isMine && "flex-row-reverse")}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={message.author.avatar_url} alt={message.author.display_name} />
                    <AvatarFallback>{message.author.display_name?.charAt(0) || "M"}</AvatarFallback>
                  </Avatar>
                  <div className={cn("min-w-0 max-w-[85%] flex-1", isMine && "flex flex-col items-end")}>
                    <div className={cn("mb-1 flex items-center gap-2", isMine && "flex-row-reverse")}>
                      <span className="text-sm font-semibold text-foreground">{message.author.display_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    {parent && (
                      <div className="mb-1 max-w-full truncate rounded-lg border border-border bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
                        Replying to {parent.author.display_name}: {parent.content}
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-sm",
                        isMine
                          ? "border-primary/30 bg-primary/15 text-foreground"
                          : "border-border bg-muted/50 text-foreground",
                      )}
                    >
                      {message.media_url && (message.media_type === "audio" || /\.(webm|mp3|ogg|m4a|wav)(\?|$)/i.test(message.media_url)) && (
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
              )
            })}
            {typingLabel && (
              <p className="text-xs text-muted-foreground animate-pulse">{typingLabel} typing…</p>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="truncate">
                Replying to <strong>{replyTo.author.display_name}</strong>: {replyTo.content}
              </span>
              <button type="button" className="ml-2 text-muted-foreground hover:text-foreground" onClick={() => setReplyTo(null)}>
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
              className="rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
