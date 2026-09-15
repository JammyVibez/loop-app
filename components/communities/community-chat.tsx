"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { UserBadges } from "@/components/user-badge"
import { useVerificationBadges } from "@/hooks/use-verification-badges"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { Spinner } from "@/components/ui/skeletons"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { useToast } from "@/hooks/use-toast"
import {
  Send,
  MessageSquare,
  Reply,
  X,
  ImageIcon,
  Smile,
  Trash2,
  Search,
  Lock,
} from "lucide-react"

interface ChatMessage {
  id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  message_type: string
  author_id: string
  reply_to_id: string | null
  reply_to?: { id: string; content: string | null; media_url: string | null; message_type?: string; author?: { display_name?: string } } | null
  reactions: Record<string, string[]> | null
  is_edited: boolean
  created_at: string
  is_deleted?: boolean
  sender: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
    is_verified: boolean
    is_team_member?: boolean
    is_sponsor?: boolean
    is_organization?: boolean
    is_premium?: boolean
    badge_id?: string | null
  } | null
}

interface SpaceInfo {
  id: string | number
  name: string
  icon?: string
  type?: string
}

/** Quick reaction picker — tap to toggle on any message. */
const QUICK_REACTIONS = ["❤️", "😂", "🔥", "👍", "😮", "🙏"]
const QUICK_EMOJIS = ["😀", "😂", "🥰", "😎", "🤔", "😢", "😡", "🎉", "🔥", "👍", "🙏", "💯", "🚀", "✨", "❤️", "👀"]

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

function messageTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const groups: { date: string; messages: ChatMessage[] }[] = []
  let current: ChatMessage[] = []
  for (const msg of messages) {
    const date = fmt(new Date(msg.created_at))
    if (current.length === 0 && groups.every((g) => g.date !== date)) {
      current = [msg]
    } else if (current.length > 0 && fmt(new Date(current[0].created_at)) === date) {
      current.push(msg)
    } else {
      if (current.length > 0) groups.push({ date: fmt(new Date(current[0].created_at)), messages: [...current] })
      current = [msg]
    }
  }
  if (current.length > 0) groups.push({ date: fmt(new Date(current[0].created_at)), messages: current })
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
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const badges = useVerificationBadges()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [memberRoles, setMemberRoles] = useState<Record<string, { role: string | null; custom_role_name: string | null; gradient: string | null }>>({})
  const [chatSettings, setChatSettings] = useState<{ chat_locked: boolean; chat_locked_message: string; slow_mode_seconds: number } | null>(null)
  const [slowLeft, setSlowLeft] = useState(0)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [selectedSpace, setSelectedSpace] = useState<string>("general")
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reactingTo, setReactingTo] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const spaceParam = selectedSpace !== "general" ? `&space_id=${selectedSpace}` : ""
      const res = await fetch(`/api/communities/${communityId}/chat?limit=100${spaceParam}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load chat")
      // The API embeds the profile as `author`; older rows/clients used `sender`.
      // Normalize so display names never fall back to "Unknown".
      setMessages(
        (data.messages || []).map((m: any) => ({ ...m, sender: m.sender || m.author || null })),
      )
      setMemberRoles(data.member_roles || {})
      setChatSettings(data.chat_settings || null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId, selectedSpace])

  useEffect(() => {
    load()
  }, [load])

  // Auto-scroll to bottom on new messages (unless the user scrolled up)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [messages])

  // Poll for new messages every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      load()
    }, 15000)
    return () => clearInterval(interval)
  }, [load])

  // Slow-mode local countdown for the input hint.
  useEffect(() => {
    if (slowLeft <= 0) return
    const t = setInterval(() => setSlowLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [slowLeft])

  const send = async () => {
    if (!input.trim() || sending) return
    if (chatSettings?.chat_locked) {
      setError(chatSettings.chat_locked_message)
      setTimeout(() => setError(""), 3000)
      return
    }
    setSending(true)
    try {
      const body: any = {
        content: input.trim(),
        space_id: selectedSpace !== "general" ? selectedSpace : undefined,
      }
      if (replyTo) {
        body.reply_to_id = replyTo.id
      }
      const res = await fetch(`/api/communities/${communityId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          { ...data.message, sender: data.message.sender || data.message.author || null },
        ])
      }
      setInput("")
      setReplyTo(null)
      inputRef.current?.focus()
      if ((chatSettings?.slow_mode_seconds || 0) > 0) setSlowLeft(chatSettings!.slow_mode_seconds)
    } catch (e: any) {
      setError(e.message)
      setTimeout(() => setError(""), 3000)
    } finally {
      setSending(false)
    }
  }

  const pickImage = async (file: File) => {
    if (!file) return
    setUploading(true)
    try {
      const uploaded = await uploadMediaFile(file, {
        type: file.type.startsWith("video") ? "video" : "image",
        folder: "community-chat",
        authHeaders: getAuthHeader(),
      })
      const res = await fetch(`/api/communities/${communityId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          content: input.trim() || "",
          media_url: uploaded.url,
          media_type: file.type.startsWith("video") ? "video" : "image",
          message_type: file.type.startsWith("video") ? "file" : "image",
          space_id: selectedSpace !== "general" ? selectedSpace : undefined,
          reply_to_id: replyTo?.id || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      if (data.message) setMessages((prev) => [...prev, { ...data.message, sender: data.message.sender || data.message.author || null }])
      setInput("")
      setReplyTo(null)
    } catch (e: any) {
      const raw = String(e?.message || "")
      const friendly = /author_id|profiles|foreign key/i.test(raw)
        ? "Your session expired — sign in again and retry."
        : /too large|maximum size/i.test(raw)
          ? raw
          : raw || "Try a smaller file or check your connection."
      toast({
        title: "Couldn't send that media",
        description: friendly,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const toggleReaction = async (msgId: string, emoji: string) => {
    setReactingTo(null)
    // Optimistic toggle
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m
        const current = m.reactions || {}
        const reactors = Array.isArray(current[emoji]) ? current[emoji] : []
        const has = user && reactors.includes(user.id)
        const next = { ...current }
        if (has) {
          const filtered = reactors.filter((uid) => uid !== user!.id)
          if (filtered.length) next[emoji] = filtered
          else delete next[emoji]
        } else {
          next[emoji] = [...reactors, user!.id]
        }
        return { ...m, reactions: next }
      }),
    )
    try {
      const res = await fetch(`/api/communities/${communityId}/chat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ message_id: msgId, emoji }),
      })
      if (!res.ok) throw new Error("failed")
      const data = await res.json()
      // Sync with server truth
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: data.reactions } : m)))
    } catch {
      load() // revert to server state on failure
    }
  }

  const deleteMessage = async (msgId: string) => {
    try {
      await fetch(`/api/messages/${msgId}`, { method: "DELETE", headers: getAuthHeader() })
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    } catch {
      toast({ title: "Couldn't delete message", description: "Try again in a moment.", variant: "destructive" })
    }
  }

  // Search filter — matches content or author name
  const filtered = useMemo(() => {
    if (!search.trim()) return messages
    const q = search.trim().toLowerCase()
    return messages.filter(
      (m) =>
        m.content?.toLowerCase().includes(q) ||
        m.sender?.display_name?.toLowerCase().includes(q) ||
        m.sender?.username?.toLowerCase().includes(q),
    )
  }, [messages, search])

  const grouped = groupMessagesByDate(filtered)

  return (
    <div className="flex flex-col h-full min-h-[520px] max-h-[720px] rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header: space tabs + search toggle */}
      <div className="border-b border-border/50">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setSelectedSpace("general")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition shrink-0",
                selectedSpace === "general"
                  ? "bg-indigo-500/15 text-indigo-500 border border-indigo-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
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
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowSearch((v) => !v)
              if (showSearch) setSearch("")
            }}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
              showSearch ? "bg-indigo-500/15 text-indigo-500" : "text-muted-foreground hover:bg-muted/50",
            )}
            title="Search messages"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
        {showSearch && (
          <div className="px-4 pb-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this conversation…"
              className="h-8 rounded-full bg-muted/50 text-xs"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scroll-smooth">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner className="h-5 w-5 text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No messages match your search" : "No messages yet"}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {search ? "Try a different term." : "Say hi, share an image, or react to friends."}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] font-medium text-muted-foreground shrink-0">{group.date}</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {group.messages.map((msg) => {
                const isOwn = msg.author_id === user?.id
                const canDelete = isOwn || canModerate
                const sender = msg.sender
                const reactions = msg.reactions && typeof msg.reactions === "object" ? msg.reactions : {}
                const reactionEntries = Object.entries(reactions).filter(([, uids]) => (uids as string[]).length > 0)

                return (
                  <div key={msg.id} className={cn("group relative flex items-start gap-2 py-1.5 rounded-lg px-2 -mx-2 transition", isOwn ? "hover:bg-indigo-500/5" : "hover:bg-muted/30")}>
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarImage src={sender?.avatar_url || ""} />
                      <AvatarFallback className="text-[10px] bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
                        {sender?.display_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-sm font-semibold truncate", isOwn && "text-indigo-500")}>
                          {sender?.display_name || sender?.username || "Unknown"}
                        </span>
                        <UserBadges
                          is_verified={sender?.is_verified}
                          is_team_member={sender?.is_team_member}
                          is_sponsor={sender?.is_sponsor}
                          is_organization={sender?.is_organization}
                          is_premium={sender?.is_premium}
                          badge={sender?.badge_id ? badges[sender.badge_id] || null : null}
                          size="sm"
                        />
                        {(() => {
                          const mr = memberRoles[msg.author_id]
                          const label = mr?.custom_role_name || (mr?.role && mr.role !== "member" ? mr.role.charAt(0).toUpperCase() + mr.role.slice(1) : null)
                          if (!label) return null
                          return (
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white/95 shrink-0 leading-tight"
                              style={{ background: mr?.gradient || "rgba(120,120,150,0.35)" }}
                            >
                              {label}
                            </span>
                          )
                        })()}
                        <span className="text-[10px] text-muted-foreground shrink-0">{messageTime(msg.created_at)}</span>
                      </div>

                      {/* Quoted reply preview */}
                      {msg.reply_to && (
                        <div className="mt-0.5 mb-1 flex items-center gap-1.5 rounded-lg border-l-2 border-indigo-400/60 bg-muted/40 px-2 py-1">
                          <span className="text-[10px] font-semibold text-indigo-500 shrink-0">
                            {msg.reply_to.author?.display_name || "Member"}
                          </span>
                          <span className="truncate text-[10px] text-muted-foreground">
                            {msg.reply_to.content?.slice(0, 80) || (msg.reply_to.media_url ? "📷 Media" : "")}
                          </span>
                        </div>
                      )}

                      {msg.content && (
                        <p className={cn("text-sm leading-relaxed break-words whitespace-pre-wrap", isOwn ? "text-foreground" : "text-foreground/90")}>
                          {msg.content}
                        </p>
                      )}
                      {msg.media_url && (msg.message_type === "image" || msg.media_type === "image") && (
                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.media_url}
                            alt="Shared media"
                            className="mt-1 max-h-64 rounded-xl object-cover border border-border/50 transition hover:opacity-95"
                            loading="lazy"
                          />
                        </a>
                      )}
                      {msg.media_url && (msg.message_type === "file" || msg.media_type === "video") && (
                        <video
                          src={msg.media_url}
                          controls
                          playsInline
                          preload="metadata"
                          className="mt-1 max-h-72 w-full max-w-sm rounded-xl bg-black object-contain border border-border/50"
                        />
                      )}
                      {msg.media_url && msg.message_type !== "image" && msg.media_type !== "image" && msg.message_type !== "file" && msg.media_type !== "video" && (
                        <a
                          href={msg.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:underline"
                        >
                          📎 {msg.message_type === "gif" ? "GIF" : "Attachment"}
                        </a>
                      )}
                      {msg.is_edited && <span className="text-[10px] text-muted-foreground/60">(edited)</span>}

                      {/* Reaction chips */}
                      {reactionEntries.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {reactionEntries.map(([emoji, uids]) => {
                            const mine = user && (uids as string[]).includes(user.id)
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={cn(
                                  "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition",
                                  mine
                                    ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-500"
                                    : "border-border bg-muted/50 text-muted-foreground hover:border-indigo-500/40",
                                )}
                                title={(uids as string[]).length + " reacted"}
                              >
                                <span className="text-[11px] leading-none">{emoji}</span>
                                {(uids as string[]).length > 1 && <span>{(uids as string[]).length}</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Hover actions */}
                    <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 shrink-0 mt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                        title="React"
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setReplyTo(msg)
                          inputRef.current?.focus()
                        }}
                        title="Reply"
                      >
                        <Reply className="h-3 w-3" />
                      </Button>
                      {canDelete && (
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

                    {/* Reaction picker */}
                    {reactingTo === msg.id && (
                      <div className="absolute right-2 top-8 z-20 flex items-center gap-0.5 rounded-full border border-border bg-popover px-1.5 py-1 shadow-lg">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="rounded-full p-1 text-base leading-none transition hover:scale-125 hover:bg-muted"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
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
            {replyTo.content?.slice(0, 60) || (replyTo.media_url ? "Media" : "")}
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReplyTo(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="mx-4 mb-2 flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-2">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setInput((prev) => prev + emoji)
                inputRef.current?.focus()
              }}
              className="rounded-lg p-1.5 text-lg leading-none transition hover:scale-110 hover:bg-muted"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Locked banner — replaces the composer for non-staff when locked */}
      {chatSettings?.chat_locked ? (
        <div className="px-4 py-3 border-t border-border/50">
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 border border-border/50 px-3 py-2.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="truncate">{chatSettings.chat_locked_message}</span>
          </div>
        </div>
      ) : (
      <div className="px-4 py-3 border-t border-border/50">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pickImage(f)
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-indigo-500"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Send an image"
          >
            {uploading ? <Spinner className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-amber-500"
            onClick={() => setShowEmoji((v) => !v)}
            title="Emoji"
          >
            <Smile className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              slowLeft > 0
                ? `Slow mode — wait ${slowLeft}s`
                : replyTo
                  ? `Reply to ${replyTo.sender?.display_name}...`
                  : "Type a message..."
            }
            className="flex-1 rounded-xl bg-muted/50 border-border/50 text-sm h-10"
            disabled={sending || slowLeft > 0}
            maxLength={5000}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sending}
            className="h-10 w-10 rounded-xl shrink-0 bg-indigo-500 hover:bg-indigo-600"
          >
            {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
      )}
    </div>
  )
}
