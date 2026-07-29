"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { GiftModal } from "@/components/gifting/gift-modal"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  CheckCheck,
  GitBranch,
  Gift,
  ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Reply,
  Search,
  Send,
  Smile,
  Sparkles,
  X,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

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
  } | null
}

interface ChatMessage {
  id: string
  content: string
  sender_id?: string
  author_id?: string
  created_at: string
  media_url?: string | null
  media_type?: string | null
  message_type?: string
  reply_to_id?: string | null
  reply_to?: { id: string; content?: string; sender_id?: string; author_id?: string } | null
  reactions?: Array<{ emoji: string; count: number; users?: string[] }>
  sender?: {
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string
  } | null
}

const QUICK_REACTIONS = ["❤️", "😂", "👍", "🔥", "😮", "👏"]

export function MessagesWorkspace() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("c"))
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(searchParams.get("c")))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [search, setSearch] = useState("")
  const [chatSearch, setChatSearch] = useState("")
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [typingPeer, setTypingPeer] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [showGift, setShowGift] = useState(false)
  const [showCoLoop, setShowCoLoop] = useState(false)
  const [coLoopDraft, setCoLoopDraft] = useState("")
  const [coLoopPeerDraft, setCoLoopPeerDraft] = useState("")
  const [publishingCoLoop, setPublishingCoLoop] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      setConversations(data.conversations || [])
      if (!selectedId && data.conversations?.[0]?.id && typeof window !== "undefined" && window.innerWidth >= 1024) {
        setSelectedId(data.conversations[0].id)
      }
    } catch (error: any) {
      toast({ title: "Chat unavailable", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    if (!user) return
    const response = await fetch(`/api/messages?conversation_id=${conversationId}`, {
      headers: getAuthHeader(),
    })
    const data = await response.json()
    if (response.ok) {
      const list: ChatMessage[] = data.messages || []
      const byId = new Map(list.map((m) => [m.id, m]))
      setMessages(
        list.map((m) => ({
          ...m,
          reply_to: m.reply_to || (m.reply_to_id ? byId.get(m.reply_to_id) || null : null),
          reactions: Array.isArray(m.reactions) ? m.reactions : [],
        })),
      )
    }
  }

  useEffect(() => {
    void loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!selectedId || !user) return
    void loadMessages(selectedId)

    const channel = supabase.channel(`conversation:${selectedId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (!payload?.id) return
        setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]))
        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === selectedId
                ? { ...c, last_message: { content: payload.content, created_at: payload.created_at } }
                : c,
            )
            .sort((a, b) => (b.last_message?.created_at || "").localeCompare(a.last_message?.created_at || "")),
        )
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.user_id && payload.user_id !== user.id) {
          setTypingPeer(true)
          setTimeout(() => setTypingPeer(false), 2500)
        }
      })
      .on("broadcast", { event: "reaction" }, () => {
        void loadMessages(selectedId)
      })
      .on("broadcast", { event: "coloop" }, ({ payload }) => {
        if (!payload || payload.user_id === user.id) return
        setCoLoopPeerDraft(String(payload.content || ""))
        if (!showCoLoop) setShowCoLoop(true)
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` },
        () => void loadMessages(selectedId),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, typingPeer])

  const broadcastTyping = () => {
    if (!selectedId || !user) return
    void supabase.channel(`conversation:${selectedId}`).send({
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
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("c", id)
      window.history.replaceState({}, "", url.toString())
    }
  }

  const backToInbox = () => {
    setMobileShowChat(false)
    setReplyTo(null)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.delete("c")
      window.history.replaceState({}, "", url.toString())
    }
  }

  const sendMessage = async (opts?: { content?: string; media_url?: string; message_type?: string }) => {
    if (!user || !selectedId) return
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
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", messageType === "audio" ? "audio" : messageType)
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { ...getAuthHeader() },
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed")
      const url = uploadData.url || uploadData.data?.url
      if (!url) throw new Error("No media URL")
      await sendMessage({
        content: messageType === "audio" ? "Voice note" : "",
        media_url: url,
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
    await fetch("/api/messages/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ message_id: message.id, emoji, action: reacted ? "remove" : "add" }),
    }).catch(() => {})
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
    if (!selectedId || !user) return
    void supabase.channel(`conversation:${selectedId}`).send({
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
    <aside className="flex h-full min-h-0 flex-col bg-[#0b141a] text-slate-100">
      <div className="space-y-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Chats</h1>
          <span className="text-xs text-emerald-400">{conversations.length} active</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start new chat"
              className="border-white/10 bg-[#202c33] pl-9 text-slate-100 placeholder:text-slate-400"
              onKeyDown={(e) => e.key === "Enter" && void startChat()}
            />
          </div>
          <Button onClick={() => void startChat()} disabled={starting} className="bg-emerald-600 hover:bg-emerald-500">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No chats yet. Search a username to message someone.
          </div>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => openConversation(conversation.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left hover:bg-white/5",
                selectedId === conversation.id && "bg-white/10",
              )}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={conversation.other_user?.avatar_url} />
                <AvatarFallback className="bg-emerald-700">
                  {(conversation.other_user?.display_name || conversation.name || "C").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">
                    {conversation.is_group
                      ? conversation.name || "Group"
                      : conversation.other_user?.display_name || `@${conversation.other_user?.username || "user"}`}
                  </p>
                  {conversation.last_message?.created_at && (
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatDistanceToNow(new Date(conversation.last_message.created_at), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-slate-400">{conversation.last_message?.content || "Say hello 👋"}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  )

  const chatPane = selected ? (
    <section className="relative flex h-full min-h-0 flex-col bg-[url('data:image/svg+xml,%3Csvg width%3D%2260%27 height%3D%2260%27 viewBox%3D%220 0 60 60%27 xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%3E%3Cg fill%3D%22none%22 fill-rule%3D%22evenodd%22%3E%3Cg fill%3D%22%23ffffff%22 fill-opacity%3D%220.03%22%3E%3Cpath d%3D%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] bg-[#0b141a]">
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#202c33] px-2 py-2.5 sm:px-4">
        <Button variant="ghost" size="icon" className="text-slate-200 lg:hidden" onClick={backToInbox}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarImage src={selected.other_user?.avatar_url} />
          <AvatarFallback>{(selected.other_user?.display_name || "U").charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-100">
            {selected.other_user?.display_name || selected.name || "Conversation"}
          </p>
          <p className="truncate text-xs text-emerald-400">
            {typingPeer ? "typing…" : `@${selected.other_user?.username || "group"}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-200"
          title="Search in chat"
          onClick={() => setShowChatSearch((v) => !v)}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-amber-300"
          title="Co-Loop — write a public loop together (unique to Loop)"
          onClick={() => setShowCoLoop((v) => !v)}
        >
          <GitBranch className="h-4 w-4" />
        </Button>
        {selected.other_user?.id && (
          <Button variant="ghost" size="icon" className="text-pink-300" onClick={() => setShowGift(true)}>
            <Gift className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showChatSearch && (
        <div className="border-b border-white/10 bg-[#111b21] px-3 py-2">
          <Input
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Search this chat…"
            className="border-white/10 bg-[#202c33] text-slate-100"
          />
        </div>
      )}

      {showCoLoop && (
        <div className="border-b border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#111b21] to-emerald-500/10 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
              <Sparkles className="h-4 w-4" />
              Co-Loop
              <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] font-normal text-amber-100">
                Only on Loop
              </span>
            </p>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300" onClick={() => setShowCoLoop(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mb-2 text-xs text-slate-400">
            Write a public loop together in realtime — Instagram and X can’t co-author posts inside DMs.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Textarea
              value={coLoopDraft}
              onChange={(e) => syncCoLoop(e.target.value)}
              placeholder="Your half of the Co-Loop…"
              className="min-h-[88px] border-white/10 bg-[#202c33] text-slate-100"
            />
            <div className="rounded-md border border-dashed border-white/15 bg-[#0b141a] p-3 text-sm text-slate-300">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Their live draft</p>
              {coLoopPeerDraft || <span className="text-slate-500">Waiting for them to type…</span>}
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
        {filteredMessages.map((message) => {
          const mine = (message.sender_id || message.author_id) === user.id
          return (
            <div key={message.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "relative rounded-2xl px-3 py-2 text-sm shadow-sm",
                    mine ? "rounded-br-md bg-[#005c4b] text-white" : "rounded-bl-md bg-[#202c33] text-slate-100",
                  )}
                >
                  {message.reply_to && (
                    <div className="mb-1.5 rounded-lg border-l-2 border-emerald-400/70 bg-black/20 px-2 py-1 text-[11px] opacity-90">
                      <p className="font-medium">Reply</p>
                      <p className="truncate">{message.reply_to.content || "Media"}</p>
                    </div>
                  )}
                  {message.media_url && (message.media_type === "image" || message.message_type === "image") && (
                    <img src={message.media_url} alt="" className="mb-1 max-h-64 w-full rounded-lg object-cover" />
                  )}
                  {message.media_url && (message.media_type === "audio" || message.message_type === "audio") && (
                    <audio controls src={message.media_url} className="mb-1 w-full max-w-[240px]" />
                  )}
                  {message.media_url && (message.media_type === "video" || message.message_type === "video") && (
                    <video controls src={message.media_url} className="mb-1 max-h-64 w-full rounded-lg" />
                  )}
                  {message.content && !(message.message_type === "audio" && message.content === "Voice note") && (
                    <RichContent text={message.content} className="whitespace-pre-wrap break-words" as="p" />
                  )}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                    <span>
                      {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {mine && <CheckCheck className="h-3 w-3 text-sky-300" />}
                  </div>
                </div>

                {(message.reactions?.length || 0) > 0 && (
                  <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
                    {message.reactions!.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={() => void toggleReaction(message, r.emoji)}
                        className="rounded-full bg-[#202c33] px-1.5 py-0.5 text-xs"
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={cn(
                    "mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-slate-300"
                    onClick={() => setReplyTo(message)}
                  >
                    <Reply className="mr-1 h-3.5 w-3.5" /> Reply
                  </Button>
                  {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="rounded-full px-1.5 text-sm hover:bg-white/10"
                      onClick={() => void toggleReaction(message, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        {typingPeer && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-[#202c33] px-3 py-2 text-xs text-slate-300">typing…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex items-center justify-between border-t border-white/10 bg-[#111b21] px-3 py-2 text-sm text-slate-200">
          <div className="min-w-0">
            <p className="text-xs text-emerald-400">Replying</p>
            <p className="truncate">{replyTo.content || "Media"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setReplyTo(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-white/10 bg-[#202c33] p-2 sm:p-3">
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
          className="text-slate-300"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-slate-300", recording && "text-red-400")}
          onClick={() => (recording ? stopVoice() : void startVoice())}
        >
          {recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <div className="relative flex-1">
          <MentionTextarea
            value={draft}
            onChange={onDraftChange}
            rows={1}
            placeholder="Message… @ to tag"
            className="min-h-[40px] resize-none border-white/10 bg-[#2a3942] pr-10 text-slate-100 placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void sendMessage()
              }
            }}
          />
          <Smile className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <Button
          onClick={() => void sendMessage()}
          disabled={sending || (!draft.trim() && !uploading)}
          className="rounded-full bg-emerald-600 hover:bg-emerald-500"
          size="icon"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

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
  ) : (
    <section className="hidden h-full flex-col items-center justify-center bg-[#0b141a] text-slate-400 lg:flex">
      <ImageIcon className="mb-3 h-12 w-12 opacity-40" />
      <p className="text-lg font-medium text-slate-200">Loop Chat</p>
      <p className="mt-1 max-w-sm text-center text-sm">
        Pick a conversation — or start a Co-Loop and publish a post together from the chat.
      </p>
    </section>
  )

  return (
    <div className="grid h-[calc(100dvh-3.5rem)] overflow-hidden border border-white/10 bg-[#0b141a] lg:h-[calc(100dvh-4rem)] lg:grid-cols-[340px_1fr] lg:rounded-2xl">
      <div className={cn("min-h-0", mobileShowChat ? "hidden lg:block" : "block")}>{inbox}</div>
      <div className={cn("min-h-0", mobileShowChat ? "block" : "hidden lg:block")}>{chatPane}</div>
    </div>
  )
}
