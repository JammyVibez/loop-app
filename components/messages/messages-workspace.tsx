"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { GiftModal } from "@/components/gifting/gift-modal"
import { CallSheet } from "@/components/calls/call-sheet"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { ForwardDialog } from "@/components/messages/forward-dialog"
import { cn } from "@/lib/utils"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { MediaEmojiPicker } from "@/components/content/media-emoji-picker"
import { optimizeImageUrl } from "@/lib/optimize-image"
import { playChatSound } from "@/lib/chat-sounds"
import {
  CHAT_WALLPAPER_PRESETS,
  chatWallpaperStyle,
  DEFAULT_CHAT_WALLPAPER,
  type ChatWallpaper,
} from "@/lib/chat-wallpapers"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import {
  ArrowLeft,
  Bell,
  BellOff,
  Camera,
  Check,
  CheckCheck,
  Copy,
  CornerUpRight,
  ExternalLink,
  GitBranch,
  Gift,
  MessageCircle,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  MoreHorizontal,
  Music2,
  Pencil,
  Phone,
  PhoneOff,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Zap,
  Sticker,
  Film,
  Trash2,
  Video,
  Wallpaper,
  ImagePlus,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  subscribeToPush,
  subscriptionToJSON,
  unsubscribeFromPush,
} from "@/lib/push-client"
import { unlockAudio } from "@/lib/audio-unlock"

