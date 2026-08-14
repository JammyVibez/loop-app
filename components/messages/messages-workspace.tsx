"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { GiftModal } from "@/components/gifting/gift-modal"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { ForwardDialog } from "@/components/messages/forward-dialog"
import { cn } from "@/lib/utils"
import { uploadMediaFile } from "@/lib/client-media-upload"
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Copy,
  CornerUpRight,
  ExternalLink,
  GitBranch,
  Gift,
  ImageIcon,
  Loader2,
  Lock,
  Mic,
  MicOff,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Reply,
  Search,
  Send,
  Smile,
  Sparkles,
  Film,
  Trash2,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  subscribeToPush,
  subscriptionToJSON,
  unsubscribeFromPush,
} from "@/lib/push-client"

interface Conversation {
  id: string
  is_group?: boolean
  name?: string | null
  other_user?: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
  } | null
  last_message?: {
    content?: string
    created_at?: string
    message_type?: string
    sender_id?: string
    author_id?: string
  } | null
  unread_count?: number
}

interface ChatMessage {
  id: string
  content: string
  sender_id?: string
  author_id?: string
  created_at: string
  edited_at?: string | null
  is_deleted?: boolean
  media_url?: string | null
  media_type?: string | null
  message_type?: string
  reply_to_id?: string | null
  reply_to?: {
    id: string
    content?: string
    sender_id?: string
    author_id?: string
    sender?: { display_name?: string; username?: string } | null
  } | null
  reactions?: Array<{ emoji: string; count: number; users?: string[] }>
  sender?: {
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string
  } | null
  /** When this message was forwarded from another chat. */
  forwarded_from?: string | null
  forwarded_message_id?: string | null
}

const QUICK_REACTIONS = ["❤️", "😂", "👍", "🔥", "😮", "👏"]

const EMOJI_GRID = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤩", "🥳",
  "😢", "😭", "😤", "😡", "🥺", "😳", "🤔", "🙄", "😴", "🤯",
  "👍", "👎", "👏", "🙏", "🤝", "💪", "👌", "✌️", "🤞", "👋",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "💯", "🔥",
  "✨", "🎉", "🎊", "🎁", "🏆", "⭐", "🌟", "🌈", "☀️", "🌙",
  "🐶", "🐱", "🦊", "🐼", "🐸", "🦋", "🌸", "🌹", "🍕", "🍔",
  "⚽", "🏀", "🎮", "🎵", "📸", "💡", "💰", "💎", "🚀", "✈️",
] as const

const AVATAR_COLORS = [
  "bg-emerald-600", "bg-sky-600", "bg-violet-600", "bg-rose-600",
  "bg-amber-600", "bg-teal-600", "bg-indigo-600", "bg-pink-600",
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function convoTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  const diffDays = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  )
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" })
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
}

