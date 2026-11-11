"use client"

import { ProtectedMedia } from "@/components/media-protection"
import { AnimatedEmoji } from "@/components/emoji/animated-emoji"
import { EmojiPicker } from "@/components/emoji/emoji-picker"

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { GiftButton } from "@/components/gifting/gift-button"
import { CallSheet } from "@/components/calls/call-sheet"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { ForwardDialog } from "@/components/messages/forward-dialog"
import { WallpaperPicker } from "@/components/messages/wallpaper-picker"
import { GifPicker } from "@/components/messages/gif-picker"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { UserBadges } from "@/components/user-badge"
import { useVerificationBadges } from "@/hooks/use-verification-badges"
import { VoiceRecorderWaves } from "@/components/messages/voice-recorder-waves"
import { CallLogs } from "@/components/messages/call-logs"
import { cn } from "@/lib/utils"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { MediaEmojiPicker } from "@/components/content/media-emoji-picker"
import { optimizeImageUrl } from "@/lib/optimize-image"
import {
  readChatResumePoint,
  writeChatResumePoint,
  type ChatResumePoint,
} from "@/lib/message-resume"
import { playChatSound } from "@/lib/chat-sounds"
import {
  CHAT_WALLPAPER_PRESETS,
  chatWallpaperStyle,
  DEFAULT_CHAT_WALLPAPER,
  type ChatWallpaper,
} from "@/lib/chat-wallpapers"
import { Spinner } from "@/components/ui/skeletons"
import { GroupCreateDialog } from "@/components/messages/group-create-dialog"
import { GroupInfoPanel } from "@/components/messages/group-info-panel"
import {
  ArrowDown,
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
  MessageCircle,
  
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
  Film,
  Trash2,
  Video,
  Wallpaper,
  ImagePlus,
  Lock,
  ShieldCheck,
  UserMinus,
  UserPlus,
  X,
} from "@/components/icons/lucide-compat"
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
import { refreshUnreadMessages } from "@/hooks/use-unread-messages"