interface Conversation {
  id: string
  is_group?: boolean
  name?: string | null
  other_user?: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
    active_cosmetics?: any
    cosmetics?: any
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
  /** Whether the other participant has seen this message (read receipt). */
  is_read?: boolean
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
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const recordingDurationRef = useRef<ReturnType<typeof setInterval> | null>(null)
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
  const [outgoingCall, setOutgoingCall] = useState<{ sessionId: string; mode: "video" | "audio" } | null>(null)
  const [incomingCall, setIncomingCall] = useState<{
    sessionId: string
    mode: "video" | "audio"
    fromName: string
    avatarUrl?: string
  } | null>(null)
  const [startingCall, setStartingCall] = useState<"video" | "audio" | null>(null)
  const outgoingCallRef = useRef<{ sessionId: string; mode: "video" | "audio" } | null>(null)
  const gifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null)
  const [pushToggling, setPushToggling] = useState(false)
  const [pushBanner, setPushBanner] = useState(false)
  const [wallpaper, setWallpaper] = useState<ChatWallpaper>(DEFAULT_CHAT_WALLPAPER)
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false)
  const [wallpaperSaving, setWallpaperSaving] = useState(false)
  const [wallpaperUploading, setWallpaperUploading] = useState(false)
  const wallpaperFileRef = useRef<HTMLInputElement>(null)
  const wallpaperSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraFileRef = useRef<HTMLInputElement>(null)
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

  // Deep link ?call=<sessionId> — open a call straight away (from a push).
  useEffect(() => {
    const callId = searchParams.get("call")
    if (!callId || !user?.id) return
    void (async () => {
      try {
        const res = await fetch(`/api/calls/${callId}`, { headers: getAuthHeader() })
        const data = await res.json()
        if (!res.ok) return
        const session = data.data?.session
        if (!session) return
        const mode = session.is_video ? "video" : "audio"
        setOutgoingCall({ sessionId: callId, mode })
        outgoingCallRef.current = { sessionId: callId, mode }
      } catch {
        /* ignore — user can open the chat normally */
      }
    })()
  }, [searchParams, user?.id, getAuthHeader])

  useEffect(() => {
    if (!selectedId || !user) return
    setMessages([])
    setTypingPeer(false)
    setPeerOnline(false)
    setPeerReadAt(null)
    setFreshMessageIds(new Set())
    setReplyTo(null)
    void loadMessages(selectedId)
    void loadWallpaper(selectedId)

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
        // Soft "ding" for incoming messages when the tab is visible.
        if (
          payload?.sender_id &&
          payload.sender_id !== user.id &&
          typeof document !== "undefined" &&
          document.visibilityState === "visible"
        ) {
          playChatSound("receive")
        }
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
      // Fallback reconciliation for edits/deletes — the sender also broadcasts
      // message_edited / message_deleted, but this covers sessions where the
      // broadcast was missed (e.g. a third device or a reconnecting client).
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` },
        () => {
          if (selectedIdRef.current === selectedId) void loadMessages(selectedId)
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` },
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

  // ---- Chat wallpaper (per-user, per-conversation) -----------------------

  const loadWallpaper = async (conversationId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/conversations/wallpaper?conversation_id=${conversationId}`, {
        headers: getAuthHeader(),
      })
      if (!res.ok) return
      const data = await res.json()
      setWallpaper(data.wallpaper || DEFAULT_CHAT_WALLPAPER)
    } catch {
      /* keep whatever is currently applied */
    }
  }

  const saveWallpaper = (next: ChatWallpaper) => {
    setWallpaper(next)
    if (!selectedId || !user) return
    if (wallpaperSaveTimer.current) clearTimeout(wallpaperSaveTimer.current)
    wallpaperSaveTimer.current = setTimeout(() => {
      setWallpaperSaving(true)
      void (async () => {
        try {
          await fetch("/api/conversations/wallpaper", {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify({ conversation_id: selectedId, wallpaper: next }),
          })
        } catch {
          /* non-fatal — the setting is applied locally regardless */
        } finally {
          setWallpaperSaving(false)
        }
      })()
    }, 250)
  }

  const uploadWallpaper = async (file: File) => {
    if (!user) return
    setWallpaperUploading(true)
    try {
      const uploaded = await uploadMediaFile(file, {
        type: "image",
        folder: "chat-wallpapers",
        authHeaders: getAuthHeader(),
      })
      saveWallpaper({ preset: null, image_url: uploaded.url, overlay: 0.35 })
      toast({ title: "Wallpaper applied", description: "This chat now uses your custom wallpaper." })
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" })
    } finally {
      setWallpaperUploading(false)
    }
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

  // ---- Voice / video calls (100ms) ------------------------------------

  const startCall = async (mode: "video" | "audio") => {
    if (!user || !selectedId || startingCall) return
    unlockAudio()
    setStartingCall(mode)
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ conversation_id: selectedId, is_video: mode === "video" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not start the call")
      const sessionId: string = data.data?.session?.id
      if (!sessionId) throw new Error("Could not start the call")
      setOutgoingCall({ sessionId, mode })
      outgoingCallRef.current = { sessionId, mode }
    } catch (error: any) {
      toast({ title: "Call failed", description: error?.message || "Please try again.", variant: "destructive" })
    } finally {
      setStartingCall(null)
    }
  }

  const acceptIncomingCall = () => {
    if (!incomingCall) return
    unlockAudio()
    const next = { sessionId: incomingCall.sessionId, mode: incomingCall.mode }
    setIncomingCall(null)
    setOutgoingCall(next)
    outgoingCallRef.current = next
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

  // Ring for incoming calls and react to ended sessions (RLS-scoped realtime).
  useEffect(() => {
    if (!user?.id) return
    const supabase = getSupabaseBrowserClient()
    const channel = supabase.channel("calls-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_sessions" },
        (payload: any) => {
          const session = payload.new
          if (!session || session.creator_id === user.id) return
          if (session.status !== "ringing") return
          // Only ring for calls in the conversation that is open right now,
          // so a busy inbox doesn't pile up banners.
          if (session.conversation_id && selectedIdRef.current && session.conversation_id !== selectedIdRef.current) {
            return
          }
          if (!session.conversation_id) return
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
              playChatSound("receive")
            } catch {
              /* ignore */
            }
          })()
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_sessions" },
        (payload: any) => {
          const session = payload.new
          if (!session) return
          setIncomingCall((prev) =>
            prev && prev.sessionId === session.id && session.status === "ended" ? null : prev,
          )
          if (
            outgoingCallRef.current &&
            session.id === outgoingCallRef.current.sessionId &&
            session.status === "ended"
          ) {
            setOutgoingCall(null)
            outgoingCallRef.current = null
            toast({ title: "Call ended" })
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

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
      playChatSound("send")
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
      setRecordingPaused(false)
      setRecordingDuration(0)
      recordingDurationRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000)
    } catch {
      toast({ title: "Microphone blocked", description: "Allow mic access to send voice notes.", variant: "destructive" })
    }
  }

  const stopVoice = () => {
    if (recordingDurationRef.current) clearInterval(recordingDurationRef.current)
    recorderRef.current?.stop()
    setRecording(false)
    setRecordingPaused(false)
    setRecordingDuration(0)
  }

  const pauseVoice = () => {
    try {
      recorderRef.current?.pause()
      setRecordingPaused(true)
      if (recordingDurationRef.current) clearInterval(recordingDurationRef.current)
    } catch {}
  }

  const resumeVoice = () => {
    try {
      recorderRef.current?.resume()
      setRecordingPaused(false)
      recordingDurationRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000)
    } catch {}
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
      // Push the edit to the peer instantly (no refresh on their side).
      void channelRef.current?.send({
        type: "broadcast",
        event: "message_edited",
        payload: { id: data.message.id, content: data.message.content, edited_at: data.message.edited_at },
      })
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

  const deleteConversation = async (mode: "delete" | "clear") => {
    if (!selected || !user) return
    const target = selected
    const label = mode === "clear" ? "Clear this chat for everyone?" : "Delete this conversation?"
    const description =
      mode === "clear"
        ? "Every message in this chat will be permanently removed from the database for both of you."
        : "This removes the chat from your inbox. If the other person has also deleted it, the whole conversation is removed."
    if (!window.confirm(`${label}\n\n${description}`)) return
    try {
      const res = await fetch(`/api/conversations?conversation_id=${target.id}&mode=${mode}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast({
        title: mode === "clear" ? "Chat cleared" : "Conversation deleted",
        description: mode === "clear" ? "Messages were removed from the database." : undefined,
      })
      if (mode === "clear") {
        setMessages([])
      } else {
        backToInbox()
      }
      await loadConversations()
    } catch (error: any) {
      toast({ title: "Couldn't do that", description: error.message || "Unknown error", variant: "destructive" })
    }
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
      // Push the deletion to the peer instantly (no refresh on their side).
      void channelRef.current?.send({
        type: "broadcast",
        event: "message_deleted",
        payload: { id: target.id },
      })
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
                  "relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  selectedId === conversation.id && "bg-gradient-to-r from-violet-500/10 via-muted/40 to-transparent",
                )}
              >
                {selectedId === conversation.id && (
                  <span className="absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-violet-500 to-cyan-400 shadow shadow-violet-500/40" />
                )}
                <div className="relative shrink-0">
                  <CosmeticAvatar
                    src={conversation.other_user?.avatar_url}
                    alt={displayName}
                    fallback={displayName}
                    size="md"
                    cosmetics={conversation.other_user?.active_cosmetics || conversation.other_user?.cosmetics || null}
                  />
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
                      {lastMine && <span className="text-violet-500 dark:text-violet-400">You: </span>}
                      {preview}
                    </p>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-1.5 text-[11px] font-semibold text-white shadow-sm shadow-violet-600/30">
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
    <section
      className="relative flex h-full min-h-0 min-w-0 flex-col bg-background"
      style={chatWallpaperStyle(wallpaper)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.08),transparent_55%)]" />
      <div className="flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2.5 shadow-sm backdrop-blur-sm sm:px-4">
        <Button variant="ghost" size="icon" className="text-foreground lg:hidden" onClick={backToInbox}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative shrink-0 rounded-full ring-2 ring-violet-500/40">
          <CosmeticAvatar
            src={selected.other_user?.avatar_url}
            alt={selected.other_user?.display_name || selected.name || "U"}
            fallback={selected.other_user?.display_name || selected.name || "U"}
            size="md"
            cosmetics={selected.other_user?.active_cosmetics || selected.other_user?.cosmetics || null}
          />
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
        {/* Voice + video calls (100ms) — 1:1 and group chats. */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-muted-foreground hover:text-emerald-500 sm:inline-flex"
          title="Voice call"
          onClick={() => void startCall("audio")}
          disabled={Boolean(startingCall) || Boolean(outgoingCall)}
        >
          {startingCall === "audio" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-muted-foreground hover:text-violet-500 sm:inline-flex"
          title="Video call"
          onClick={() => void startCall("video")}
          disabled={Boolean(startingCall) || Boolean(outgoingCall)}
        >
          {startingCall === "video" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />}
        </Button>
        {/* All chat actions live in one compact menu so the header stays
            clean on every screen size and never overflows on phones. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="More actions">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => void startCall("audio")}
              disabled={Boolean(startingCall) || Boolean(outgoingCall)}
            >
              <Phone className="mr-2 h-4 w-4 text-emerald-500" />
              Voice call
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void startCall("video")}
              disabled={Boolean(startingCall) || Boolean(outgoingCall)}
            >
              <Video className="mr-2 h-4 w-4 text-violet-500" />
              Video call
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCoLoop((v) => !v)} className="text-amber-600 dark:text-amber-300">
              <GitBranch className="mr-2 h-4 w-4" />
              Co-Loop together
              <span className="ml-auto rounded-full border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-medium">
                Only on Loop
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setWallpaperPickerOpen(true)}>
              <Wallpaper className="mr-2 h-4 w-4 text-violet-500" />
              Chat wallpaper
              {wallpaperSaving && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowChatSearch((v) => !v)}>
              <Search className="mr-2 h-4 w-4" />
              Search in chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void togglePush()} disabled={pushToggling}>
              {pushEnabled ? <Bell className="mr-2 h-4 w-4 text-emerald-500" /> : <BellOff className="mr-2 h-4 w-4" />}
              {pushEnabled ? "Notifications on" : "Turn on notifications"}
            </DropdownMenuItem>
            {selected.other_user?.username && (
              <DropdownMenuItem asChild>
                <Link href={`/profile/${selected.other_user.username}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View profile
                </Link>
              </DropdownMenuItem>
            )}
            {selected.other_user?.id && (
              <DropdownMenuItem onClick={() => setShowGift(true)}>
                <Gift className="mr-2 h-4 w-4 text-pink-500" />
                Send gift
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void deleteConversation("clear")} className="text-amber-600 dark:text-amber-400">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear chat for everyone
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void deleteConversation("delete")} className="text-red-500">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chat wallpaper picker — presets or your own image from the device. */}
      <Dialog open={wallpaperPickerOpen} onOpenChange={setWallpaperPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallpaper className="h-4 w-4 text-violet-500" /> Chat wallpaper
            </DialogTitle>
            <DialogDescription>
              Pick a preset or upload your own image. Only you see this — it's saved to your account for this chat.
            </DialogDescription>
          </DialogHeader>
          <input
            ref={wallpaperFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void uploadWallpaper(file)
              e.target.value = ""
            }}
          />
          <div
            className="relative flex h-28 items-end overflow-hidden rounded-xl border border-border"
            style={chatWallpaperStyle(wallpaper)}
          >
            <div className="w-full bg-gradient-to-t from-black/50 to-transparent p-2">
              <p className="text-[11px] font-medium text-white drop-shadow">
                {wallpaper.image_url
                  ? "Custom image"
                  : wallpaper.preset
                    ? CHAT_WALLPAPER_PRESETS.find((p) => p.id === wallpaper.preset)?.name || "Preset"
                    : "Default background"}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Presets</p>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => saveWallpaper(DEFAULT_CHAT_WALLPAPER)}
                className={cn(
                  "flex h-14 items-center justify-center rounded-lg border border-border bg-muted text-[10px] font-medium text-muted-foreground transition hover:border-violet-500/50",
                  !wallpaper.preset && !wallpaper.image_url && "border-violet-500 ring-1 ring-violet-500/40",
                )}
                title="Default"
              >
                Default
              </button>
              {CHAT_WALLPAPER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => saveWallpaper({ preset: preset.id, image_url: null, overlay: null })}
                  className={cn(
                    "h-14 rounded-lg border transition hover:scale-[1.03]",
                    wallpaper.preset === preset.id && !wallpaper.image_url
                      ? "border-violet-500 ring-2 ring-violet-500/40"
                      : "border-border",
                  )}
                  style={{ background: preset.css }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={wallpaperUploading}
              onClick={() => wallpaperFileRef.current?.click()}
            >
              {wallpaperUploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-1.5 h-4 w-4" />
              )}
              {wallpaper.image_url ? "Change image" : "Upload from device"}
            </Button>
            {wallpaper.image_url && (
              <Button variant="ghost" onClick={() => saveWallpaper(DEFAULT_CHAT_WALLPAPER)}>
                Reset
              </Button>
            )}
          </div>
          {wallpaper.image_url && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Darken image</p>
              <Slider
                value={[Math.round((wallpaper.overlay ?? 0.35) * 100)]}
                min={0}
                max={70}
                step={5}
                onValueChange={([v]) => saveWallpaper({ ...wallpaper, overlay: v / 100 })}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <Zap className="h-4 w-4" />
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

      <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6">
        {messagesLoading && messages.length === 0 ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : null}
        {filteredMessages.map((message, index) => {
          const mine = (message.sender_id || message.author_id) === user.id
          const isFresh = freshMessageIds.has(message.id)
          const read =
            mine &&
            (message.is_read === true ||
              (Boolean(peerReadAt) && new Date(peerReadAt!) >= new Date(message.created_at)))
          const prev = filteredMessages[index - 1]
          const showDate = !prev || dayLabel(prev.created_at) !== dayLabel(message.created_at)
          return (
            <Fragment key={message.id}>
              {showDate && (
                <div className="flex justify-center py-2">
                  <span className="rounded-full bg-background/85 px-3 py-1 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-violet-500/20">
                    {dayLabel(message.created_at)}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "group flex w-full min-w-0 max-w-full",
                  mine ? "justify-end" : "justify-start",
                  isFresh && "message-appear",
                )}
              >
                <div
                  className={cn(
                    // Bubble width is capped as a % of the chat pane AND of the
                    // viewport, so long unbroken text / embeds can never push a
                    // bubble past the screen edge on narrow phones.
                    "min-w-0 max-w-[min(85%,calc(100vw-3rem))] sm:max-w-[min(70%,calc(100vw-4rem))]",
                  )}
                >
                <div
                  className={cn(
                    "chat-bubble min-w-0 max-w-full break-words [overflow-wrap:anywhere] relative rounded-2xl px-3 py-2 text-sm shadow-sm",
                    mine
                      ? "chat-bubble-mine rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/25"
                      : "chat-bubble-peer rounded-bl-md bg-muted text-foreground shadow-sm ring-1 ring-border/40",
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
                            mine ? "text-cyan-100/90" : "text-muted-foreground",
                          )}
                        >
                          <CornerUpRight className="h-3 w-3" />
                          Forwarded from {message.forwarded_from}
                        </p>
                      )}
                      {message.reply_to && (
                        <div
                          className={cn(
                            "mb-1.5 rounded-lg border-l-2 border-cyan-400/70 px-2 py-1 text-[11px]",
                            mine ? "bg-white/10" : "bg-muted/70",
                          )}
                        >
                          <p className="truncate font-semibold text-violet-600 dark:text-violet-300">
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
                            src={optimizeImageUrl(message.media_url, 900) || message.media_url}
                            alt=""
                            className="mb-1 max-h-64 w-full rounded-lg object-cover"
                            loading="lazy"
                            decoding="async"
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
                          className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
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
                          (read ? (
                            <CheckCheck className="h-3.5 w-3.5 text-cyan-200" aria-label="Seen" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-white/80" aria-label="Sent" />
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
            <p className="text-xs text-violet-600 dark:text-violet-400">Replying</p>
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
            <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
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
              className="shrink-0 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400"
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

      <div className="relative border-t border-border/60 bg-background/70 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-3">
        {showEmojiPicker && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-30 cursor-default"
              aria-label="Close emoji picker"
              onClick={() => setShowEmojiPicker(false)}
            />
            <div className="absolute bottom-full left-2 z-40 mb-2">
              <MediaEmojiPicker
                onSelectEmoji={(emoji) => { insertEmoji(emoji); setShowEmojiPicker(false) }}
                onSelectGif={(url) => { void sendMessage({ content: "", media_url: url, message_type: "gif" }); setShowEmojiPicker(false) }}
                onSelectSticker={(url) => { void sendMessage({ content: "", media_url: url, message_type: "sticker" }); setShowEmojiPicker(false) }}
                isPro={Boolean((user as any)?.is_premium)}
              />
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
                    if (gifTimerRef.current) clearTimeout(gifTimerRef.current)
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
          <input
            ref={cameraFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              void uploadAndSend(file, "image")
              e.target.value = ""
            }}
          />

          {/* Circular + button — all attach actions in one tidy menu. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Add to message"
                title="Add to message"
                className="h-11 w-11 shrink-0 rounded-full border border-border/60 bg-foreground/[0.04] text-foreground/80 shadow-sm backdrop-blur transition hover:bg-foreground/10 hover:text-foreground"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52">
              <DropdownMenuItem disabled={uploading} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4 text-violet-500" />
                Photo or video
              </DropdownMenuItem>
              <DropdownMenuItem disabled={uploading} onClick={() => cameraFileRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4 text-sky-500" />
                Take a photo
              </DropdownMenuItem>
              <DropdownMenuItem disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Music2 className="mr-2 h-4 w-4 text-amber-500" />
                Audio file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setShowGifPicker((v) => {
                    if (!v) void loadGifs("")
                    return !v
                  })
                  setShowEmojiPicker(false)
                }}
              >
                <Film className="mr-2 h-4 w-4 text-pink-500" />
                GIF or sticker
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setShowEmojiPicker((v) => !v)
                  setShowGifPicker(false)
                }}
              >
                <Smile className="mr-2 h-4 w-4 text-amber-500" />
                Emoji
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setWallpaperPickerOpen(true)}>
                <Wallpaper className="mr-2 h-4 w-4 text-violet-500" />
                Chat wallpaper
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Pill input — placeholder + sticker / camera / mic icons inside. */}
          <div className="relative min-w-0 flex-1 rounded-full border border-border/50 bg-foreground/[0.05] shadow-sm backdrop-blur transition-colors focus-within:border-violet-500/40 focus-within:bg-foreground/[0.07]">
            <MentionTextarea
              value={draft}
              onChange={onDraftChange}
              rows={1}
              placeholder="Message"
              className="min-h-[44px] resize-none rounded-full border-0 bg-transparent py-3 pl-4 pr-32 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!sending) void sendMessage()
                }
              }}
            />

            {recording ? (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center gap-2 px-3 rounded-full bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    recordingPaused ? "bg-amber-400" : "bg-red-500 animate-pulse"
                  )} />
                  <span className="text-xs font-mono font-semibold text-red-400 tabular-nums min-w-[3ch]">{Math.floor(recordingDuration / 60).toString().padStart(2, "0")}:{(recordingDuration % 60).toString().padStart(2, "0")}</span>
                </div>
                {recordingPaused ? (
                  <button type="button" onClick={resumeVoice} title="Resume" className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/90 text-white transition hover:bg-emerald-500">
                    <Play className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button type="button" onClick={pauseVoice} title="Pause" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white">
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" onClick={stopVoice} title="Stop & send" className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/90 text-white shadow-lg shadow-red-500/30 transition hover:bg-red-500 ml-auto">
                  <MicOff className="h-4 w-4" />
                </button>
              </div>
            ) : draft.trim() || uploading ? (
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending}
                title="Send"
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-cyan-400 disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            ) : (
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                <button
                  type="button"
                  title="GIFs & stickers"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground",
                    showGifPicker && "bg-foreground/10 text-violet-600",
                  )}
                  onClick={() => {
                    setShowGifPicker((v) => {
                      if (!v) void loadGifs("")
                      return !v
                    })
                    setShowEmojiPicker(false)
                  }}
                >
                  <Sticker className="h-[19px] w-[19px]" />
                </button>
                <button
                  type="button"
                  title="Take a photo"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground"
                  onClick={() => cameraFileRef.current?.click()}
                >
                  <Camera className="h-[19px] w-[19px]" />
                </button>
                <button
                  type="button"
                  title="Voice message"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground"
                  onClick={() => void startVoice()}
                >
                  <Mic className="h-[19px] w-[19px]" />
                </button>
              </div>
            )}
          </div>
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
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/15 to-cyan-500/10 ring-1 ring-violet-500/20">
        <MessageCircle className="h-8 w-8 text-violet-500/70" />
      </div>
      <p className="text-lg font-medium text-foreground">Loop Chat</p>
      <p className="mt-1 max-w-sm text-center text-sm">
        Pick a conversation — or start a Co-Loop and publish a post together from the chat.
      </p>
    </section>
  )

  return (
    <div
      className={cn(
        "grid h-full w-full min-h-0 min-w-0 overflow-hidden border border-border bg-background lg:grid-cols-[340px_minmax(0,1fr)] lg:rounded-2xl",
      )}
    >
      <div className={cn("min-h-0 min-w-0", mobileShowChat ? "hidden lg:block" : "block")}>{inbox}</div>
      <div className={cn("min-h-0 min-w-0", mobileShowChat ? "block" : "hidden lg:block")}>{chatPane}</div>
      {/* Incoming call banner */}
      {incomingCall && (
        <div className="fixed left-1/2 top-4 z-[115] w-[min(94vw,430px)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
            <Avatar className="h-11 w-11 ring-2 ring-emerald-500/50">
              <AvatarImage src={incomingCall.avatarUrl} />
              <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-sm font-bold">
                {incomingCall.fromName?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
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
        open={Boolean(outgoingCall)}
        onOpenChange={(open) => {
          if (!open) {
            setOutgoingCall(null)
            outgoingCallRef.current = null
          }
        }}
        sessionId={outgoingCall?.sessionId || null}
        mode={outgoingCall?.mode || "video"}
        title={selected?.other_user?.display_name || selected?.name || "Call"}
        subtitle={
          selected?.other_user?.username ? `@${selected.other_user.username}` : selected?.is_group ? "Group call" : undefined
        }
        avatarUrl={selected?.other_user?.avatar_url}
        onEnded={() => {
          setOutgoingCall(null)
          outgoingCallRef.current = null
        }}
      />
    </div>
  )
}
