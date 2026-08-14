"use client";
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 as Spinner } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, User, HeadphonesIcon, Clock, AlertCircle, ArrowLeft, Plus, Loader2, CheckCircle2, Circle, Hourglass } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatDistanceToNow } from "date-fns";

interface SupportMessage {
  id: string
  message: string
  is_from_support: boolean
  created_at: string
  user?: {
    username: string
    display_name: string
    avatar_url?: string
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
  last_message?: { message: string; created_at: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
}

function SupportChatInner() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkTicket = searchParams.get("ticket")

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  // Mobile: show chat pane when a ticket is selected
  const [mobileShowChat, setMobileShowChat] = useState(false)

  // New ticket form
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [newTicketForm, setNewTicketForm] = useState({
    subject: "",
    category: "technical",
    message: "",
    priority: "medium"
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchTickets = useCallback(async () => {
    try {
      const response = await fetch('/api/support/tickets')
      if (response.ok) {
        const data = await response.json()
        setTickets(data.tickets || [])
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (ticketId: string) => {
    try {
      const response = await fetch(`/api/support/messages?ticketId=${ticketId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }, [])

  // Pick the ticket to open (deep link first, then most recent)
  useEffect(() => {
    if (!user || tickets.length === 0) return
    if (deepLinkTicket) {
      const target = tickets.find((t) => t.id === deepLinkTicket)
      if (target) {
        setActiveTicket(target)
        setMobileShowChat(true)
      }
    } else if (!activeTicket) {
      setActiveTicket(tickets[0])
    }
  }, [user, tickets, deepLinkTicket, activeTicket])

  useEffect(() => {
    if (user) {
      fetchTickets()
    }
  }, [user, fetchTickets])

  // Real-time: subscribe to new support messages + status changes for the
  // open ticket, instead of polling.
  useEffect(() => {
    if (!activeTicket) return
    fetchMessages(activeTicket.id)

    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`support-ticket:${activeTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${activeTicket.id}`,
        },
        (payload: { new: Record<string, any> }) => {
          const row = payload.new
          if (!row || !row.id) return
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [
              ...prev,
              {
                id: row.id,
                message: row.message,
                is_from_support: Boolean(row.is_from_support),
                created_at: row.created_at,
              },
            ]
          })
          // Bump the ticket's preview in the list
          setTickets((prev) =>
            prev.map((t) =>
              t.id === activeTicket.id
                ? { ...t, last_message: { message: row.message, created_at: row.created_at } }
                : t,
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `id=eq.${activeTicket.id}`,
        },
        (payload: { new: Record<string, any> }) => {
          const row = payload.new
          setActiveTicket((prev) => (prev ? { ...prev, status: row.status, updated_at: row.updated_at } : prev))
          setTickets((prev) => prev.map((t) => (t.id === row.id ? { ...t, ...row } : t)))
        },
      )
      .subscribe()

    channelRef.current = channel

    // Keep polling as a fallback for environments where the realtime
    // publication isn't enabled for these tables yet.
    const interval = setInterval(() => {
      fetchMessages(activeTicket.id)
      fetchTickets()
    }, 20000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [activeTicket?.id, fetchMessages, fetchTickets])

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeTicket || sending) return

    setSending(true)
    try {
      const response = await fetch('/api/support/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          message: newMessage.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage("")
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const createNewTicket = async () => {
    if (!newTicketForm.subject || !newTicketForm.message || creatingTicket) return
    setCreatingTicket(true)
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTicketForm),
      })

      if (response.ok) {
        const data = await response.json()
        setTickets(prev => [data.ticket, ...prev])
        setActiveTicket(data.ticket)
        setMobileShowChat(true)
        setShowNewTicket(false)
        setNewTicketForm({
          subject: "",
          category: "technical",
          message: "",
          priority: "medium"
        })
        fetchMessages(data.ticket.id)
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
    } finally {
      setCreatingTicket(false)
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      case 'closed': return <Circle className="h-3.5 w-3.5 text-muted-foreground" />
      case 'in_progress': return <Hourglass className="h-3.5 w-3.5 text-amber-500" />
      default: return <Circle className="h-3.5 w-3.5 text-sky-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
      case 'in_progress': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      case 'resolved': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      case 'closed': return 'bg-muted text-muted-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
      case 'medium': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
      case 'low': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading support…
        </div>
      </div>
    )
  }

  const selectTicket = (ticket: SupportTicket) => {
    setActiveTicket(ticket)
    setMobileShowChat(true)
    router.replace(`/support/chat?ticket=${ticket.id}`, { scroll: false })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden lg:h-[calc(100dvh-4rem)] lg:py-4">
        <div className="grid flex-1 overflow-hidden border-border bg-background lg:grid-cols-[340px_1fr] lg:rounded-2xl lg:border">
          {/* Tickets sidebar */}
          <div className={mobileShowChat ? "hidden min-h-0 flex-col lg:flex" : "flex min-h-0 flex-col"}>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-5 w-5" />
                Support Tickets
              </CardTitle>
              <Button size="sm" onClick={() => setShowNewTicket(true)} className="rounded-full">
                <Plus className="mr-1 h-4 w-4" /> New
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-3">
                {tickets.length === 0 ? (
                  <div className="py-10 text-center">
                    <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No support tickets yet</p>
                    <Button size="sm" className="mt-3 rounded-full" onClick={() => setShowNewTicket(true)}>
                      Create your first ticket
                    </Button>
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        activeTicket?.id === ticket.id
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border bg-card hover:bg-muted/50'
                      }`}
                      onClick={() => selectTicket(ticket)}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold">{ticket.subject}</h3>
                        <span className="shrink-0">{statusIcon(ticket.status)}</span>
                      </div>
                      <p className="mb-2 truncate text-xs text-muted-foreground">
                        {ticket.last_message?.message || ticket.category || "No messages yet"}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <Badge className={`${getStatusColor(ticket.status)} border-0`} variant="outline">
                          {STATUS_LABELS[ticket.status] || ticket.status}
                        </Badge>
                        <span>{formatDistanceToNow(new Date(ticket.created_at))} ago</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat pane */}
          <div className={mobileShowChat ? "flex min-h-0 flex-col" : "hidden min-h-0 flex-col lg:flex"}>
            {activeTicket ? (
              <>
                <div className="flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5">
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileShowChat(false)}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{activeTicket.subject}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge className={`${getStatusColor(activeTicket.status)} border-0`} variant="outline">
                        {STATUS_LABELS[activeTicket.status] || activeTicket.status}
                      </Badge>
                      <Badge className={`${getPriorityColor(activeTicket.priority)} border-0`} variant="outline">
                        {activeTicket.priority} priority
                      </Badge>
                      <span className="hidden sm:inline">
                        {formatDistanceToNow(new Date(activeTicket.created_at))} ago
                      </span>
                    </div>
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
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No messages yet — our team replies as fast as they can.
                      </p>
                    )}
                    {messages.map((message) => {
                      const fromSupport = message.is_from_support
                      return (
                        <div key={message.id} className={`flex ${fromSupport ? "justify-start" : "justify-end"}`}>
                          <div className={`flex max-w-[85%] items-start gap-2 sm:max-w-[70%] ${fromSupport ? "" : "flex-row-reverse"}`}>
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={message.user?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {fromSupport ? <HeadphonesIcon className="h-4 w-4" /> : <User className="h-4 w-4" />}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                                fromSupport
                                  ? "rounded-bl-md bg-muted text-foreground"
                                  : "rounded-br-md bg-primary text-primary-foreground"
                              }`}>
                                <p className="whitespace-pre-wrap break-words">{message.message}</p>
                                <p className={`mt-1 text-[10px] ${fromSupport ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                                  {formatDistanceToNow(new Date(message.created_at))} ago
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {activeTicket.status !== 'closed' && (
                  <div className="border-t border-border bg-muted/50 p-3">
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message…"
                        rows={1}
                        className="min-h-[44px] flex-1 resize-none rounded-2xl border-border bg-background px-4"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void sendMessage()
                          }
                        }}
                      />
                      <Button
                        onClick={() => void sendMessage()}
                        disabled={!newMessage.trim() || sending}
                        className="h-11 w-11 rounded-full p-0"
                        size="icon"
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-muted-foreground">
                <MessageCircle className="mb-3 h-12 w-12 opacity-40" />
                <h3 className="text-lg font-semibold text-foreground">Select a ticket</h3>
                <p className="mt-1 max-w-sm text-sm">
                  Pick a support ticket from the list to continue the conversation — replies arrive in real time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Support Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Subject</label>
                <Input
                  value={newTicketForm.subject}
                  onChange={(e) => setNewTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium">Category</label>
                  <select
                    value={newTicketForm.category}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="technical">Technical Issue</option>
                    <option value="billing">Billing & Payments</option>
                    <option value="account">Account Management</option>
                    <option value="content">Content & Moderation</option>
                    <option value="suggestion">Feature Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Priority</label>
                  <select
                    value={newTicketForm.priority}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Message</label>
                <Textarea
                  value={newTicketForm.message}
                  onChange={(e) => setNewTicketForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Tell us what happened — the more detail, the faster we can help."
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => void createNewTicket()}
                  disabled={!newTicketForm.subject || !newTicketForm.message || creatingTicket}
                  className="flex-1"
                >
                  {creatingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create Ticket
                </Button>
                <Button variant="outline" onClick={() => setShowNewTicket(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function SupportChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner className="h-5 w-5 animate-spin" />
            Loading support…
          </div>
        </div>
      }
    >
      <SupportChatInner />
    </Suspense>
  )
}
