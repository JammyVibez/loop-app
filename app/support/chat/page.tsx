"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  MessageCircle, 
  Send, 
  User, 
  HeadphonesIcon,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { formatDistanceToNow } from "date-fns"

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
  created_at: string
}

export default function SupportChatPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // New ticket form
  const [showNewTicket, setShowNewTicket] = useState(false)
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

  useEffect(() => {
    if (user) {
      fetchTickets()
    }
  }, [user])

  useEffect(() => {
    if (activeTicket) {
      fetchMessages(activeTicket.id)
      // Set up real-time subscription for messages
      const interval = setInterval(() => {
        fetchMessages(activeTicket.id)
      }, 3000) // Poll every 3 seconds for new messages

      return () => clearInterval(interval)
    }
  }, [activeTicket])

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/support/tickets')
      if (response.ok) {
        const data = await response.json()
        setTickets(data.tickets || [])
        if (data.tickets && data.tickets.length > 0 && !activeTicket) {
          setActiveTicket(data.tickets[0])
        }
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/support/messages?ticketId=${ticketId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

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
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800'
      case 'in-progress': return 'bg-yellow-100 text-yellow-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-orange-100 text-orange-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-gray-600">Please log in to access support chat.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
          {/* Tickets Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Support Tickets
                  </CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowNewTicket(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    New Ticket
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  <div className="space-y-2 p-4">
                    {tickets.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No support tickets yet</p>
                        <Button 
                          size="sm" 
                          className="mt-2"
                          onClick={() => setShowNewTicket(true)}
                        >
                          Create First Ticket
                        </Button>
                      </div>
                    ) : (
                      tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            activeTicket?.id === ticket.id
                              ? 'bg-purple-100 dark:bg-purple-900 border-purple-300'
                              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => setActiveTicket(ticket)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-sm truncate">{ticket.subject}</h3>
                            <Badge className={getStatusColor(ticket.status)} variant="secondary">
                              {ticket.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <Badge className={getPriorityColor(ticket.priority)} variant="outline">
                              {ticket.priority}
                            </Badge>
                            <span>{formatDistanceToNow(new Date(ticket.created_at))} ago</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col">
              {activeTicket ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{activeTicket.subject}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusColor(activeTicket.status)}>
                            {activeTicket.status}
                          </Badge>
                          <Badge className={getPriorityColor(activeTicket.priority)} variant="outline">
                            {activeTicket.priority} priority
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {formatDistanceToNow(new Date(activeTicket.created_at))} ago
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.is_from_support ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`flex items-start gap-3 max-w-[80%] ${
                              message.is_from_support ? 'flex-row' : 'flex-row-reverse'
                            }`}>
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={message.user?.avatar_url} />
                                <AvatarFallback>
                                  {message.is_from_support ? (
                                    <HeadphonesIcon className="w-4 h-4" />
                                  ) : (
                                    <User className="w-4 h-4" />
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <div className={`rounded-lg p-3 ${
                                message.is_from_support
                                  ? 'bg-gray-100 dark:bg-gray-800'
                                  : 'bg-purple-600 text-white'
                              }`}>
                                <p className="text-sm">{message.message}</p>
                                <p className={`text-xs mt-1 ${
                                  message.is_from_support ? 'text-gray-500' : 'text-purple-200'
                                }`}>
                                  {formatDistanceToNow(new Date(message.created_at))} ago
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    {activeTicket.status !== 'closed' && (
                      <div className="border-t p-4">
                        <div className="flex gap-2">
                          <Textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 min-h-[60px] resize-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                sendMessage()
                              }
                            }}
                          />
                          <Button
                            onClick={sendMessage}
                            disabled={!newMessage.trim() || sending}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a ticket to start chatting</h3>
                    <p className="text-gray-500">Choose a support ticket from the sidebar to view the conversation.</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>

        {/* New Ticket Modal */}
        {showNewTicket && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Create New Support Ticket</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject</label>
                  <Input
                    value={newTicketForm.subject}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Brief description of your issue"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <select
                    value={newTicketForm.category}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="technical">Technical Issue</option>
                    <option value="billing">Billing & Payments</option>
                    <option value="account">Account Management</option>
                    <option value="feature">Feature Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Priority</label>
                  <select
                    value={newTicketForm.priority}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Message</label>
                  <Textarea
                    value={newTicketForm.message}
                    onChange={(e) => setNewTicketForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Please provide detailed information about your issue..."
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={createNewTicket}
                    disabled={!newTicketForm.subject || !newTicketForm.message}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    Create Ticket
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewTicket(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
