"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { formatDistanceToNow } from "date-fns"
import {
  Loader2,
  MessageCircle,
  Send,
  HeadphonesIcon,
  User,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Hourglass,
} from "lucide-react"

interface SupportMessage {
  id: string
  message: string
  is_from_support: boolean
  created_at: string
  sender?: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_admin?: boolean
    is_moderator?: boolean
  }
}

interface SupportTicket {
  id: string
  subject: string
  status: string
  priority: string
  category?: string
  created_at: string
  updated_at?: string
  user?: { id: string; username: string; display_name: string; avatar_url?: string }
  last_message?: { message: string; created_at: string } | null
}

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"]
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
}

export function AdminSupportPanel() {
  const { getAuthHeader } = useAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/support/tickets", { headers: getAuthHeader() })
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
      }
    } catch (error) {
      console.error("Failed to load tickets:", error)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  const loadMessages = useCallback(
    async (ticketId: string) => {
      try {
        const res = await fetch(`/api/support/messages?ticketId=${ticketId}`, { headers: getAuthHeader() })
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
        }
      } catch (error) {
        console.error("Failed to load messages:", error)
      }
    },
    [getAuthHeader],
  )

  useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  useEffect(() => {
    if (!activeTicket) return
    void loadMessages(activeTicket.id)

    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`admin-support:${activeTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${activeTicket.id}`,
        },
        (payload: { new: Record<string, any> }) => {
          const row = payload.new
          if (!row || !row.id) return
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row as any]))
          setTickets((prev) =>
            prev.map((t) =>
              t.id === activeTicket.id
                ? { ...t, last_message: { message: row.message, created_at: row.created_at } }
                : t,
            ),
          )
        },
      )
      .subscribe()

    // Fallback refresh for environments without the realtime publication
    const interval = setInterval(() => {
      void loadMessages(activeTicket.id)
    }, 15000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [activeTicket?.id, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendReply = async () => {
    if (!draft.trim() || !activeTicket || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ ticketId: activeTicket.id, message: draft.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        setDraft("")
        setTickets((prev) =>
          prev.map((t) =>
            t.id === activeTicket.id ? { ...t, last_message: { message: data.message.message, created_at: new Date().toISOString() } } : t,
          ),
        )
      }
    } catch (error) {
      console.error("Failed to send reply:", error)
    } finally {
      setSending(false)
    }
  }

  const setStatus = async (status: string) => {
    if (!activeTicket) return
    try {
      const res = await fetch("/api/support/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ ticketId: activeTicket.id, status }),
      })
      if (res.ok) {
        const data = await res.json()
        setActiveTicket((prev) => (prev ? { ...prev, status: data.ticket.status } : prev))
        setTickets((prev) => prev.map((t) => (t.id === activeTicket.id ? { ...t, status: data.ticket.status } : t)))
      }
    } catch (error) {
      console.error("Failed to update status:", error)
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "resolved": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      case "closed": return <Circle className="h-3.5 w-3.5 text-muted-foreground" />
      case "in_progress": return <Hourglass className="h-3.5 w-3.5 text-amber-500" />
      default: return <Circle className="h-3.5 w-3.5 text-sky-500" />
    }
  }

  const openTicket = (ticket: SupportTicket) => {
    setActiveTicket(ticket)
    setMobileShowChat(true)
  }

  return (
    <div className="grid h-[calc(100dvh-12rem)] min-h-[480px] overflow-hidden rounded-2xl border border-border bg-background lg:grid-cols-[340px_1fr]">
      {/* Ticket list */}
      <div className={mobileShowChat ? "hidden min-h-0 flex-col lg:flex" : "flex min-h-0 flex-col"}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5" /> Support Inbox
            <Badge variant="secondary" className="ml-1 rounded-full">{tickets.filter((t) => t.status === "open" || t.status === "in_progress").length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => void loadTickets()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No support tickets yet.</p>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    activeTicket?.id === ticket.id ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:bg-muted/50"
                  }`}
                  onClick={() => openTicket(ticket)}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{ticket.subject}</p>
                    {statusIcon(ticket.status)}
                  </div>
                  <p className="mb-2 truncate text-xs text-muted-foreground">
                    {ticket.user?.display_name || ticket.user?.username || "Unknown"} · {ticket.last_message?.message || ticket.category || "No messages"}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <Badge variant="outline" className={ticket.priority === "high" ? "border-red-500/40 text-red-500" : ticket.priority === "medium" ? "border-amber-500/40 text-amber-600" : ""}>
                      {ticket.priority}
                    </Badge>
                    <span>{formatDistanceToNow(new Date(ticket.created_at))} ago</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Conversation */}
      <div className={mobileShowChat ? "flex min-h-0 flex-col" : "hidden min-h-0 flex-col lg:flex"}>
        {activeTicket ? (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileShowChat(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-9 w-9">
                <AvatarImage src={activeTicket.user?.avatar_url} />
                <AvatarFallback>
                  {(activeTicket.user?.display_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{activeTicket.subject}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  @{activeTicket.user?.username || "user"} · {activeTicket.category || "general"} ·{" "}
                  {formatDistanceToNow(new Date(activeTicket.created_at))} ago
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No messages in this conversation yet.</p>
                )}
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.is_from_support ? "justify-end" : "justify-start"}`}>
                    <div className={`flex max-w-[85%] items-start gap-2 sm:max-w-[75%] ${message.is_from_support ? "flex-row-reverse" : ""}`}>
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={message.sender?.avatar_url} />
                        <AvatarFallback className="text-[10px]">
                          {message.is_from_support ? <HeadphonesIcon className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                          message.is_from_support
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-muted text-foreground"
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{message.message}</p>
                          <p className={`mt-1 text-[10px] ${message.is_from_support ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {message.sender?.display_name || (message.is_from_support ? "Support" : "User")} ·{" "}
                            {formatDistanceToNow(new Date(message.created_at))} ago
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="space-y-2 border-t border-border bg-muted/50 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_OPTIONS.map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={activeTicket.status === status ? "default" : "outline"}
                    className="rounded-full text-xs"
                    onClick={() => void setStatus(status)}
                  >
                    {STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply as Loop support…"
                  rows={1}
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border-border bg-background px-4"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void sendReply()
                    }
                  }}
                />
                <Button
                  onClick={() => void sendReply()}
                  disabled={!draft.trim() || sending}
                  size="icon"
                  className="h-11 w-11 rounded-full p-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-muted-foreground">
            <HeadphonesIcon className="mb-3 h-12 w-12 opacity-40" />
            <p className="text-lg font-medium text-foreground">Support inbox</p>
            <p className="mt-1 max-w-sm text-sm">Select a ticket to read the conversation and reply — updates arrive in real time.</p>
          </div>
        )}
      </div>
    </div>
  )
}