interface Conversation {
  id: string
  is_group?: boolean
  name?: string | null
  other_user?: {
    id: string
    username?: string
    display_name?: string
    is_verified?: boolean
    badge_id?: string | null
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

// Sender name color accents for group chats — distinct but restrained.
const SENDER_ACCENT_COLORS = [
  "text-emerald-600 dark:text-emerald-400",
  "text-sky-600 dark:text-sky-400",
  "text-violet-600 dark:text-violet-400",
  "text-rose-600 dark:text-rose-400",
  "text-amber-600 dark:text-amber-400",
  "text-teal-600 dark:text-teal-400",
  "text-indigo-600 dark:text-indigo-400",
  "text-pink-600 dark:text-pink-400",
]

function senderAccentColor(senderId: string): string {
  const h = senderId.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0)
  return SENDER_ACCENT_COLORS[h % SENDER_ACCENT_COLORS.length]
}

/**
 * System events (join/leave/lock/name change…) get a small semantic icon so
 * they read at a glance without looking like a chat bubble.
 */
function systemMessageIcon(content: string) {
  const text = (content || "").toLowerCase()
  if (text.includes("lock")) return Lock
  if (text.includes("unlock")) return Lock
  if (text.includes("join") || text.includes("added")) return UserPlus
  if (text.includes("left") || text.includes("removed")) return UserMinus
  if (text.includes("admin") || text.includes("moderator") || text.includes("promot")) return ShieldCheck
  if (text.includes("name") || text.includes("description") || text.includes("renam")) return Pencil
  return MessageCircle
}

/** Long-press delay before a touch reveals a message's action bar. */
const LONG_PRESS_MS = 380

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
  const verificationBadges = useVerificationBadges()
  const deepLinkId = searchParams.get("c")
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId)
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(deepLinkId))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [draft, setDraft] = useState("")
  const [inboxTab, setInboxTab] = useState<"chats" | "calls">("chats")
  const [resume, setResume] = useState<ChatResumePoint | null>(null)
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
  const [showGroupCreate, setShowGroupCreate] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [typingPeer, setTypingPeer] = useState(false)
  const [groupTypers, setGroupTypers] = useState<Map<string, {name: string; ts: number}>>(new Map())
  const [peerOnline, setPeerOnline] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const recordingDurationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showCoLoop, setShowCoLoop] = useState(false)
  const [coLoopDraft, setCoLoopDraft] = useState("")
  const [coLoopPeerDraft, setCoLoopPeerDraft] = useState("")
  const [publishingCoLoop, setPublishingCoLoop] = useState(false)
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null)
  const [freshMessageIds, setFreshMessageIds] = useState<Set<string>>(new Set())
  /** Message whose action bar / quick reactions are revealed (mobile long-press). */
  const [activeActionsId, setActiveActionsId] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A long-press also emits a click on touchend; remember it so the row's click
  // handler does not immediately close the toolbar it just opened.
  const longPressFired = useRef<string | null>(null)
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // ── Swipe-to-reply (touch) ──────────────────────────────────────────────
  // Telegram-style: drag a bubble sideways to reveal a reply arrow and, past
  // the threshold, start a quoted reply. Vertical drags remain a scroll.
  const SWIPE_THRESHOLD = 56
  const [swipe, setSwipe] = useState<{ id: string; dx: number; settling: boolean } | null>(null)
  const swipeRef = useRef<{
    id: string
    target: ChatMessage
    startX: number
    startY: number
    dx: number
    locked: "h" | "v" | null
  } | null>(null)

  const beginSwipe = (message: ChatMessage, e: React.TouchEvent) => {
    const t = e.touches[0]
    swipeRef.current = { id: message.id, target: message, startX: t.clientX, startY: t.clientY, dx: 0, locked: null }
  }

  const moveSwipe = (e: React.TouchEvent) => {
    const s = swipeRef.current
    if (!s) return
    const t = e.touches[0]
    const dx = t.clientX - s.startX
    const dy = t.clientY - s.startY
    if (!s.locked) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) s.locked = "h"
      else if (Math.abs(dy) > 10) s.locked = "v"
    }
    if (s.locked !== "h") return
    s.dx = Math.max(-72, Math.min(72, dx))
    setSwipe({ id: s.id, dx: s.dx, settling: false })
  }

  const endSwipe = () => {
    const s = swipeRef.current
    swipeRef.current = null
    if (!s) return
    if (s.locked === "h" && Math.abs(s.dx) >= SWIPE_THRESHOLD) {
      setReplyTo(s.target)
      setActiveActionsId(null)
    }
    setSwipe({ id: s.id, dx: 0, settling: true })
    setTimeout(() => setSwipe(null), 240)
  }
  const [pinnedMessages, setPinnedMessages] = useState<Array<{id: string; content: string; author_id: string; created_at: string}>>([])
  const [pinnedExpanded, setPinnedExpanded] = useState(false)
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
  const wallpaperSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Message-scroller state: mirrors whether the reader is pinned to the newest
  // message so incoming messages never yank the view away from history.
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const prependAnchorRef = useRef<{ height: number; top: number } | null>(null)
  const atBottomRef = useRef(true)
  const lastMessageIdRef = useRef<string | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [unseenBelow, setUnseenBelow] = useState(0) // messages received while scrolled up
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
    () => conversations.find((c) => String(c.id) === String(selectedId)) || null,
    [conversations, selectedId],
  )

  const filteredMessages = useMemo(() => {
    const q = chatSearch.trim().toLowerCase()
    if (!q) return messages
    return messages.filter((m) => m.content?.toLowerCase().includes(q))
  }, [messages, chatSearch])

  // The inbox search both filters existing chats and is the seed for starting a
  // new one. Without the filter, typing a name looked like the list was broken.
  const visibleConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((conversation) => {
      const name = conversation.is_group
        ? conversation.name || ""
        : conversation.other_user?.display_name || conversation.other_user?.username || ""
      return (
        name.toLowerCase().includes(q) ||
        (conversation.other_user?.username || "").toLowerCase().includes(q) ||
        (conversation.last_message?.content || "").toLowerCase().includes(q)
      )
    })
  }, [conversations, search])

  const loadConversations = async (silent = false) => {
    if (!user) return
    if (!silent) setLoading(true)
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
      // A background refresh must not hijack the screen with a toast.
      if (!silent) toast({ title: "Chat unavailable", description: error.message, variant: "destructive" })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const MESSAGE_PAGE_SIZE = 80

  const loadMessages = async (conversationId: string, older = false, silent = false) => {
    if (!user) return
    const req = ++loadReq.current
    if (older) {
      setLoadingOlder(true)
    } else if (!silent) {
      setMessagesLoading(true)
      setHasMoreMessages(true)
    }
    // Page backwards from the oldest message we already hold; without a
    // cursor the endpoint returns the NEWEST window, which is what keeps
    // freshly received messages from being replaced by stale history.
    const before = older ? messages[0]?.created_at : undefined
    if (older && !before) {
      setLoadingOlder(false)
      setHasMoreMessages(false)
      return
    }
    if (older) {
      const el = scrollAreaRef.current
      prependAnchorRef.current = el ? { height: el.scrollHeight, top: el.scrollTop } : null
    }
    const params = new URLSearchParams({ conversation_id: conversationId, limit: String(MESSAGE_PAGE_SIZE) })
    if (before) params.set("before", before)
    try {
      const response = await fetch(`/api/messages?${params.toString()}`, { headers: getAuthHeader() })
      const data = await response.json()
      if (req !== loadReq.current || selectedIdRef.current !== conversationId) return
      if (!response.ok) throw new Error(data.error || "Failed to load messages")
      const list: ChatMessage[] = data.messages || []
      const byId = new Map(list.map((m) => [m.id, m]))
      const mapped = list.map((m) => ({
        ...m,
        reply_to: m.reply_to || (m.reply_to_id ? byId.get(m.reply_to_id) || null : null),
        reactions: Array.isArray(m.reactions) ? m.reactions : [],
      }))
      if (older) {
        setMessages((prev) => [...mapped, ...prev.filter((m) => !byId.has(m.id))])
        setHasMoreMessages(list.length >= MESSAGE_PAGE_SIZE)
      } else if (mapped.length === 0) {
        // Transient empty response — never blank a conversation that already
        // has messages on screen.
        setHasMoreMessages(false)
      } else {
        // Refresh the newest window but keep any older history the reader
        // already pulled in, so a live reconciliation can't rewind to the top.
        const oldest = mapped[0]?.created_at
        setMessages((prev) => {
          const kept = oldest ? prev.filter((m) => m.created_at < oldest) : []
          const byIdAll = new Map(kept.map((m) => [m.id, m]))
          for (const m of mapped) byIdAll.set(m.id, m)
          return Array.from(byIdAll.values()).sort((a, b) => a.created_at.localeCompare(b.created_at))
        })
        setHasMoreMessages(list.length >= MESSAGE_PAGE_SIZE)
      }
    } catch (error: any) {
      if (req !== loadReq.current) return
      if (!silent) toast({ title: "Messages unavailable", description: error.message, variant: "destructive" })
    } finally {
      if (req === loadReq.current && !silent) {
        setMessagesLoading(false)
        setLoadingOlder(false)
      }
    }
  }

  useEffect(() => {
    void loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Cheap safety net for the inbox: a message that lands while realtime is
  // reconnecting still shows up (with its unread badge) within a few seconds.
  // Silent — no spinner, no toast, no scroll jump.
  useEffect(() => {
    if (!user?.id) return
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void loadConversations(true)
    }, 20000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Restore this account's resume point (per-device convenience).
  useEffect(() => {
    setResume(readChatResumePoint(user?.id))
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
    // A fresh conversation always opens pinned to its newest message.
    atBottomRef.current = true
    lastMessageIdRef.current = null
    setAtBottom(true)
    setUnseenBelow(0)
    setReplyTo(null)
    void loadMessages(selectedId)
    setPinnedMessages([])
    void (async () => {
      try {
        const res = await fetch("/api/conversations/" + selectedId + "/group", { headers: getAuthHeader() });
        const data = await res.json();
        if (data.success && data.pinned_messages) setPinnedMessages(data.pinned_messages);
      } catch { /* non-fatal */ }
    })()
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
              String(c.id) === String(selectedId)
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
        })
          // Re-read only once the receipt has landed, otherwise the badge can
          // fetch the old total and sit stale until the next poll.
          .then(() => refreshUnreadMessages())
          .catch(() => {})
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
          // Track group typers
          if (selected?.is_group && payload.display_name) {
            setGroupTypers(prev => {
              const next = new Map(prev)
              next.set(payload.user_id, { name: payload.display_name, ts: Date.now() })
              return next
            })
            setTimeout(() => {
              setGroupTypers(prev => {
                const next = new Map(prev)
                next.delete(payload.user_id)
                return next
              })
            }, 3000)
          }
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
      .on("broadcast", { event: "reaction" }, ({ payload }: { payload: any }) => {
        if (!payload?.message_id) return
        if (payload?.user_id === user.id) return
        // The server sends the authoritative grouped counts, so the peer does
        // not need a full thread reload to see the change.
        if (Array.isArray(payload.reactions)) {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.message_id ? { ...m, reactions: payload.reactions } : m)),
          )
          return
        }
        if (selectedIdRef.current === selectedId) void loadMessages(selectedId, false, true)
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
          })
            .then(() => refreshUnreadMessages())
            .catch(() => {})
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

    // Delivery net: if the socket is down (mobile sleep, flaky network, a
    // dropped Realtime connection) the open thread still refreshes. This is
    // what makes a message from the other person appear even when neither the
    // broadcast nor Postgres Changes arrives.
    const reconcile = setInterval(() => {
      if (selectedIdRef.current !== selectedId) return
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void loadMessages(selectedId, false, true)
    }, 8000)

    return () => {
      clearInterval(heartbeat)
      clearInterval(reconcile)
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

  const resolveScroller = () => {
    const el = (scrollAreaRef.current ||
      (bottomRef.current?.parentElement as HTMLDivElement | null)) as HTMLDivElement | null
    if (el) scrollAreaRef.current = el
    return el
  }

  const handleMessagesScroll = () => {
    const el = scrollAreaRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96
    atBottomRef.current = nearBottom
    setAtBottom(nearBottom)
    if (nearBottom) setUnseenBelow(0)
  }

  const scrollToLatest = () => {
    const el = scrollAreaRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    else bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    atBottomRef.current = true
    setAtBottom(true)
    setUnseenBelow(0)
  }

  // Track the message scroller (the bottom sentinel's parent) so incoming
  // messages never yank the view away from history.
  useEffect(() => {
    const el = resolveScroller()
    if (!el) return
    const onScroll = () => handleMessagesScroll()
    el.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener("scroll", onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  // Loading older messages restores the reading position instead of jumping to
  // the bottom; genuinely new messages only pin to the newest when the reader
  // is already there, otherwise they surface the "latest" pill.
  useLayoutEffect(() => {
    const el = resolveScroller()
    if (!el) return
    const anchor = prependAnchorRef.current
    if (anchor) {
      prependAnchorRef.current = null
      el.scrollTop = el.scrollHeight - anchor.height + anchor.top
      return
    }
    const last = filteredMessages[filteredMessages.length - 1]
    const lastId = last?.id ?? null
    const changed = lastId !== lastMessageIdRef.current
    lastMessageIdRef.current = lastId
    if (!changed) return
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight
      setUnseenBelow(0)
    } else {
      setUnseenBelow((n) => n + 1)
    }
  }, [filteredMessages])

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
      payload: { user_id: user.id, display_name: user.display_name || user.username || "" },
    })
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(broadcastTyping, 250)
  }

  const openConversation = (id: string) => {
    // Remember this as the resume point (and stamp the moment we left), so the
    // inbox can show "continue where you left off" next visit.
    const convo = conversations.find((c) => String(c.id) === String(id))
    if (convo) {
      const point: ChatResumePoint = {
        id: String(id),
        name: convo.is_group
          ? convo.name || "Group"
          : convo.other_user?.display_name || `@${convo.other_user?.username || "user"}`,
        avatarUrl: convo.other_user?.avatar_url || null,
        videoAvatarUrl: (convo.other_user as any)?.video_avatar_url || null,
        isGroup: convo.is_group,
        preview: convo.last_message?.content || "",
        at: new Date().toISOString(),
      }
      setResume(point)
      writeChatResumePoint(user?.id, point)
    }
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
      // Keep the quote on the bubble that was just sent. The API normally
      // returns `reply_to`, but a realtime insert can land first and this
      // merge guarantees the replied-to message is still shown either way.
      const fallbackReply = replySnapshot
        ? {
            id: replySnapshot.id,
            content: replySnapshot.content,
            media_type: replySnapshot.media_type ?? null,
            author_id: replySnapshot.author_id,
            sender: replySnapshot.sender || null,
          }
        : null
      const sent = { ...data.message, reply_to: data.message.reply_to ?? fallbackReply }
      setMessages((prev) => {
        const existing = prev.find((m) => m.id === sent.id)
        if (existing) {
          return prev.map((m) => (m.id === sent.id ? { ...m, reply_to: m.reply_to ?? sent.reply_to } : m))
        }
        return [...prev, sent]
      })
      markFresh(sent.id)
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
      // Voice notes and video are chunk-uploaded to /api/media/upload so a
      // long recording never has to fit in one request body; audio is
      // normalised in the background.
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
        // Coerce: message ids are bigints on older conversations and the API
        // expects a stable string either way.
        body: JSON.stringify({ message_id: String(message.id), emoji, action: reacted ? "remove" : "add" }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Reaction failed")
      // Adopt the server's grouped counts (it re-reads the reactions table), so
      // the bubble can never drift from what everyone else sees.
      if (Array.isArray(data?.reactions)) {
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, reactions: data.reactions } : m)),
        )
      }
    } catch (error) {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions: snapshot } : m)))
      toast({
        title: "Couldn’t react",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
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
    } catch { /* intentionally silent */ }
  }

  const resumeVoice = () => {
    try {
      recorderRef.current?.resume()
      setRecordingPaused(false)
      recordingDurationRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000)
    } catch { /* intentionally silent */ }
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
    if (!(await confirmDialog({ title: label, description, confirmLabel: mode === "clear" ? "Clear chat" : "Delete", destructive: true })))
      return
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
      <div className="shrink-0 space-y-2.5 border-b border-border/60 px-3 pb-2.5 pt-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">Direct messages</p>
            <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight">Messages</h1>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:bg-sky-500/10 hover:text-sky-600"
              title="New group"
              aria-label="New group"
              onClick={() => setShowGroupCreate(true)}
            >
              <UserPlus className="h-[18px] w-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:bg-sky-500/10 hover:text-sky-600"
              title={pushEnabled ? "Notifications on for this device — tap to mute" : "Turn on notifications for chats"}
              aria-label="Chat notifications"
              onClick={() => void togglePush()}
              disabled={pushToggling}
            >
              {pushToggling ? (
                <Spinner className="h-4 w-4" />
              ) : pushEnabled ? (
                <Bell className="h-[18px] w-[18px] text-sky-600 dark:text-sky-400" />
              ) : (
                <BellOff className="h-[18px] w-[18px]" />
              )}
            </Button>
          </div>
        </div>
        {/* Tabs: Chats | Calls */}
        <div className="flex rounded-xl bg-muted/70 p-1">
          <button
            type="button"
            onClick={() => setInboxTab("chats")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
              inboxTab === "chats"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageCircle className="mr-1.5 inline h-4 w-4" />
            Chats
          </button>
          <button
            type="button"
            onClick={() => setInboxTab("calls")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
              inboxTab === "calls"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Phone className="mr-1.5 inline h-4 w-4" />
            Calls
          </button>
        </div>
        {pushBanner && pushEnabled === false && (
          <button
            type="button"
            onClick={() => void togglePush()}
            disabled={pushToggling}
            className="flex w-full items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-sky-500/10 disabled:opacity-60"
          >
            <Bell className="h-3.5 w-3.5 shrink-0 text-sky-500" />
            <span className="flex-1 truncate">Get notifications for new messages</span>
            <span className="shrink-0 font-semibold text-sky-600 dark:text-sky-400">
              {pushToggling ? "Enabling…" : "Enable"}
            </span>
          </button>
        )}
        {inboxTab === "chats" && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a username to start a chat"
            className="h-10 rounded-xl border-border/60 bg-muted/45 pl-9 pr-10 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-sky-500/30"
            onKeyDown={(e) => e.key === "Enter" && void startChat()}
          />
          {search.trim() && (
            <button
              type="button"
              onClick={() => void startChat()}
              disabled={starting}
              aria-label="Start chat"
              title="Start chat"
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-sky-600 text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {starting ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
            </button>
          )}
        </div>
        )}
      </div>
      {inboxTab === "calls" ? (
        <CallLogs
          onCallBack={(conversationId) => openConversation(conversationId)}
        />
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Spinner className="mr-2 h-4 w-4" /> Loading…
          </div>
        ) : visibleConversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-8 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              {search.trim() ? <Search className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {search.trim() ? "No matching chats" : "No chats yet"}
            </p>
            <p className="max-w-[240px] text-xs text-muted-foreground">
              {search.trim()
                ? `Start a new conversation with “${search.trim()}”.`
                : "Search a username above to start your first conversation."}
            </p>
            {search.trim() ? (
              <Button
                size="sm"
                className="mt-2 h-8 rounded-lg bg-sky-600 text-xs text-white hover:bg-sky-500"
                onClick={() => void startChat()}
                disabled={starting}
              >
                {starting ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Start chat
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-8 rounded-lg text-xs"
                onClick={() => setShowGroupCreate(true)}
              >
                Start a group
              </Button>
            )}
          </div>
        ) : (
          visibleConversations.map((conversation) => {
            const displayName = conversation.is_group
              ? conversation.name || "Group"
              : conversation.other_user?.display_name || `@${conversation.other_user?.username || "user"}`
            const last = conversation.last_message
            const unread = unreadCounts[conversation.id] || 0
            const lastMine = last?.sender_id === user.id || last?.author_id === user.id
            // For groups, prefix the last message with the sender name.
            const lastSenderName = last && conversation.is_group
              ? (last as any).sender?.display_name || (last as any).sender?.username || (last as any).author_name || ""
              : ""
            const preview = last
              ? last.message_type === "system"
                ? last.content || ""
                : last.message_type === "image"
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
                  "relative flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-sky-500/[0.05]",
                  String(selectedId) === String(conversation.id) && "bg-sky-500/[0.08]",
                )}
              >
                {String(selectedId) === String(conversation.id) && (
                  <span className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-sky-500" />
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
                    <p className="flex min-w-0 items-center gap-1 truncate text-[14px] font-semibold text-foreground">
                      <span className="truncate">{displayName}</span>
                      {!conversation.is_group && conversation.other_user?.is_verified && (
                        <VerifiedSeal size={15} title="Verified Creator" />
                      )}
                      {!conversation.is_group && conversation.other_user?.badge_id && verificationBadges[conversation.other_user.badge_id] && (
                        <UserBadges badge={verificationBadges[conversation.other_user.badge_id]} size="sm" />
                      )}
                    </p>
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
                      {conversation.is_group && lastSenderName && !lastMine && (
                        <span className="font-semibold text-foreground">{lastSenderName}: </span>
                      )}
                      {lastMine && <span className="text-muted-foreground">You: </span>}
                      {preview}
                    </p>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 px-1.5 text-[11px] font-semibold text-white shadow-sm shadow-sky-600/25">
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
      )}
    </aside>
  )

  const chatPane = selected ? (
    <section
      className="relative flex h-full min-h-0 min-w-0 flex-col bg-background"
      style={chatWallpaperStyle(wallpaper)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.10),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.06),transparent_55%)]" />
      <div className="relative z-[1] flex shrink-0 items-center gap-2 border-b border-border/60 bg-background/85 px-1.5 py-2 backdrop-blur-xl sm:px-3">
        <Button variant="ghost" size="icon" className="text-foreground lg:hidden" onClick={backToInbox}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative shrink-0 rounded-full ring-2 ring-sky-500/25 ring-offset-2 ring-offset-background">
          {selected.is_group ? (
            <div className="relative h-10 w-10">
              {(selected as any).participants?.slice(0, 3).map((p: any, i: number) => (
                <Avatar
                  key={p.user_id}
                  className="h-6 w-6 absolute border-2 border-background"
                  style={{ top: i * 5, left: i * 5, zIndex: 3 - i }}
                >
                  <AvatarImage src={p.user?.avatar_url} />
                  <AvatarFallback className="text-[8px] font-bold">
                    {(p.user?.display_name || p.user?.username || "?").charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {((selected as any).participants?.length || 0) === 0 && (
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                    {(selected.name || "G").charAt(0)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`flex min-w-0 items-center gap-1 truncate text-[15px] font-semibold leading-tight text-foreground ${selected.is_group ? "cursor-pointer hover:underline" : ""}`}
            onClick={() => { if (selected.is_group) setShowGroupInfo(true) }}
          >
            <span className="truncate">{selected.other_user?.display_name || selected.name || "Conversation"}</span>
            {!selected.is_group && selected.other_user?.is_verified && (
              <VerifiedSeal size={15} title="Verified Creator" />
            )}
            {!selected.is_group && selected.other_user?.badge_id && verificationBadges[selected.other_user.badge_id] && (
              <UserBadges badge={verificationBadges[selected.other_user.badge_id]} size="sm" />
            )}
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] leading-tight">
            {typingPeer ? (
              <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> typing…
              </span>
            ) : peerOnline ? (
              <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> online
              </span>
            ) : selected.is_group ? (
              <span className="truncate text-muted-foreground">
                {((selected as any).participants?.length || 0) > 0
                  ? `${(selected as any).participants.length} members`
                  : "Group chat"}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">
                {selected.other_user?.username ? `@${selected.other_user.username}` : "Private conversation"}
              </span>
            )}
          </p>
        </div>
        {/* Search this conversation (surfaced from the hidden More menu). */}
        <Button
          variant="ghost"
          size="icon"
          className={`text-muted-foreground hover:text-foreground ${showChatSearch ? "text-foreground" : ""}`}
          title={showChatSearch ? "Close search" : "Search in conversation"}
          onClick={() => setShowChatSearch((v) => !v)}
        >
          <Search className="h-5 w-5" />
        </Button>
        {/* Voice + video calls (100ms) — 1:1 and group chats. */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-muted-foreground hover:text-emerald-500 sm:inline-flex"
          title="Voice call"
          onClick={() => void startCall("audio")}
          disabled={Boolean(startingCall) || Boolean(outgoingCall)}
        >
          {startingCall === "audio" ? <Spinner className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-muted-foreground hover:text-primary sm:inline-flex"
          title="Video call"
          onClick={() => void startCall("video")}
          disabled={Boolean(startingCall) || Boolean(outgoingCall)}
        >
          {startingCall === "video" ? <Spinner className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
        {/* Gifting works in every conversation: 1:1 opens the gift sheet,
            groups ask which member should receive it. */}
        <GiftButton
          recipients={[
            ...(((selected as any).participants || []) as Array<{ user?: any }>).map((p) => p.user),
            selected.other_user,
          ]}
          contextFor={(recipient) => ({ type: "profile", id: String(recipient.id) })}
          className="hidden text-muted-foreground hover:text-pink-500 sm:inline-flex"
          title="Send a gift"
        />
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
              <Video className="mr-2 h-4 w-4 text-sky-500" />
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
              <Wallpaper className="mr-2 h-4 w-4 text-sky-500" />
              Chat wallpaper
              {wallpaperSaving && <Spinner className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
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
      <WallpaperPicker
        open={wallpaperPickerOpen}
        onOpenChange={setWallpaperPickerOpen}
        wallpaper={wallpaper}
        onSave={saveWallpaper}
        onUpload={(file) => void uploadWallpaper(file)}
        uploading={wallpaperUploading}
      />

      {showChatSearch && (
        <div className="border-b border-border/40 bg-background/60 px-3 py-2 backdrop-blur-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Search this chat…"
              className="h-9 rounded-lg border-border/60 bg-muted/50 pl-9 pr-24 text-sm text-foreground shadow-none"
            />
            {chatSearch.trim() && (
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {filteredMessages.length} result{filteredMessages.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => setChatSearch("")}
                  title="Clear search"
                  aria-label="Clear search"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted-foreground/15 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
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
              {publishingCoLoop ? <Spinner className="mr-2 h-4 w-4" /> : <GitBranch className="mr-2 h-4 w-4" />}
              Publish Co-Loop
            </Button>
          </div>
        </div>
      )}

      {/* Pinned message banner */}
      {selected?.is_group && pinnedMessages.length > 0 && (
        <div className="mx-2 mb-1">
          <button
            onClick={() => setPinnedExpanded(!pinnedExpanded)}
            className="flex w-full items-center gap-2 rounded-2xl border-l-2 border-amber-500 bg-amber-500/[0.08] px-3 py-2 text-left transition-colors hover:bg-amber-500/15"
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
            <span className="flex-1 truncate text-xs font-medium text-amber-700 dark:text-amber-300">
              {pinnedExpanded ? "Pinned messages" : pinnedMessages[0]?.content?.slice(0, 60) || "Pinned message"}
            </span>
            <span className="text-[10px] text-amber-600/70">{pinnedMessages.length}</span>
          </button>
          {pinnedExpanded && (
            <div className="mt-1 space-y-1 pl-2">
              {pinnedMessages.map((pm) => (
                <div key={pm.id} className="rounded-lg bg-amber-500/5 px-3 py-1.5">
                  <p className="text-[11px] text-foreground line-clamp-2">{pm.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="chat-workspace min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 pb-3 pt-7 sm:px-5">
        {messagesLoading && messages.length === 0 ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Spinner className="h-5 w-5" />
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
          const next = filteredMessages[index + 1]
          const isSystem = message.message_type === "system"
          const prevIsSystem = !prev || prev.message_type === "system"
          const nextIsSystem = !next || next.message_type === "system"
          // Consecutive messages from the same person read as ONE block: only the
          // first gets breathing room above, and only the last gets a tail corner
          // plus the timestamp — so runs no longer look like stacked cards.
          const sameSenderAsPrev =
            !prevIsSystem &&
            Boolean(prev) &&
            (prev!.sender_id || prev!.author_id) === (message.sender_id || message.author_id)
          const sameSenderAsNext =
            !nextIsSystem &&
            Boolean(next) &&
            (next!.sender_id || next!.author_id) === (message.sender_id || message.author_id)
          const isFirstOfGroup = !sameSenderAsPrev
          const isLastOfGroup = !sameSenderAsNext
          const showDate = !prev || dayLabel(prev.created_at) !== dayLabel(message.created_at)
          // In groups, show sender name/avatar when the sender changes (Telegram pattern).
          const showSenderHeader = selected?.is_group && !mine && !isSystem && isFirstOfGroup
          const actionsOpen = activeActionsId === message.id
          // Timestamps stay out of the way except on the last bubble of a run or
          // when that message's actions are open (long-press).
          const revealMeta = isLastOfGroup || actionsOpen

          // System events render as a small centered pill with a semantic icon —
          // never as a chat bubble.
          if (isSystem) {
            const SystemIcon = systemMessageIcon(message.content)
            return (
              <Fragment key={message.id}>
                {showDate && (
                  <div className="flex justify-center py-1.5">
                    <span className="rounded-full bg-foreground/[0.05] px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
                      {dayLabel(message.created_at)}
                    </span>
                  </div>
                )}
                <div className="my-1.5 flex justify-center px-4">
                  <span className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border/40 backdrop-blur-sm">
                    <SystemIcon className="h-3 w-3 shrink-0 opacity-70" />
                    <span className="truncate">{message.content}</span>
                  </span>
                </div>
              </Fragment>
            )
          }

          return (
            <Fragment key={message.id}>
              {/* Group sender name + avatar header */}
              {showSenderHeader && (
                <div className="mt-3 flex items-center gap-2 pl-1">
                  <Avatar className="h-6 w-6 ring-1 ring-border/40">
                    <AvatarImage src={message.sender?.avatar_url} />
                    <AvatarFallback className="text-[8px] font-bold">
                      {(message.sender?.display_name || message.sender?.username || "?").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn("text-xs font-semibold", senderAccentColor(message.sender_id || message.author_id || ""))}>
                    {message.sender?.display_name || message.sender?.username || "Someone"}
                  </span>
                </div>
              )}
              {showDate && (
                <div className="flex justify-center py-1.5">
                  <span className="rounded-full bg-foreground/[0.05] px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
                    {dayLabel(message.created_at)}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "group flex w-full min-w-0 max-w-full",
                  mine ? "justify-end" : "justify-start",
                  showDate ? "mt-1" : isFirstOfGroup ? "mt-2" : "mt-1",
                  isFresh && "message-appear",
                )}
                onClick={() => {
                  if (longPressFired.current === message.id) {
                    longPressFired.current = null
                    return
                  }
                  setActiveActionsId(null)
                }}
                onContextMenu={(e) => {
                  // On touch devices a long-press reveals the message actions
                  // instead of the native menu; desktop keeps right-click so
                  // text selection / copy still works.
                  if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) {
                    e.preventDefault()
                    setActiveActionsId(message.id)
                  }
                }}
                onTouchStart={(e) => {
                  cancelLongPress()
                  beginSwipe(message, e)
                  longPressTimer.current = setTimeout(() => {
                    longPressFired.current = message.id
                    setActiveActionsId(message.id)
                  }, LONG_PRESS_MS)
                }}
                onTouchEnd={() => {
                  cancelLongPress()
                  endSwipe()
                }}
                onTouchMove={(e) => {
                  moveSwipe(e)
                  // A horizontal drag is a swipe, not a long-press.
                  if (swipeRef.current?.locked === "h") cancelLongPress()
                }}
                onTouchCancel={() => {
                  cancelLongPress()
                  endSwipe()
                }}
              >
                {/* Swipe-to-reply affordance — fades in as the bubble moves */}
                {swipe?.id === message.id && Math.abs(swipe.dx) > 4 && (
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-1/2 z-0 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-sky-500/15 text-sky-500",
                      swipe.dx > 0 ? "left-1" : "right-1",
                    )}
                    style={{ opacity: Math.min(1, Math.abs(swipe.dx) / SWIPE_THRESHOLD) }}
                  >
                    <Reply className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={cn(
                    // Bubble width is capped as a % of the chat pane AND of the
                    // viewport, so long unbroken text / embeds can never push a
                    // bubble past the screen edge on narrow phones.
                    "relative min-w-0 max-w-[min(85%,calc(100vw-3rem))] sm:max-w-[min(70%,calc(100vw-4rem))]",
                  )}
                  style={
                    swipe?.id === message.id
                      ? {
                          transform: `translateX(${swipe.dx}px)`,
                          transition: swipe.settling ? "transform 0.22s cubic-bezier(0.22,1,0.36,1)" : "none",
                          touchAction: "pan-y",
                        }
                      : undefined
                  }
                >
                <div
                  className={cn(
                    "chat-bubble min-w-0 max-w-full break-words [overflow-wrap:anywhere] relative px-3.5 py-2 text-[15px] leading-[1.45]",
                    mine
                      ? cn(
                          "chat-bubble-mine bg-sky-600 text-white shadow-sm shadow-sky-950/15 dark:bg-sky-600",
                          isLastOfGroup ? "rounded-[18px] rounded-br-[6px]" : "rounded-[18px]",
                        )
                      : cn(
                          "chat-bubble-peer bg-slate-100 text-slate-900 ring-1 ring-inset ring-black/[0.04] dark:bg-slate-800 dark:text-slate-50 dark:ring-white/[0.06]",
                          isLastOfGroup ? "rounded-[18px] rounded-bl-[6px]" : "rounded-[18px]",
                        ),
                    message.is_deleted &&
                      "chat-bubble-peer rounded-[18px] rounded-bl-[6px] bg-muted/70 italic text-muted-foreground",
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
                            mine ? "text-white/80" : "text-muted-foreground",
                          )}
                        >
                          <CornerUpRight className="h-3 w-3" />
                          Forwarded from {message.forwarded_from}
                        </p>
                      )}
                      {message.reply_to && (
                        <div
                          className={cn(
                            "mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px]",
                            mine ? "border-white/40 bg-white/10" : "border-sky-400/70 bg-muted/70",
                          )}
                        >
                          <p className={cn("truncate font-semibold", mine ? "text-sky-50" : "text-sky-700 dark:text-sky-300")}>
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
                          message.message_type === "gif" ||
                          message.message_type === "sticker") && (
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
                        <ProtectedMedia type="video" src={message.media_url} className="mb-1 max-h-64 w-full rounded-lg" />
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
                      {revealMeta && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] leading-none opacity-70">
                          <span className="tabular-nums">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {message.edited_at && <span className="italic opacity-80">Edited</span>}
                          {mine &&
                            (read ? (
                              <CheckCheck className="h-3.5 w-3.5 text-white/85" aria-label="Seen" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-white/80" aria-label="Sent" />
                            ))}
                        </div>
                      )}
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
                        aria-pressed={Boolean(r.users?.includes(user.id))}
                        title={r.users?.includes(user.id) ? "Remove your reaction" : "Add your reaction"}
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset transition-all active:scale-95",
                          r.users?.includes(user.id)
                            ? "bg-sky-500/15 text-sky-700 ring-sky-500/40 dark:text-sky-300"
                            : "bg-background/80 text-foreground ring-border/50 hover:bg-muted",
                        )}
                      >
                        <AnimatedEmoji emoji={r.emoji} size={15} className="leading-none" />
                        <span className="tabular-nums">{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Hover / long-press toolbar — floats over the bubble edge so it
                    never reserves dead height under every message. */}
                {!message.is_deleted && (
                  <div
                    className={cn(
                      "absolute -top-4 z-30 flex items-center gap-0.5 rounded-full border border-border/70 bg-popover/95 p-0.5 shadow-lg shadow-black/10 backdrop-blur transition-opacity duration-150",
                      actionsOpen
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 sm:pointer-events-auto sm:group-hover:pointer-events-auto sm:group-hover:opacity-100",
                      mine ? "right-1.5" : "left-1.5",
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={`React with ${emoji}`}
                        title={`React with ${emoji}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] leading-none transition-transform hover:scale-110 hover:bg-sky-500/10 active:scale-95"
                        onClick={() => {
                          void toggleReaction(message, emoji)
                          setActiveActionsId(null)
                        }}
                      >
                        <AnimatedEmoji emoji={emoji} size={15} />
                      </button>
                    ))}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="More reactions"
                          title="More reactions"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={mine ? "end" : "start"} side="top" className="w-72 p-2">
                        <EmojiPicker
                          mode="animated"
                          onSelect={(emoji) => {
                            void toggleReaction(message, emoji)
                            setActiveActionsId(null)
                          }}
                          maxHeightClassName="max-h-40"
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="mx-0.5 h-4 w-px bg-border/70" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Message actions"
                          title="Message actions"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={mine ? "end" : "start"} side="top" className="w-48">
                        <DropdownMenuItem onClick={() => setReplyTo(message)}>
                          <Reply className="mr-2 h-4 w-4" /> Reply
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void copyMessage(message)}>
                          <Copy className="mr-2 h-4 w-4" /> Copy text
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => forwardMessage(message)}>
                          <CornerUpRight className="mr-2 h-4 w-4" /> Forward
                        </DropdownMenuItem>
                        {mine && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => startEdit(message)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => requestDelete(message)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete for everyone
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
            </Fragment>
          )
        })}
        {typingPeer && (
          <div className="message-appear mt-2 flex justify-start">
            <div className="chat-bubble chat-bubble-peer flex items-center gap-1 rounded-[18px] rounded-bl-[6px] bg-slate-100 px-3.5 py-2 ring-1 ring-inset ring-black/[0.04] dark:bg-slate-800 dark:ring-white/[0.06]">
              {selected?.is_group && groupTypers.size > 0 ? (
                <div className="flex items-center gap-1.5">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  <span className="text-[11px] text-muted-foreground ml-1">
                    {groupTypers.size === 1
                      ? Array.from(groupTypers.values())[0].name + " is typing..."
                      : groupTypers.size === 2
                        ? "2 people are typing..."
                        : "Several people are typing..."}
                  </span>
                </div>
              ) : (
                <><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
        {!atBottom && selected && (
          <div className="sticky bottom-0 z-10 flex justify-center pb-1 pt-2">
            <button
              type="button"
              onClick={scrollToLatest}
              className="flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition hover:bg-background"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              {unseenBelow > 0 ? `${unseenBelow} new message${unseenBelow === 1 ? "" : "s"}` : "Jump to latest"}
            </button>
          </div>
        )}
        {/* Load older messages */}
        {hasMoreMessages && !messagesLoading && messages.length >= MESSAGE_PAGE_SIZE && (
          <div className="flex justify-center py-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full"
              disabled={loadingOlder}
              onClick={() => selectedId && void loadMessages(selectedId, true)}
            >
              {loadingOlder ? (
                <><Spinner className="h-3 w-3 mr-1.5" /> Loading older messages...</>
              ) : (
                "Load older messages"
              )}
            </Button>
          </div>
        )}
      </div>

      {replyTo && (
        <div className="mx-2 mb-1 flex items-center gap-2 rounded-2xl border-l-2 border-sky-500 bg-sky-500/[0.07] px-3 py-2 text-sm text-foreground backdrop-blur-xl sm:mx-3">
          <Reply className="h-3.5 w-3.5 shrink-0 text-sky-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">Replying to message</p>
            <p className="truncate text-xs text-muted-foreground">{replyTo.content || "Media"}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={() => setReplyTo(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {editingMessage && (
        <div className="mx-2 mb-1 rounded-2xl border-l-2 border-sky-500 bg-sky-500/[0.07] px-3 py-2 text-sm text-foreground backdrop-blur-xl sm:mx-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
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
              className="shrink-0 bg-sky-600 text-white hover:bg-sky-500"
            >
              {savingEdit ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {deletingMessage && (
        <div className="mx-2 mb-1 flex items-center justify-between gap-2 rounded-2xl border-l-2 border-rose-500 bg-rose-500/10 px-3 py-2 text-sm text-foreground backdrop-blur-xl sm:mx-3">
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

      <div className="relative z-[1] shrink-0 border-t border-border/60 bg-background/90 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-2xl sm:px-3">
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

        <GifPicker
          open={showGifPicker}
          onClose={() => setShowGifPicker(false)}
          search={gifSearch}
          onSearchChange={setGifSearch}
          onSearchDebounced={(v) => {
            if (gifTimerRef.current) clearTimeout(gifTimerRef.current)
            const t = setTimeout(() => void loadGifs(v), 350)
            gifTimerRef.current = t
          }}
          results={gifResults}
          loading={gifsLoading}
          onSelect={(gifUrl) => {
            void sendMessage({ content: "", media_url: gifUrl, message_type: "gif" })
            setShowGifPicker(false)
            setGifSearch("")
          }}
        />
        <div className="flex items-end gap-1.5">
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
                className="h-10 w-10 shrink-0 rounded-full border border-border/50 bg-foreground/[0.04] text-foreground/80 shadow-sm backdrop-blur transition hover:bg-foreground/10 hover:text-foreground"
              >
                {uploading ? <Spinner className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52">
              <DropdownMenuItem disabled={uploading} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4 text-sky-500" />
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
          <div className="relative min-w-0 flex-1 rounded-[22px] border border-border/60 bg-background shadow-sm backdrop-blur transition-colors focus-within:border-sky-500/50 focus-within:ring-2 focus-within:ring-sky-500/10">
            <MentionTextarea
              value={draft}
              onChange={onDraftChange}
              rows={1}
              placeholder="Message"
              className="min-h-[40px] resize-none rounded-[22px] border-0 bg-transparent py-2.5 pl-4 pr-24 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!sending) void sendMessage()
                }
              }}
            />

            {recording ? (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center gap-2 px-3 rounded-full bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-right-2 duration-200">
                <VoiceRecorderWaves
                  recording={recording}
                  paused={recordingPaused}
                  barCount={36}
                  color="#ef4444"
                  maxBarHeight={24}
                  minBarHeight={2}
                  className="flex-1 h-full"
                />
                <div className="flex items-center gap-1.5 shrink-0">
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
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-sky-600 text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-500 disabled:opacity-60"
              >
                {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </button>
            ) : (
              <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                <button
                  type="button"
                  title="Emoji"
                  aria-label="Emoji"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/[0.08] hover:text-foreground",
                    showEmojiPicker && "bg-sky-500/10 text-sky-600 dark:text-sky-400",
                  )}
                  onClick={() => {
                    setShowEmojiPicker((v) => !v)
                    setShowGifPicker(false)
                  }}
                >
                  <Smile className="h-[19px] w-[19px]" />
                </button>
                <button
                  type="button"
                  title="Voice message"
                  aria-label="Voice message"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-sky-500/10 hover:text-sky-600"
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

    </section>
  ) : selectedId ? (
    <section className="flex h-full flex-col items-center justify-center bg-background px-6 text-center text-muted-foreground">
      {loading || messagesLoading ? (
        <Spinner className="h-6 w-6" />
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
    <section className="relative hidden h-full flex-col items-center justify-center overflow-hidden bg-background px-8 text-center text-muted-foreground lg:flex">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.07),transparent_62%)]" />
      <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-[26px] bg-sky-500/10 ring-1 ring-sky-500/20">
        <MessageCircle className="h-9 w-9 text-sky-600/80 dark:text-sky-400/80" />
      </div>
      <p className="relative text-xl font-semibold tracking-tight text-foreground">Your messages</p>
      <p className="relative mt-1.5 max-w-[320px] text-sm leading-relaxed text-muted-foreground">
        Choose a chat to keep talking, or start a Co-Loop and publish something together.
      </p>
      <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-full border border-border/60 px-2.5 py-1">🔒 Just the two of you</span>
        <span className="rounded-full border border-border/60 px-2.5 py-1">⚡ Live delivery</span>
      </div>
    </section>
  )

  return (
    <div
      className={cn(
        "relative grid h-full w-full min-h-0 min-w-0 grid-rows-1 overflow-hidden bg-background lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] lg:rounded-2xl lg:border lg:border-border/70 lg:shadow-xl lg:shadow-black/[0.04]",
      )}
    >
      <div className={cn("h-full min-h-0 min-w-0 overflow-hidden lg:border-r lg:border-border/60", mobileShowChat ? "hidden lg:block" : "block")}>{inbox}</div>
      <div className={cn("relative h-full min-h-0 min-w-0 overflow-hidden", mobileShowChat ? "block" : "hidden lg:block")}>{chatPane}</div>
      {/* Incoming call banner */}
      {incomingCall && (
        <div className="fixed left-1/2 top-4 z-[115] w-[min(94vw,430px)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
            <Avatar className="h-11 w-11 ring-2 ring-emerald-500/50">
              <AvatarImage src={incomingCall.avatarUrl} />
              <AvatarFallback className="bg-gradient-to-br from-sky-600 to-cyan-500 text-sm font-bold">
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

      {/* Group creation dialog */}
      <GroupCreateDialog
        open={showGroupCreate}
        onClose={() => setShowGroupCreate(false)}
        onCreated={(convId) => {
          setSelectedId(convId)
          setMobileShowChat(true)
          setShowGroupCreate(false)
          void loadConversations()
        }}
      />

      {/* Group info panel */}
      {showGroupInfo && selected ? (
        <div className="absolute inset-0 z-40 flex flex-col bg-background shadow-xl lg:inset-y-0 lg:left-auto lg:right-0 lg:w-80 lg:border-l lg:border-border/60">
          <GroupInfoPanel
            conversationId={String(selected.id)}
            onClose={() => setShowGroupInfo(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