export function MessagesWorkspace() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkId = searchParams.get("c")
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId)
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(deepLinkId))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [draft, setDraft] = useState("")
  const [search, setSearch] = useState("")
  const [chatSearch, setChatSearch] = useState("")
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null)
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null)
  const [forwardingTo, setForwardingTo] = useState<string | null>(null)
  const [typingPeer, setTypingPeer] = useState(false)
  const [peerOnline, setPeerOnline] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [showGift, setShowGift] = useState(false)
  const [showCoLoop, setShowCoLoop] = useState(false)
  const [coLoopDraft, setCoLoopDraft] = useState("")
  const [coLoopPeerDraft, setCoLoopPeerDraft] = useState("")
  const [publishingCoLoop, setPublishingCoLoop] = useState(false)
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null)
  const [freshMessageIds, setFreshMessageIds] = useState<Set<string>>(new Set())
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifResults, setGifResults] = useState<any[]>([])
  const [gifSearch, setGifSearch] = useState("")
  const [gifsLoading, setGifsLoading] = useState(false)
  const gifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null)
  const [pushToggling, setPushToggling] = useState(false)
  const [pushBanner, setPushBanner] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerTypingClear = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | null>(null)
  const loadReq = useRef(0)
  const selectedIdRef = useRef<string | null>(selectedId)
  selectedIdRef.current = selectedId

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  )

  const filteredMessages = useMemo(() => {
    const q = chatSearch.trim().toLowerCase()
    if (!q) return messages
    return messages.filter((m) => m.content?.toLowerCase().includes(q))
  }, [messages, chatSearch])

  const loadConversations = async () => {
    if (!user) return
    setLoading(true)
    try {
      const response = await fetch("/api/conversations", { headers: getAuthHeader() })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load conversations")
      const list: Conversation[] = data.conversations || []
      setConversations(list)
      const counts: Record<string, number> = {}
      for (const c of list) if (c.unread_count) counts[c.id] = c.unread_count
      setUnreadCounts(counts)
      if (
        !selectedIdRef.current &&
        list[0]?.id &&
        typeof window !== "undefined" &&
        window.innerWidth >= 1024
      ) {
        const id = list[0].id
        setSelectedId(id)
        setMobileShowChat(true)
        router.replace(`/messages?c=${id}`, { scroll: false })
      }
    } catch (error: any) {
      toast({ title: "Chat unavailable", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    if (!user) return
    const req = ++loadReq.current
    setMessagesLoading(true)
    try {
      const response = await fetch(`/api/messages?conversation_id=${conversationId}`, {
        headers: getAuthHeader(),
      })
      const data = await response.json()
      if (req !== loadReq.current || selectedIdRef.current !== conversationId) return
      if (!response.ok) throw new Error(data.error || "Failed to load messages")
      const list: ChatMessage[] = data.messages || []
      const byId = new Map(list.map((m) => [m.id, m]))
      setMessages(
        list.map((m) => ({
          ...m,
          reply_to: m.reply_to || (m.reply_to_id ? byId.get(m.reply_to_id) || null : null),
          reactions: Array.isArray(m.reactions) ? m.reactions : [],
        })),
      )
    } catch (error: any) {
      if (req !== loadReq.current) return
      toast({ title: "Messages unavailable", description: error.message, variant: "destructive" })
    } finally {
      if (req === loadReq.current) setMessagesLoading(false)
    }
  }

  useEffect(() => {
    void loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Keep deep link ?c= in sync with Next search params
  useEffect(() => {
    if (deepLinkId) {
      setSelectedId(deepLinkId)
      setMobileShowChat(true)
    }
  }, [deepLinkId])

  useEffect(() => {
    if (!selectedId || !user) return
    setMessages([])
    setTypingPeer(false)
    setPeerOnline(false)
    setPeerReadAt(null)
    setFreshMessageIds(new Set())
    setReplyTo(null)
    void loadMessages(selectedId)

    const supabase = getSupabaseBrowserClient()
    const channel = supabase.channel(`conversation:${selectedId}`, {
      config: { broadcast: { self: false } },
    })
    channelRef.current = channel

    channel
      .on("broadcast", { event: "new_message" }, ({ payload }: { payload: any }) => {
        if (!payload?.id || selectedIdRef.current !== selectedId) return
        setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]))
        markFresh(payload.id)
        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === selectedId
                ? { ...c, last_message: { content: payload.content, created_at: payload.created_at } }
                : c,
            )
            .sort((a, b) => (b.last_message?.created_at || "").localeCompare(a.last_message?.created_at || "")),
        )
        // The peer's window is open and receiving this live, so it's
        // effectively seen — mark it read and let them know.
        void fetch("/api/messages/unread-count", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ conversation_id: selectedId }),
        }).catch(() => {})
        clearUnread(selectedId)
        void channelRef.current?.send({
          type: "broadcast",
          event: "read",
          payload: { user_id: user.id, read_at: new Date().toISOString() },
        })
      })
      .on("broadcast", { event: "typing" }, ({ payload }: { payload: any }) => {
        if (payload?.user_id && payload.user_id !== user.id) {
          setTypingPeer(true)
          if (peerTypingClear.current) clearTimeout(peerTypingClear.current)
          peerTypingClear.current = setTimeout(() => setTypingPeer(false), 2500)
        }
      })
      .on("broadcast", { event: "presence" }, ({ payload }: { payload: any }) => {
        if (payload?.user_id && payload.user_id !== user.id) {
          setPeerOnline(Boolean(payload.online))
        }
      })
      .on("broadcast", { event: "read" }, ({ payload }: { payload: any }) => {
        if (payload?.user_id && payload.user_id !== user.id && payload?.read_at) {
          setPeerReadAt(payload.read_at)
        }
      })
      .on("broadcast", { event: "message_edited" }, ({ payload }: { payload: any }) => {
        if (!payload?.id || selectedIdRef.current !== selectedId) return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.id
              ? { ...m, content: String(payload.content ?? m.content), edited_at: payload.edited_at || m.edited_at }
              : m,
          ),
        )
      })
      .on("broadcast", { event: "message_deleted" }, ({ payload }: { payload: any }) => {
        if (!payload?.id || selectedIdRef.current !== selectedId) return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.id ? { ...m, is_deleted: true, content: "", media_url: null } : m,
          ),
        )
      })
      .on("broadcast", { event: "reaction" }, () => {
        if (selectedIdRef.current === selectedId) void loadMessages(selectedId)
      })
      .on("broadcast", { event: "coloop" }, ({ payload }: { payload: any }) => {
        if (!payload || payload.user_id === user.id) return
        setCoLoopPeerDraft(String(payload.content || ""))
        setShowCoLoop(true)
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` },
        () => {
          if (selectedIdRef.current === selectedId) void loadMessages(selectedId)
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          void channel.send({
            type: "broadcast",
            event: "presence",
            payload: { user_id: user.id, online: true },
          })
          // Opening this conversation reads everything the peer has sent so
          // far — mark it read server-side and tell them live.
          void fetch("/api/messages/unread-count", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify({ conversation_id: selectedId }),
          }).catch(() => {})
          clearUnread(selectedId)
          void channel.send({
            type: "broadcast",
            event: "read",
            payload: { user_id: user.id, read_at: new Date().toISOString() },
          })
        }
      })

    const heartbeat = setInterval(() => {
      void channelRef.current?.send({
        type: "broadcast",
        event: "presence",
        payload: { user_id: user.id, online: true },
      })
    }, 20000)

    return () => {
      clearInterval(heartbeat)
      void channel.send({
        type: "broadcast",
        event: "presence",
        payload: { user_id: user.id, online: false },
      })
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, typingPeer])

  const markFresh = (id: string) => {
    setFreshMessageIds((prev) => new Set(prev).add(id))
    window.setTimeout(() => {
      setFreshMessageIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 1200)
  }

  const clearUnread = (id: string) => {
    setUnreadCounts((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const broadcastTyping = () => {
    if (!user) return
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id },
    })
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(broadcastTyping, 250)
  }

  const openConversation = (id: string) => {
    setSelectedId(id)
    setMobileShowChat(true)
    setReplyTo(null)
    setShowCoLoop(false)
    setCoLoopDraft("")
    setCoLoopPeerDraft("")
    clearUnread(id)
    router.replace(`/messages?c=${id}`, { scroll: false })
  }

  const backToInbox = () => {
    setMobileShowChat(false)
    setSelectedId(null)
    setReplyTo(null)
    setMessages([])
    router.replace("/messages", { scroll: false })
  }

  const sendMessage = async (opts?: { content?: string; media_url?: string; message_type?: string }) => {
    if (!user || !selectedId || sending) return
    const content = (opts?.content ?? draft).trim()
    const mediaUrl = opts?.media_url
    if (!content && !mediaUrl) return

    setSending(true)
    if (!opts?.media_url) setDraft("")
    const replySnapshot = replyTo
    setReplyTo(null)
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          conversation_id: selectedId,
          content,
          media_url: mediaUrl,
          message_type: opts?.message_type || (mediaUrl ? "image" : "text"),
          reply_to_id: replySnapshot?.id || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to send")
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]))
      markFresh(data.message.id)
      // Peer delivery via postgres_changes; also nudge broadcast channel for same-tab peers
      void channelRef.current?.send({
        type: "broadcast",
        event: "new_message",
        payload: data.message,
      })
    } catch (error: any) {
      if (!opts?.media_url) setDraft(content)
      setReplyTo(replySnapshot)
      toast({ title: "Send failed", description: error.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const uploadAndSend = async (file: File, messageType: string) => {
    if (!user) return
    setUploading(true)
    try {
      // Video/audio (and anything over ~3.5MB) go straight to Cloudinary via
      // a signed direct upload instead of through /api/upload — bundling a
      // larger file into the Next.js API request could exceed Vercel's
      // request body limit and return a non-JSON error page, which the old
      // raw `.json()` call here would throw on instead of a clear message.
      const uploadType = messageType === "audio" || messageType === "video" ? (messageType as "audio" | "video") : messageType === "image" ? "image" : "file"
      const uploaded = await uploadMediaFile(file, {
        type: uploadType,
        folder: "messages",
        authHeaders: getAuthHeader(),
      })
      await sendMessage({
        content: messageType === "audio" ? "Voice note" : "",
        media_url: uploaded.url,
        message_type: messageType,
      })
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!user) return
    const existing = (message.reactions || []).find((r) => r.emoji === emoji)
    const reacted = existing?.users?.includes(user.id)
    const snapshot = message.reactions || []
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message.id) return m
        const reactions = [...(m.reactions || [])]
        const idx = reactions.findIndex((r) => r.emoji === emoji)
        if (reacted && idx >= 0) {
          const users = (reactions[idx].users || []).filter((id) => id !== user.id)
          if (!users.length) reactions.splice(idx, 1)
          else reactions[idx] = { ...reactions[idx], users, count: users.length }
        } else if (idx >= 0) {
          const users = Array.from(new Set([...(reactions[idx].users || []), user.id]))
          reactions[idx] = { emoji, users, count: users.length }
        } else {
          reactions.push({ emoji, count: 1, users: [user.id] })
        }
        return { ...m, reactions }
      }),
    )
    try {
      const response = await fetch("/api/messages/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ message_id: message.id, emoji, action: reacted ? "remove" : "add" }),
      })
      if (!response.ok) throw new Error("Reaction failed")
      void channelRef.current?.send({
        type: "broadcast",
        event: "reaction",
        payload: { message_id: message.id, emoji },
      })
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions: snapshot } : m)))
      toast({ title: "Couldn’t react", variant: "destructive" })
    }
  }

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" })
        await uploadAndSend(file, "audio")
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      toast({ title: "Microphone blocked", description: "Allow mic access to send voice notes.", variant: "destructive" })
    }
  }

  const stopVoice = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  const loadGifs = async (query: string) => {
    setGifsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      params.set("limit", "18")
      const res = await fetch(`/api/gifs?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("GIF fetch failed")
      const data = await res.json()
      if (data?.success && Array.isArray(data.results)) {
        setGifResults(data.results)
      }
    } catch (error) {
      console.error("GIF fetch error:", error)
    } finally {
      setGifsLoading(false)
    }
  }

  const insertEmoji = (emoji: string) => {
    setDraft((prev) => `${prev}${emoji}`)
    setShowEmojiPicker(false)
    typingTimer.current && clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(broadcastTyping, 250)
  }

  const copyMessage = async (message: ChatMessage) => {
    const text = message.content || ""
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied to clipboard" })
    } catch {
      toast({ title: "Couldn’t copy", variant: "destructive" })
    }
  }

  const startEdit = (message: ChatMessage) => {
    setEditDraft(message.content || "")
    setEditingMessage(message)
    setReplyTo(null)
    setDeletingMessage(null)
    setForwardTarget(null)
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    setEditDraft("")
  }

  const saveEdit = async () => {
    if (!editingMessage || !user || savingEdit) return
    const content = editDraft.trim()
    if (!content) {
      toast({ title: "Message can’t be empty", variant: "destructive" })
      return
    }
    const target = editingMessage
    setSavingEdit(true)
    try {
      const response = await fetch(`/api/messages/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Edit failed")
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message.id ? { ...m, content: data.message.content, edited_at: data.message.edited_at } : m,
        ),
      )
      toast({ title: "Message updated" })
    } catch (error: any) {
      toast({ title: "Couldn’t edit message", description: error.message, variant: "destructive" })
    } finally {
      setSavingEdit(false)
      cancelEdit()
    }
  }

  const requestDelete = (message: ChatMessage) => {
    setDeletingMessage(message)
    setEditingMessage(null)
    setForwardTarget(null)
  }

  const confirmDelete = async () => {
    if (!deletingMessage || !user) return
    const target = deletingMessage
    setDeletingMessage(null)
    try {
      const response = await fetch(`/api/messages/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Delete failed")
      setMessages((prev) =>
        prev.map((m) => (m.id === target.id ? { ...m, is_deleted: true, content: "", media_url: null } : m)),
      )
      toast({ title: "Message deleted" })
    } catch (error: any) {
      toast({ title: "Couldn’t delete message", description: error.message, variant: "destructive" })
    }
  }

  const forwardMessage = (message: ChatMessage) => {
    setForwardTarget(message)
    setEditingMessage(null)
    setDeletingMessage(null)
  }

  const forwardDisplayName = (message: ChatMessage) => {
    if (message.sender?.display_name || message.sender?.username) {
      return message.sender.display_name || message.sender.username || "Someone"
    }
    if ((message.sender_id || message.author_id) === user?.id) return "You"
    return selected?.other_user?.display_name || selected?.other_user?.username || "Someone"
  }

  const confirmForward = async (conversationId: string) => {
    if (!forwardTarget || !user || forwardingTo) return
    const target = forwardTarget
    setForwardingTo(conversationId)
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: target.content || "",
          media_url: target.media_url || null,
          message_type: target.message_type || (target.media_url ? "image" : "text"),
          forwarded_from: forwardDisplayName(target),
          forwarded_message_id: target.id,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Forward failed")
      toast({ title: "Message forwarded", description: "The recipient can open it right in their chat." })
      setForwardTarget(null)
    } catch (error: any) {
      toast({ title: "Couldn’t forward", description: error.message, variant: "destructive" })
    } finally {
      setForwardingTo(null)
    }
  }

  /** Create (or reuse) a 1:1 chat with a username and forward the message there. */
  const forwardToNewUser = async (username: string) => {
    if (!forwardTarget || !user || forwardingTo) return
    try {
      const lookup = await fetch(`/api/users?q=${encodeURIComponent(username.replace(/^@/, ""))}&limit=8`, {
        headers: getAuthHeader(),
      })
      const data = await lookup.json()
      const target = (data.users || data.data || []).find((u: any) => u.id !== user.id)
      if (!target?.id) throw new Error("User not found — check the username")
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ participant_ids: [target.id] }),
      })
      const conv = await res.json()
      if (!res.ok) throw new Error(conv.error || "Could not start chat")
      await confirmForward(conv.conversation.id)
      await loadConversations()
    } catch (error: any) {
      toast({ title: "Couldn’t forward", description: error.message, variant: "destructive" })
    }
  }

  const refreshPushState = async () => {
    if (typeof window === "undefined") return
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setPushEnabled(false)
        return
      }
      const reg = await navigator.serviceWorker.ready.catch(() => null)
      const sub = await reg?.pushManager.getSubscription()
      const enabled = Boolean(sub) && Notification.permission === "granted"
      setPushEnabled(enabled)
      if (!enabled && Notification.permission === "default") {
        setPushBanner(true)
      }
    } catch {
      setPushEnabled(false)
    }
  }

  const togglePush = async () => {
    if (!user || pushToggling) return
    setPushToggling(true)
    try {
      if (pushEnabled) {
        const endpoint = await unsubscribeFromPush()
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify(endpoint ? { endpoint } : {}),
        })
        setPushEnabled(false)
        setPushBanner(false)
        toast({ title: "Notifications off for this device" })
      } else {
        const subscription = await subscribeToPush()
        if (!subscription) throw new Error("Browser did not return a push subscription")
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify(subscriptionToJSON(subscription)),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to save subscription")
        setPushEnabled(true)
        setPushBanner(false)
        toast({ title: "Notifications on", description: "You’ll get chat alerts even when Loop is in the background." })
      }
    } catch (err: any) {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setPushEnabled(false)
        toast({ title: "Notifications blocked", description: "Enable them in your browser’s site settings.", variant: "destructive" })
      } else {
        toast({ title: "Couldn’t toggle notifications", description: err.message, variant: "destructive" })
      }
    } finally {
      setPushToggling(false)
    }
  }

  useEffect(() => {
    void refreshPushState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const startChat = async () => {
    if (!user || !search.trim()) return
    setStarting(true)
    try {
      const lookup = await fetch(`/api/users?q=${encodeURIComponent(search.trim())}&limit=8`, {
        headers: getAuthHeader(),
      })
      let users: any[] = []
      if (lookup.ok) {
        const data = await lookup.json()
        users = data.users || data.data || []
      }
      if (!users.length) {
        const profileRes = await fetch(
          `/api/users/profile?username=${encodeURIComponent(search.replace(/^@/, "").trim())}`,
        )
        if (profileRes.ok) {
          const data = await profileRes.json()
          if (data.profile || data.user) users = [data.profile || data.user]
        }
      }
      const target = users.find((u) => u.id !== user.id) || users[0]
      if (!target?.id) throw new Error("User not found")

      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ participant_ids: [target.id] }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not start chat")
      setSearch("")
      await loadConversations()
      openConversation(data.conversation.id)
    } catch (error: any) {
      toast({ title: "Could not start chat", description: error.message, variant: "destructive" })
    } finally {
      setStarting(false)
    }
  }

  const syncCoLoop = (content: string) => {
    setCoLoopDraft(content)
    if (!user) return
    void channelRef.current?.send({
      type: "broadcast",
      event: "coloop",
      payload: { user_id: user.id, content },
    })
  }

  const publishCoLoop = async () => {
    if (!user || !selected) return
    const merged = [coLoopDraft.trim(), coLoopPeerDraft.trim()].filter(Boolean).join("\n\n")
    if (!merged) {
      toast({ title: "Write something first", variant: "destructive" })
      return
    }
    setPublishingCoLoop(true)
    try {
      const peer = selected.other_user
      const content = `${merged}\n\n— Co-Loop with @${peer?.username || "friend"}`
      const res = await fetch("/api/loops", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          content,
          hashtags: ["coloop", "collab"],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not publish")
      await sendMessage({
        content: `🌿 We published a Co-Loop together — open it on the feed.`,
      })
      setShowCoLoop(false)
      setCoLoopDraft("")
      setCoLoopPeerDraft("")
      toast({ title: "Co-Loop published", description: "Your shared draft is live on the feed." })
      if (data.loop?.id) window.open(`/loop/${data.loop.id}`, "_blank")
    } catch (error: any) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" })
    } finally {
      setPublishingCoLoop(false)
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Sign in to chat with other Loop users.</p>
        <Link href="/login" className="text-sky-500 hover:underline">
          Log in
        </Link>
      </div>
    )
  }

  const inbox = (
    <aside className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="space-y-3 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Chats</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              title={pushEnabled ? "Notifications on for this device — tap to mute" : "Turn on notifications for chats"}
              onClick={() => void togglePush()}
              disabled={pushToggling}
            >
              {pushToggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : pushEnabled ? (
                <Bell className="h-4 w-4 text-emerald-500" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {pushBanner && pushEnabled === false && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs text-foreground">
              <Bell className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              Get notified about new messages
            </p>
            <Button
              size="sm"
              className="h-7 rounded-full bg-emerald-600 px-3 text-xs hover:bg-emerald-500"
              onClick={() => void togglePush()}
              disabled={pushToggling}
            >
              Enable
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start new chat"
              className="rounded-full border-border bg-muted pl-9 text-foreground placeholder:text-muted-foreground"
              onKeyDown={(e) => e.key === "Enter" && void startChat()}
            />
          </div>
          <Button
            onClick={() => void startChat()}
            disabled={starting || !search.trim()}
            className="rounded-full bg-emerald-600 px-3 hover:bg-emerald-500"
            size="icon"
            title="Start new chat"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <span className="text-4xl">💬</span>
            <p>No chats yet. Search a username to message someone.</p>
          </div>
        ) : (
          conversations.map((conversation) => {
            const displayName = conversation.is_group
              ? conversation.name || "Group"
              : conversation.other_user?.display_name || `@${conversation.other_user?.username || "user"}`
            const last = conversation.last_message
            const unread = unreadCounts[conversation.id] || 0
            const lastMine = last?.sender_id === user.id || last?.author_id === user.id
            const preview = last
              ? last.message_type === "image"
                ? "📷 Photo"
                : last.message_type === "gif"
                  ? "🎞️ GIF"
                  : last.message_type === "video"
                    ? "🎬 Video"
                    : last.message_type === "audio"
                      ? "🎤 Voice message"
                      : last.content || "Message"
              : "Say hello 👋"
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => openConversation(conversation.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  selectedId === conversation.id && "bg-muted/70",
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={conversation.other_user?.avatar_url} />
                    <AvatarFallback className={cn("text-base font-semibold text-white", avatarColor(displayName))}>
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[15px] font-medium text-foreground">{displayName}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {last?.created_at ? convoTime(last.created_at) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-[13px]",
                        unread ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {lastMine && <span className="text-sky-500">You: </span>}
                      {preview}
                    </p>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )

  const chatPane = selected ? (
    <section className="relative flex h-full min-h-0 flex-col bg-background bg-[url('data:image/svg+xml,%3Csvg width%3D%2260%27 height%3D%2260%27 viewBox%3D%220 0 60 60%27 xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%3E%3Cg fill%3D%22none%22 fill-rule%3D%22evenodd%22%3E%3Cg fill%3D%22%23888888%22 fill-opacity%3D%220.05%22%3E%3Cpath d%3D%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]">
      <div className="flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2.5 shadow-sm backdrop-blur-sm sm:px-4">
        <Button variant="ghost" size="icon" className="text-foreground lg:hidden" onClick={backToInbox}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={selected.other_user?.avatar_url} />
            <AvatarFallback className={cn("text-sm font-semibold text-white", avatarColor(selected.other_user?.display_name || selected.name || "U"))}>
              {(selected.other_user?.display_name || selected.name || "U").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {peerOnline && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {selected.other_user?.display_name || selected.name || "Conversation"}
          </p>
          <p className="truncate text-[11px]">
            {typingPeer ? (
              <span className="text-emerald-600 dark:text-emerald-400">typing…</span>
            ) : peerOnline ? (
              <span className="text-emerald-600 dark:text-emerald-400">online</span>
            ) : selected.other_user?.username ? (
              <span className="text-muted-foreground">last seen recently</span>
            ) : (
              <span className="text-muted-foreground">group chat</span>
            )}
            {!typingPeer && !selected.is_group && selected.other_user?.display_name && (
              <span className="ml-1.5 text-muted-foreground/70">· 🔒 Only you and {selected.other_user.display_name} can see this conversation</span>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(pushEnabled ? "text-emerald-500" : "text-muted-foreground hover:text-foreground", "hidden sm:inline-flex")}
          title={pushEnabled ? "Notifications on — tap to mute this device" : "Turn on notifications for this chat"}
          onClick={() => void togglePush()}
          disabled={pushToggling}
        >
          {pushToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : pushEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
          title="Search in chat"
          onClick={() => setShowChatSearch((v) => !v)}
        >
          <Search className="h-4 w-4" />
        </Button>
        {selected.other_user?.username && (
          <Button variant="ghost" size="icon" className="hidden text-muted-foreground hover:text-foreground sm:inline-flex" title="View profile" asChild>
            <Link href={`/profile/${selected.other_user.username}`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-amber-500 dark:text-amber-300"
          title="Co-Loop — write a public loop together (unique to Loop)"
          onClick={() => setShowCoLoop((v) => !v)}
        >
          <GitBranch className="h-4 w-4" />
        </Button>
        {selected.other_user?.id && (
          <Button variant="ghost" size="icon" className="hidden text-pink-500 dark:text-pink-300 sm:inline-flex" onClick={() => setShowGift(true)}>
            <Gift className="h-4 w-4" />
          </Button>
        )}

        {/* Mobile-only overflow menu so the header never overflows on phones */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground sm:hidden" title="More options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setShowChatSearch((v) => !v)}>
              <Search className="h-4 w-4 mr-2" />
              Search in chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void togglePush()} disabled={pushToggling}>
              {pushEnabled ? <Bell className="h-4 w-4 mr-2 text-emerald-500" /> : <BellOff className="h-4 w-4 mr-2" />}
              {pushEnabled ? "Notifications on" : "Turn on notifications"}
            </DropdownMenuItem>
            {selected.other_user?.username && (
              <DropdownMenuItem asChild>
                <Link href={`/profile/${selected.other_user.username}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View profile
                </Link>
              </DropdownMenuItem>
            )}
            {selected.other_user?.id && (
              <DropdownMenuItem onClick={() => setShowGift(true)}>
                <Gift className="h-4 w-4 mr-2 text-pink-500" />
                Send gift
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showChatSearch && (
        <div className="border-b border-border bg-card px-3 py-2">
          <Input
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Search this chat…"
            className="border-border bg-muted text-foreground"
          />
        </div>
      )}

      {showCoLoop && (
        <div className="border-b border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-muted/40 to-emerald-500/10 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-300">
              <Sparkles className="h-4 w-4" />
              Co-Loop
              <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-100">
                Only on Loop
              </span>
            </p>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setShowCoLoop(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Write a public loop together in realtime — Instagram and X can’t co-author posts inside DMs.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Textarea
              value={coLoopDraft}
              onChange={(e) => syncCoLoop(e.target.value)}
              placeholder="Your half of the Co-Loop…"
              className="min-h-[88px] border-border bg-muted text-foreground"
            />
            <div className="rounded-md border border-dashed border-border bg-background p-3 text-sm text-muted-foreground">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Their live draft</p>
              {coLoopPeerDraft || <span className="text-muted-foreground">Waiting for them to type…</span>}
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              onClick={() => void publishCoLoop()}
              disabled={publishingCoLoop}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {publishingCoLoop ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}
              Publish Co-Loop
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
        {messagesLoading && messages.length === 0 ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : null}
        {filteredMessages.map((message, index) => {
          const mine = (message.sender_id || message.author_id) === user.id
          const isFresh = freshMessageIds.has(message.id)
          const seen = mine && Boolean(peerReadAt) && new Date(peerReadAt!) >= new Date(message.created_at)
          const prev = filteredMessages[index - 1]
          const showDate = !prev || dayLabel(prev.created_at) !== dayLabel(message.created_at)
          return (
            <Fragment key={message.id}>
              {showDate && (
                <div className="flex justify-center py-2">
                  <span className="rounded-full bg-background/85 px-3 py-1 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border">
                    {dayLabel(message.created_at)}
                  </span>
                </div>
              )}
              <div className={cn("group flex", mine ? "justify-end" : "justify-start", isFresh && "message-appear")}>

              <div className={cn("max-w-[85%] sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "chat-bubble relative rounded-2xl px-3 py-2 text-sm shadow-sm",
                    mine
                      ? "chat-bubble-mine rounded-br-md bg-emerald-600 text-white dark:bg-emerald-700"
                      : "chat-bubble-peer rounded-bl-md bg-muted text-foreground",
                    message.is_deleted &&
                      "chat-bubble-peer rounded-bl-md bg-muted/70 italic text-muted-foreground",
                  )}
                >
                  {message.is_deleted ? (
                    <p className="py-0.5 text-[13px] not-italic">🚫 Message deleted</p>
                  ) : (
                    <>
                      {message.forwarded_from && (
                        <p
                          className={cn(
                            "mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
                            mine ? "text-emerald-200/90" : "text-muted-foreground",
                          )}
                        >
                          <CornerUpRight className="h-3 w-3" />
                          Forwarded from {message.forwarded_from}
                        </p>
                      )}
                      {message.reply_to && (
                        <div
                          className={cn(
                            "mb-1.5 rounded-lg border-l-2 border-emerald-400/70 px-2 py-1 text-[11px]",
                            mine ? "bg-white/10" : "bg-muted/70",
                          )}
                        >
                          <p className="truncate font-semibold text-emerald-600 dark:text-emerald-300">
                            {message.reply_to.sender?.display_name ||
                              (message.reply_to.author_id === user.id
                                ? "You"
                                : selected.other_user?.display_name || "Reply")}
                          </p>
                          <p className="truncate text-muted-foreground">{message.reply_to.content || "Media"}</p>
                        </div>
                      )}
                      {message.media_url &&
                        (message.media_type === "image" ||
                          message.message_type === "image" ||
                          message.message_type === "gif") && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={message.media_url}
                            alt=""
                            className="mb-1 max-h-64 w-full rounded-lg object-cover"
                            loading="lazy"
                          />
                        )}
                      {message.media_url && (message.media_type === "audio" || message.message_type === "audio") && (
                        <audio controls src={message.media_url} className="mb-1 w-full max-w-[240px]" />
                      )}
                      {message.media_url && (message.media_type === "video" || message.message_type === "video") && (
                        <video controls src={message.media_url} className="mb-1 max-h-64 w-full rounded-lg" />
                      )}
                      {message.content && !(message.message_type === "audio" && message.content === "Voice note") && (
                        <RichContent
                          text={message.content}
                          className="whitespace-pre-wrap break-words"
                          as="p"
                          // Skip the auto link-preview card when the message already
                          // carries media — the video/image IS the content. This keeps
                          // shared reels from rendering a duplicate preview card.
                          showPreviewCard={!message.media_url}
                        />
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                        <span>
                          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {message.edited_at && <span className="italic">Edited</span>}
                        {mine &&
                          (seen ? (
                            <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-white/70" />
                          ))}
                      </div>
                    </>
                  )}
                </div>

                {(message.reactions?.length || 0) > 0 && (
                  <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
                    {message.reactions!.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={() => void toggleReaction(message, r.emoji)}
                        className="rounded-full bg-muted px-1.5 py-0.5 text-xs"
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={cn(
                    "mt-1 flex flex-wrap items-center gap-0.5 sm:gap-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  {!message.is_deleted && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5 text-muted-foreground sm:px-2"
                        onClick={() => setReplyTo(message)}
                        title="Reply"
                      >
                        <Reply className="mr-0 h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Reply</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5 text-muted-foreground sm:px-2"
                        onClick={() => void copyMessage(message)}
                        title="Copy"
                      >
                        <Copy className="mr-0 h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Copy</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5 text-muted-foreground sm:px-2"
                        onClick={() => forwardMessage(message)}
                        title="Forward"
                      >
                        <CornerUpRight className="mr-0 h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Forward</span>
                      </Button>
                      {mine && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-1.5 text-muted-foreground sm:px-2"
                            onClick={() => startEdit(message)}
                            title="Edit"
                          >
                            <Pencil className="mr-0 h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-1.5 text-muted-foreground hover:text-destructive sm:px-2"
                            onClick={() => requestDelete(message)}
                            title="Delete"
                          >
                            <Trash2 className="mr-0 h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="rounded-full px-1.5 text-sm hover:bg-muted"
                      onClick={() => void toggleReaction(message, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            </Fragment>
          )
        })}
        {typingPeer && (
          <div className="message-appear flex justify-start">
            <div className="chat-bubble chat-bubble-peer flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2 text-sm text-foreground">
          <div className="min-w-0">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Replying</p>
            <p className="truncate">{replyTo.content || "Media"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setReplyTo(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {editingMessage && (
        <div className="border-t border-border bg-card px-3 py-2 text-sm text-foreground">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Pencil className="h-3.5 w-3.5" />
              Editing message
            </p>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={cancelEdit}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={2}
              placeholder="Edit message…"
              className="min-h-[56px] flex-1 resize-none border-border bg-background px-3 py-2 text-sm text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void saveEdit()
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => void saveEdit()}
              disabled={savingEdit || !editDraft.trim()}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-500"
            >
              {savingEdit ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {deletingMessage && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-destructive/10 px-3 py-2 text-sm text-foreground">
          <p className="min-w-0 truncate text-xs font-medium">Delete this message for everyone?</p>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setDeletingMessage(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" className="h-8 rounded-full px-3 text-xs" onClick={() => void confirmDelete()}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="relative border-t border-border bg-muted p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
        {showEmojiPicker && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 cursor-default"
              aria-label="Close emoji picker"
              onClick={() => setShowEmojiPicker(false)}
            />
            <div className="absolute bottom-full left-2 z-40 mb-2 grid w-[320px] max-w-[calc(100%-1rem)] grid-cols-8 gap-0.5 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-xl">
              {EMOJI_GRID.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-muted"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}

        {showGifPicker && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 cursor-default"
              aria-label="Close GIF picker"
              onClick={() => setShowGifPicker(false)}
            />
            <div className="absolute bottom-full left-2 z-40 mb-2 w-[340px] max-w-[calc(100%-1rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              <div className="flex items-center gap-2 border-b border-border p-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  value={gifSearch}
                  onChange={(e) => {
                    const v = e.target.value
                    setGifSearch(v)
                    const t = setTimeout(() => void loadGifs(v), 350)
                    gifTimerRef.current = t
                  }}
                  placeholder="Search GIFs…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowGifPicker(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid max-h-64 grid-cols-3 gap-1 overflow-y-auto p-2">
                {gifsLoading ? (
                  <div className="col-span-3 flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : gifResults.length === 0 ? (
                  <p className="col-span-3 py-8 text-center text-xs text-muted-foreground">
                    No GIFs yet — an admin can add some from the admin panel.
                  </p>
                ) : (
                  gifResults.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      className="group relative aspect-video overflow-hidden rounded-lg bg-muted"
                      onClick={() => {
                        void sendMessage({ content: "", media_url: gif.gif_url || gif.url, message_type: "gif" })
                        setShowGifPicker(false)
                        setGifSearch("")
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gif.preview_url || gif.gif_url || gif.url}
                        alt={gif.title || "GIF"}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        loading="lazy"
                      />
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const type = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image"
              void uploadAndSend(file, type)
              e.target.value = ""
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-muted-foreground", showEmojiPicker && "bg-muted text-emerald-600")}
            onClick={() => setShowEmojiPicker((v) => !v)}
            title="Emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-muted-foreground", showGifPicker && "bg-muted text-emerald-600")}
            onClick={() => {
              setShowGifPicker((v) => {
                if (!v) void loadGifs("")
                return !v
              })
              setShowEmojiPicker(false)
            }}
            title="GIF"
          >
            <Film className="h-5 w-5" />
          </Button>
          <div className="relative flex-1">
            <MentionTextarea
              value={draft}
              onChange={onDraftChange}
              rows={1}
              placeholder="Message"
              className="min-h-[40px] resize-none rounded-full border-border bg-background px-4 text-foreground placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!sending) void sendMessage()
                }
              }}
            />
          </div>
          {recording ? (
            <Button
              size="icon"
              className="rounded-full bg-red-500 hover:bg-red-600"
              onClick={stopVoice}
              title="Stop recording"
            >
              <MicOff className="h-4 w-4" />
            </Button>
          ) : draft.trim() || uploading ? (
            <Button
              onClick={() => void sendMessage()}
              disabled={sending}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500"
              size="icon"
              title="Send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          ) : (
            <Button
              size="icon"
              className="rounded-full bg-emerald-600 hover:bg-emerald-500"
              onClick={() => void startVoice()}
              title="Voice message"
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {forwardTarget && (
        <ForwardDialog
          open={Boolean(forwardTarget)}
          onOpenChange={(open) => {
            if (!open) setForwardTarget(null)
          }}
          conversations={conversations}
          forwardingId={forwardingTo}
          onForward={(id) => void confirmForward(id)}
          onForwardNew={forwardToNewUser}
        />
      )}

            {selected.other_user && (
        <GiftModal
          open={showGift}
          onOpenChange={setShowGift}
          recipient={{
            id: selected.other_user.id,
            username: selected.other_user.username || "user",
            display_name: selected.other_user.display_name || selected.other_user.username || "User",
            avatar_url: selected.other_user.avatar_url,
          }}
          context={{ type: "profile", id: selected.other_user.id }}
        />
      )}
    </section>
  ) : selectedId ? (
    <section className="flex h-full flex-col items-center justify-center bg-background px-6 text-center text-muted-foreground">
      {loading || messagesLoading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <>
          <p className="text-lg font-medium text-foreground">Conversation unavailable</p>
          <p className="mt-1 max-w-sm text-sm">This chat may have been removed or you don’t have access.</p>
          <Button variant="outline" className="mt-4" onClick={backToInbox}>
            Back to inbox
          </Button>
        </>
      )}
    </section>
  ) : (
    <section className="hidden h-full flex-col items-center justify-center bg-background text-muted-foreground lg:flex">
      <ImageIcon className="mb-3 h-12 w-12 opacity-40" />
      <p className="text-lg font-medium text-foreground">Loop Chat</p>
      <p className="mt-1 max-w-sm text-center text-sm">
        Pick a conversation — or start a Co-Loop and publish a post together from the chat.
      </p>
    </section>
  )

  return (
    <div
      className={cn(
        "grid h-full min-h-0 overflow-hidden border border-border bg-background lg:grid-cols-[340px_1fr] lg:rounded-2xl",
      )}
    >
      <div className={cn("min-h-0", mobileShowChat ? "hidden lg:block" : "block")}>{inbox}</div>
      <div className={cn("min-h-0", mobileShowChat ? "block" : "hidden lg:block")}>{chatPane}</div>
    </div>
  )
}
