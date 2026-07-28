"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Loader2, MessageCircle, Search, Send } from "lucide-react"
import { cn } from "@/lib/utils"

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
  sender?: {
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string
  } | null
}

export function MessagesWorkspace() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("c"))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  )

  const loadConversations = async () => {
    if (!user) return
    setLoading(true)
    try {
      const response = await fetch("/api/conversations", { headers: getAuthHeader() })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load conversations")
      setConversations(data.conversations || [])
      if (!selectedId && data.conversations?.[0]?.id) {
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
    if (response.ok) setMessages(data.messages || [])
  }

  useEffect(() => {
    loadConversations()
  }, [user?.id])

  useEffect(() => {
    if (!selectedId) return
    loadMessages(selectedId)

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
            .sort((a, b) => {
              const at = a.last_message?.created_at || ""
              const bt = b.last_message?.created_at || ""
              return bt.localeCompare(at)
            }),
        )
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        () => {
          void loadMessages(selectedId)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedId, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const sendMessage = async () => {
    if (!user || !selectedId || !draft.trim()) return
    setSending(true)
    const content = draft.trim()
    setDraft("")
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ conversation_id: selectedId, content }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to send")
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]))
    } catch (error: any) {
      setDraft(content)
      toast({ title: "Send failed", description: error.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
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

      // Fallback profile lookup by exact username
      if (!users.length) {
        const profileRes = await fetch(`/api/users/profile?username=${encodeURIComponent(search.replace(/^@/, "").trim())}`)
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
      setSelectedId(data.conversation.id)
    } catch (error: any) {
      toast({ title: "Could not start chat", description: error.message, variant: "destructive" })
    } finally {
      setStarting(false)
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Sign in to chat with other Loop users.
      </div>
    )
  }

  return (
    <div className="grid h-[calc(100dvh-4rem)] overflow-hidden rounded-2xl border bg-card lg:grid-cols-[320px_1fr]">
      <aside className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b p-4">
          <h1 className="text-lg font-semibold">Messages</h1>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Username to chat..."
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && startChat()}
              />
            </div>
            <Button onClick={startChat} disabled={starting}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Chat"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Message people you follow — or anyone on Loop by username.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No conversations yet. Search a username to start chatting.
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b px-4 py-3 text-left hover:bg-muted/50",
                  selectedId === conversation.id && "bg-muted",
                )}
              >
                <Avatar>
                  <AvatarImage src={conversation.other_user?.avatar_url} />
                  <AvatarFallback>
                    {(conversation.other_user?.display_name || conversation.name || "C").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {conversation.is_group
                      ? conversation.name || "Group"
                      : conversation.other_user?.display_name || `@${conversation.other_user?.username || "user"}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {conversation.last_message?.content || "No messages yet"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        {selected ? (
          <>
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Avatar>
                <AvatarImage src={selected.other_user?.avatar_url} />
                <AvatarFallback>
                  {(selected.other_user?.display_name || "U").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">
                  {selected.other_user?.display_name || selected.name || "Conversation"}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{selected.other_user?.username || "group"}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message) => {
                const mine = (message.sender_id || message.author_id) === user.id
                return (
                  <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        mine ? "bg-gradient-to-r from-violet-600 to-cyan-500 text-white" : "bg-muted",
                      )}
                    >
                      {!mine && (
                        <p className="mb-1 text-[11px] opacity-70">
                          @{message.sender?.username || "user"}
                        </p>
                      )}
                      <p>{message.content}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 border-t p-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              />
              <Button onClick={sendMessage} disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageCircle className="h-10 w-10" />
            <p>Select a conversation or start a new chat</p>
          </div>
        )}
      </section>
    </div>
  )
}
