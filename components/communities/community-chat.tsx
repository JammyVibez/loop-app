"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Send,
  Loader2,
  MessageSquare,
  Reply,
  X,
  ImageIcon,
  Smile,
  Trash2,
  MoreHorizontal,
} from "lucide-react"

interface ChatMessage {
  id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  message_type: string
  sender_id: string
  author_id: string
  circle_id: string
  reply_to_id: string | null
  reactions: any
  is_edited: boolean
  edited_at: string | null
  is_deleted: boolean
  created_at: string
  sender: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
    is_verified: boolean
    is_premium: boolean
  } | null
}

interface SpaceInfo {
  id: string | number
  name: string
  icon?: string
  type?: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = []
  let current: ChatMessage[] = []

  for (const msg of messages) {
    const date = new Date(msg.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    if (current.length === 0 || current[0] && new Date(current[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) !== date) {
      if (current.length > 0) groups.push({ date: new Date(current[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), messages: [...current] })
      current = [msg]
    } else {
      current.push(msg)
    }
  }
  if (current.length > 0) groups.push({ date: new Date(current[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), messages: current })
  return groups
}

export function CommunityChat({
  communityId,
  spaces,
  canModerate,
}: {
  communityId: string
  spaces: SpaceInfo[]
  canModerate: boolean
}) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [selectedSpace, setSelectedSpace] = useState<string>("general")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const spaceParam = selectedSpace !== "general" ? `&space_id=${selectedSpace}` : ""
      const res = await fetch(`/api/communities/${communityId}/chat?limit=100${spaceParam}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load chat")
      setMessages(data.messages || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId, selectedSpace])

  useEffect(() => {
    load()
  }, [load])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Poll for new messages every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      load()
    }, 15000)
    return () => clearInterval(interval)
  }, [load])

  const send = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      const body: any = {
        content: input.trim(),
        space_id: selectedSpace !== "general" ? selectedSpace : undefined,
      }
      if (replyTo) {
        body.reply_to_id = replyTo.id
        setReplyTo(null)
      }
      const res = await fetch(`/api/communities/${communityId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      if (data.message) {
        setMessages((prev) => [...prev, data.message])
      }
      setInput("")
      inputRef.current?.focus()
    } catch (e: any) {
      setError(e.message)
      setTimeout(() => setError(""), 3000)
    } finally {
      setSending(false)
    }
  }

  const deleteMessage = async (msgId: string) => {
    try {
      await fetch(`/api/messages/${msgId}`, { method: "DELETE" })
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    } catch {
      /* ignore */
    }
  }

  const grouped = groupMessagesByDate(messages)

  return (
    <div className="flex flex-col h-full min-h-[500px] max-h-[700px]">
      {/* Space Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 overflow-x-auto">
        <button
          onClick={() => setSelectedSpace("general")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition shrink-0",
            selectedSpace === "general"
              ? "bg-indigo-500/15 text-indigo-500 border border-indigo-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <MessageSquare className="h-3 w-3" />
          General
        </button>
        {spaces.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSpace(String(s.id))}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition shrink-0",
              selectedSpace === String(s.id)
                ? "bg-indigo-500/15 text-indigo-500 border border-indigo-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scroll-smooth"
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/70">Start the conversation!</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {group.messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id
                const isMod = canModerate
                const sender = msg.sender

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "group flex items-start gap-2 py-1.5 rounded-lg px-2 -mx-2 hover:bg-muted/30 transition",
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarImage src={sender?.avatar_url || ""} />
                      <AvatarFallback className="text-[10px] bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
                        {sender?.display_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-sm font-semibold truncate", isOwn ? "text-indigo-500" : "")}>
                          {sender?.display_name || "Unknown"}
                        </span>
                        {sender?.is_verified && (
                          <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 bg-blue-500/10 text-blue-500 border-0">
                            ✓
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(msg.created_at)}
                        </span>
                      </div>
                      {msg.reply_to_id && (
                        <p className="text-[10px] text-muted-foreground italic mb-0.5">
                          Replying to a message...
                        </p>
                      )}
                      {msg.content && (
                        <p className="text-sm text-foreground/90 leading-relaxed break-words whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      )}
                      {msg.media_url && msg.message_type === "image" && (
                        <img
                          src={msg.media_url}
                          alt="Shared media"
                          className="mt-1 rounded-xl max-h-60 object-cover border border-border/50"
                          loading="lazy"
                        />
                      )}
                      {msg.media_url && msg.message_type === "file" && (
                        <a
                          href={msg.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:underline"
                        >
                          📎 Attachment
                        </a>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0 mt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setReplyTo(msg)}
                        title="Reply"
                      >
                        <Reply className="h-3 w-3" />
                      </Button>
                      {(isOwn || isMod) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-600"
                          onClick={() => deleteMessage(msg.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="mx-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <Reply className="h-3 w-3 text-indigo-500 shrink-0" />
          <span className="text-muted-foreground truncate flex-1">
            Replying to <span className="font-semibold text-foreground">{replyTo.sender?.display_name}</span>:{" "}
            {replyTo.content?.slice(0, 60) || "Media"}
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReplyTo(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/50">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.sender?.display_name}...` : "Type a message..."}
            className="flex-1 rounded-xl bg-muted/50 border-border/50 text-sm h-10"
            disabled={sending}
            maxLength={5000}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sending}
            className="h-10 w-10 rounded-xl shrink-0 bg-indigo-500 hover:bg-indigo-600"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
