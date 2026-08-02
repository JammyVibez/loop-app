"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { Send, Phone, Video, MoreVertical, Image, Paperclip, Smile, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";

import { CoLoopInviteCard } from "@/components/invitations/co-loop-invite-card"
import { MediaEmojiPicker } from "@/components/content/media-emoji-picker"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { RichContent } from "@/components/content/rich-content"

interface Message {
  id: string
  content: string
  sender_id: string
  message_type: 'text' | 'image' | 'video' | 'audio'
  media_url?: string
  created_at: string
  sender: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_verified: boolean
  }
}

interface Conversation {
  id: string
  participant_ids: string[]
  participants: Array<{
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_verified: boolean
  }>
  last_message_at?: string
}

interface RealTimeChatProps {
  conversationId?: string
  recipientId?: string
}

export function RealTimeChat({ conversationId, recipientId }: RealTimeChatProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!user) return

    const initializeChat = async () => {
      setLoading(true)
      try {
        let currentConversationId = conversationId

        // If no conversation ID but we have a recipient, create or find conversation
        if (!conversationId && recipientId) {
          const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.access_token}`
            },
            body: JSON.stringify({ participant_id: recipientId })
          })
          
          const result = await response.json()
          if (result.success) {
            currentConversationId = result.conversation.id
            setConversation(result.conversation)
          }
        }

        if (currentConversationId) {
          // Fetch conversation details
          const convResponse = await fetch(`/api/conversations/${currentConversationId}`, {
            headers: {
              'Authorization': `Bearer ${user.access_token}`
            }
          })
          
          if (convResponse.ok) {
            const convResult = await convResponse.json()
            setConversation(convResult.conversation)
          }

          // Fetch messages
          const messagesResponse = await fetch(`/api/messages/${currentConversationId}`, {
            headers: {
              'Authorization': `Bearer ${user.access_token}`
            }
          })
          
          if (messagesResponse.ok) {
            const messagesResult = await messagesResponse.json()
            setMessages(messagesResult.messages || [])
          }

          // Subscribe to real-time updates
          const channel = supabase
            .channel(`conversation:${currentConversationId}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${currentConversationId}`
            }, (payload) => {
              const newMessage = payload.new as Message
              setMessages(prev => [...prev, newMessage])
            })
            .subscribe()

          return () => {
            supabase.removeChannel(channel)
          }
        }
      } catch (error) {
        console.error('Error initializing chat:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeChat()
  }, [conversationId, recipientId, user])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !conversation || sending) return

    setSending(true)
    try {
      const response = await fetch(`/api/messages/${conversation.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({
          content: newMessage,
          message_type: 'text'
        })
      })

      if (response.ok) {
        setNewMessage("")
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleSendCoLoopInvite = async () => {
    if (!conversation || sending) return
    const sessionId = `studio-${Date.now().toString(36)}`
    setSending(true)
    try {
      await fetch(`/api/messages/${conversation.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({
          content: `[CO_LOOP_INVITE] session=${sessionId}`,
          message_type: 'text'
        })
      })
    } catch (error) {
      console.error('Error sending Co-Loop invite:', error)
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !conversation) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', file.type.startsWith('image/') ? 'image' : 'video')
      formData.append('folder', 'messages')

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: formData
      })

      const uploadResult = await uploadResponse.json()
      if (uploadResult.success) {
        await fetch(`/api/messages/${conversation.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.access_token}`
          },
          body: JSON.stringify({
            content: `Shared a ${file.type.startsWith('image/') ? 'photo' : 'video'}`,
            message_type: file.type.startsWith('image/') ? 'image' : 'video',
            media_url: uploadResult.url
          })
        })
      }
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }

  if (loading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Loading conversation...</p>
        </div>
      </Card>
    )
  }

  if (!conversation) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center">
          <p>Select a conversation to start chatting</p>
        </div>
      </Card>
    )
  }

  const otherParticipant = conversation.participants.find(p => p.id !== user?.id)

  return (
    <Card className="h-[600px] flex flex-col">
      {/* Chat Header */}
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={otherParticipant?.avatar_url} />
              <AvatarFallback>{otherParticipant?.display_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{otherParticipant?.display_name}</h3>
              <p className="text-sm text-gray-500">@{otherParticipant?.username}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="icon" variant="ghost">
              <Phone className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost">
              <Video className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${message.sender_id === user?.id ? 'order-2' : 'order-1'}`}>
                  <div className="flex items-end space-x-2">
                    {message.sender_id !== user?.id && (
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={message.sender.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {message.sender.display_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {message.content.includes('[CO_LOOP_INVITE]') ? (
                      (() => {
                        const match = message.content.match(/session=([^\s]+)/)
                        const sessId = match ? match[1] : "studio-session"
                        return (
                          <CoLoopInviteCard
                            sessionId={sessId}
                            inviterName={message.sender?.display_name || "Creator"}
                            inviterAvatar={message.sender?.avatar_url}
                            createdAt={message.created_at}
                            isSender={message.sender_id === user?.id}
                          />
                        )
                      })()
                    ) : (
                      <div
                        className={`rounded-xl p-3 shadow-sm ${
                          message.sender_id === user?.id
                            ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white' : 'bg-slate-800 border border-white/10 text-slate-100'
                        }`}
                      >
                        {message.message_type === 'image' && message.media_url && (
                          <img
                            src={message.media_url}
                            alt="Shared image"
                            className="max-w-xs rounded-lg mb-2 border border-white/10"
                          />
                        )}
                        {message.message_type === 'video' && message.media_url && (
                          <video
                            src={message.media_url}
                            controls
                            className="max-w-xs rounded-lg mb-2"
                          />
                        )}
                        <RichContent text={message.content} className="text-sm" showPreviewCard={false} />
                        <div className="mt-1 flex items-center justify-end">
                          <FreshnessTimestamp date={message.created_at} className="text-[10px]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Message Input */}
      <div className="border-t border-white/10 p-4 bg-slate-900/40">
        <form onSubmit={sendMessage} className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSendCoLoopInvite}
            title="Invite to live Co-Loop Studio"
            className="rounded-xl border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs gap-1 font-semibold flex-shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Co-Loop
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => document.getElementById('file-upload')?.click()}>
            <Paperclip className="w-4 h-4 text-slate-400 hover:text-white" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => document.getElementById('image-upload')?.click()}>
            <Image className="w-4 h-4 text-slate-400 hover:text-white" />
          </Button>
          <input
            id="file-upload"
            type="file"
            accept="video/*,audio/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message… or insert emojis, GIFs & stickers"
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl"
          />
          <MediaEmojiPicker onSelectEmoji={(emoji) => setNewMessage((prev) => prev + emoji)} />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending} className="bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400 rounded-xl">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  )
}
