
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Phone, Video, MoreVertical, Image, Paperclip, Smile } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@supabase/supabase-js"
import { formatDistanceToNow } from "date-fns"

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
                    <div
                      className={`rounded-lg p-3 ${
                        message.sender_id === user?.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                    >
                      {message.message_type === 'image' && message.media_url && (
                        <img
                          src={message.media_url}
                          alt="Shared image"
                          className="max-w-xs rounded mb-2"
                        />
                      )}
                      {message.message_type === 'video' && message.media_url && (
                        <video
                          src={message.media_url}
                          controls
                          className="max-w-xs rounded mb-2"
                        />
                      )}
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender_id === user?.id ? 'text-purple-200' : 'text-gray-500'
                      }`}>
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Message Input */}
      <div className="border-t p-4">
        <form onSubmit={sendMessage} className="flex items-center space-x-2">
          <Button type="button" size="icon" variant="ghost" onClick={() => document.getElementById('file-upload')?.click()}>
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => document.getElementById('image-upload')?.click()}>
            <Image className="w-4 h-4" />
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
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="button" size="icon" variant="ghost">
            <Smile className="w-4 h-4" />
          </Button>
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  )
}
