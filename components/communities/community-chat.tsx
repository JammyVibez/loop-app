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

/** Long-press delay before a touch reveals a message's action bar. */
const LONG_PRESS_MS = 380
/** Consecutive messages from one author inside this window form one block. */
const GROUP_WINDOW_MS = 5 * 60 * 1000

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
  /** Message whose action bar / reaction picker a long-press revealed. */
  const [activeActionsId, setActiveActionsId] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
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
  // Flat index so each message can look at its true neighbours when deciding
  // whether it starts/ends a run from the same author.
  const flatIndex = new Map<string, number>()
  filtered.forEach((m, i) => flatIndex.set(m.id, i))

  return (
    <div className="flex h-full min-h-[520px] max-h-[720px] flex-col overflow-hidden rounded-3xl border border-border/30 bg-background/40 backdrop-blur-xl">
      {/* Header: space tabs + search toggle */}
      <div className="border-b border-border/30">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setSelectedSpace("general")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition shrink-0",
                selectedSpace === "general"
                  ? "bg-indigo-500/15 text-indigo-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
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
                    ? "bg-indigo-500/15 text-indigo-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
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
              showSearch ? "bg-indigo-500/15 text-indigo-500" : "text-muted-foreground hover:bg-foreground/[0.06]",
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
              className="h-8 rounded-full border-0 bg-foreground/[0.05] text-xs"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth px-3 py-4 sm:px-4">
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
              <div className="flex justify-center py-3">
                <span className="rounded-full bg-foreground/[0.05] px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">{group.date}</span>
              </div>

              {group.messages.map((msg) => {
                const isOwn = msg.author_id === user?.id
                const canDelete = isOwn || canModerate
                const sender = msg.sender
                const reactions = msg.reactions && typeof msg.reactions === "object" ? msg.reactions : {}
                const reactionEntries = Object.entries(reactions).filter(([, uids]) => (uids as string[]).length > 0)
                // Runs of consecutive messages from the same author are visually
                // grouped: tighter spacing, a single name header, and the avatar
                // plus timestamp only on the last message of the run.
                const idx = flatIndex.get(msg.id) ?? 0
                const prevMsg = filtered[idx - 1]
                const nextMsg = filtered[idx + 1]
                const sameAuthorAsPrev =
                  Boolean(prevMsg) &&
                  prevMsg!.author_id === msg.author_id &&
                  !prevMsg!.is_deleted &&
                  new Date(msg.created_at).getTime() - new Date(prevMsg!.created_at).getTime() < GROUP_WINDOW_MS
                const sameAuthorAsNext =
                  Boolean(nextMsg) &&
                  nextMsg!.author_id === msg.author_id &&
                  !msg.is_deleted &&
                  new Date(nextMsg!.created_at).getTime() - new Date(msg.created_at).getTime() < GROUP_WINDOW_MS
                const isFirstOfGroup = !sameAuthorAsPrev
                const isLastOfGroup = !sameAuthorAsNext
                const actionsOpen = activeActionsId === msg.id
                const revealMeta = isLastOfGroup || actionsOpen

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "group relative flex w-full min-w-0 gap-2",
                      isOwn ? "justify-end" : "justify-start",
                      isFirstOfGroup ? "mt-3" : "mt-[3px]",
                    )}
                    onClick={() => setActiveActionsId(null)}
                    onContextMenu={(e) => {
                      // Touch devices: a long-press reveals the actions instead of
                      // the native menu. Desktop keeps right-click for copy.
                      if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) {
                        e.preventDefault()
                        setActiveActionsId(msg.id)
                      }
                    }}
                    onTouchStart={() => {
                      cancelLongPress()
                      longPressTimer.current = setTimeout(() => setActiveActionsId(msg.id), LONG_PRESS_MS)
                    }}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                  >
                    {/* Avatar gutter — bottom aligned, only on the last message of a run */}
                    {!isOwn && (
                      <div className="w-7 shrink-0 self-end">
                        {isLastOfGroup && (
                          <Avatar className="h-7 w-7 ring-1 ring-border/40">
                            <AvatarImage src={sender?.avatar_url || ""} />
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-[10px] text-white">
                              {sender?.display_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}
                    <div className="min-w-0 max-w-[min(85%,calc(100vw-3rem))] sm:max-w-[min(72%,calc(100vw-4rem))]">
                      {/* Your own messages don't repeat your name above the bubble */}
                      {isFirstOfGroup && !isOwn && (
                        <div className="mb-0.5 flex items-center gap-1.5">
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
                        </div>
                      )}

                      <div
                        className={cn(
                          "chat-bubble relative break-words [overflow-wrap:anywhere] px-3.5 py-2.5 text-[15px] leading-relaxed shadow-sm",
                          isOwn
                            ? cn(
                                "chat-bubble-mine bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-950/20",
                                isLastOfGroup ? "rounded-[20px] rounded-br-[7px]" : "rounded-[20px]",
                              )
                            : cn(
                                "chat-bubble-peer bg-slate-100 text-slate-900 ring-1 ring-inset ring-black/[0.04] dark:bg-slate-800 dark:text-slate-50 dark:ring-white/[0.06]",
                                isLastOfGroup ? "rounded-[20px] rounded-bl-[7px]" : "rounded-[20px]",
                              ),
                        )}
                      >
                      {/* Quoted reply preview */}
                      {msg.reply_to && (
                        <div className={cn("mb-1.5 flex items-center gap-1.5 rounded-xl border-l-2 border-indigo-400/70 px-2 py-1", isOwn ? "bg-white/10" : "bg-background/50")}>
                          <span className={cn("shrink-0 text-[10px] font-semibold", isOwn ? "text-white/90" : "text-indigo-500")}>
                            {msg.reply_to.author?.display_name || "Member"}
                          </span>
                          <span className={cn("truncate text-[10px]", isOwn ? "text-white/70" : "text-muted-foreground")}>
                            {msg.reply_to.content?.slice(0, 80) || (msg.reply_to.media_url ? "📷 Media" : "")}
                          </span>
                        </div>
                      )}

                      {msg.content && (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </p>
                      )}
                      {msg.media_url && (msg.message_type === "image" || msg.media_type === "image") && (
                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.media_url}
                            alt="Shared media"
                            className="mt-1 max-h-64 rounded-2xl object-cover ring-1 ring-inset ring-black/5 transition hover:opacity-95 dark:ring-white/10"
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
                          className="mt-1 max-h-72 w-full max-w-sm rounded-2xl bg-black object-contain ring-1 ring-inset ring-black/10 dark:ring-white/10"
                        />
                      )}
                      {msg.media_url && msg.message_type !== "image" && msg.media_type !== "image" && msg.message_type !== "file" && msg.media_type !== "video" && (
                        <a
                          href={msg.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn("mt-1 inline-flex items-center gap-1.5 text-xs hover:underline", isOwn ? "text-white/90" : "text-indigo-500")}
                        >
                          📎 {msg.message_type === "gif" ? "GIF" : "Attachment"}
                        </a>
                      )}
                      {/* Reaction chips */}
                      {reactionEntries.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {reactionEntries.map(([emoji, uids]) => {
                            const mine = user && (uids as string[]).includes(user.id)
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={cn(
                                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset transition active:scale-95",
                                  mine
                                    ? (isOwn ? "bg-white/20 text-white ring-white/25" : "bg-indigo-500/15 text-indigo-500 ring-indigo-500/30")
                                    : (isOwn ? "bg-white/10 text-white/80 ring-white/15" : "bg-foreground/[0.06] text-muted-foreground ring-border/40 hover:text-foreground"),
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

                      {revealMeta && (
                        <div className={cn("mt-1 flex items-center gap-1 text-[10px] leading-none opacity-60", isOwn ? "justify-end" : "justify-start")}>
                          <span className="tabular-nums">{messageTime(msg.created_at)}</span>
                          {msg.is_edited && <span className="italic">edited</span>}
                        </div>
                      )}
                    </div>

                    {/* Actions — hidden until long-press (mobile) or hover (desktop) */}
                    <div
                      className={cn(
                        "mt-0.5 flex shrink-0 items-center gap-0.5 self-start transition-opacity duration-150",
                        actionsOpen
                          ? "opacity-100"
                          : "pointer-events-none opacity-0 sm:pointer-events-auto sm:group-hover:opacity-100",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-muted-foreground hover:bg-foreground/[0.06]"
                        onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                        title="React"
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-muted-foreground hover:bg-foreground/[0.06]"
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
                          className="h-7 w-7 rounded-full text-red-500 hover:bg-red-500/10 hover:text-red-600"
                          onClick={() => deleteMessage(msg.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {/* Reaction picker */}
                    {reactingTo === msg.id && (
                      <div className={cn("absolute top-full z-20 mt-1 flex items-center gap-0.5 rounded-2xl bg-popover/95 px-1.5 py-1 shadow-xl ring-1 ring-border/40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150", isOwn ? "right-0" : "left-0")}>
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
        <div className="mx-2 mb-1 flex items-center gap-2 rounded-2xl border-l-2 border-indigo-500 bg-foreground/[0.05] px-3 py-2 text-xs backdrop-blur-xl sm:mx-3">
          <Reply className="h-3 w-3 shrink-0 text-indigo-500" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
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
        <div className="mx-2 mb-2 flex flex-wrap gap-1 rounded-2xl bg-foreground/[0.05] p-2 ring-1 ring-inset ring-border/40 sm:mx-3">
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
        <div className="mx-2 mb-2 rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-500 ring-1 ring-inset ring-rose-500/20 sm:mx-3">
          {error}
        </div>
      )}

      {/* Locked banner — replaces the composer for non-staff when locked */}
      {chatSettings?.chat_locked ? (
        <div className="border-t border-border/30 px-2 py-3 sm:px-3">
          <div className="flex items-center justify-center gap-2 rounded-full bg-foreground/[0.05] px-4 py-2.5 text-xs text-muted-foreground ring-1 ring-inset ring-border/40">
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="truncate">{chatSettings.chat_locked_message}</span>
          </div>
        </div>
      ) : (
      <div className="border-t border-border/30 bg-background/50 px-2 py-2.5 backdrop-blur-2xl sm:px-3">
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
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-500"
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
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
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
            className="h-10 flex-1 rounded-full border-0 bg-foreground/[0.05] px-4 text-sm focus-visible:ring-1 focus-visible:ring-violet-500/40"
            disabled={sending || slowLeft > 0}
            maxLength={5000}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sending}
            className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-600/20 hover:from-violet-400 hover:to-purple-500"
          >
            {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
      )}
    </div>
  )
}
