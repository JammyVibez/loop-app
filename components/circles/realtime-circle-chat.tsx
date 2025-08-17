"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Send,
  Smile,
  Pin,
  Users,
  Settings,
  Crown,
  Shield,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share,
  Gift,
  MoreHorizontal,
  ThumbsUp,
  Heart,
  Laugh,
  Angry,
  FrownIcon as Sad,
  Reply,
  Paperclip
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { formatDistanceToNow } from "date-fns"

interface CircleRoomMessage {
  id: string
  content: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_verified: boolean
    is_premium: boolean
  }
  timestamp: string
  reactions: Array<{
    emoji: string
    count: number
    users: string[]
  }>
  reply_to?: {
    id: string
    content: string
    author: string
  }
  attachments?: Array<{
    name: string
    url: string
    type: string
    size: number
  }>
  is_edited?: boolean
  edited_at?: string
  is_pinned?: boolean
}

interface RealtimeCircleChatProps {
  circleId: string
  roomId: string
  roomName: string
}

const REACTION_EMOJIS = [
  { emoji: "❤️", icon: Heart },
  { emoji: "👍", icon: ThumbsUp },
  { emoji: "😂", icon: Laugh },
  { emoji: "😢", icon: Sad },
  { emoji: "😡", icon: Angry },
]

export function RealtimeCircleChat({ circleId, roomId, roomName }: RealtimeCircleChatProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  // State management
  const [messages, setMessages] = useState<CircleRoomMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [replyingTo, setReplyingTo] = useState<CircleRoomMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // WebSocket connection
  useEffect(() => {
    if (!user || !roomId) return

    const connectWebSocket = () => {
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'}/circle-room/${roomId}?token=${user.token}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }

      wsRef.current = ws
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [user, roomId])

  // Handle WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'new_message':
        setMessages(prev => [...prev, data.message])
        scrollToBottom()
        break
      case 'message_reaction':
        setMessages(prev => prev.map(msg => 
          msg.id === data.message_id 
            ? { ...msg, reactions: data.reactions }
            : msg
        ))
        break
      case 'user_typing':
        setTypingUsers(prev => {
          if (data.is_typing && !prev.includes(data.user_id)) {
            return [...prev, data.user_id]
          } else if (!data.is_typing) {
            return prev.filter(id => id !== data.user_id)
          }
          return prev
        })
        break
      case 'message_edited':
        setMessages(prev => prev.map(msg => 
          msg.id === data.message_id 
            ? { ...msg, content: data.content, is_edited: true, edited_at: data.edited_at }
            : msg
        ))
        break
      case 'message_deleted':
        setMessages(prev => prev.filter(msg => msg.id !== data.message_id))
        break
    }
  }

  // Load messages for current room
  useEffect(() => {
    if (!user || !roomId) return

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/circles/${circleId}/rooms/${roomId}/messages`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages || [])
          scrollToBottom()
        }
      } catch (error) {
        console.error('Failed to load messages:', error)
      }
    }

    loadMessages()
  }, [user, circleId, roomId])

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !roomId || !user) return

    const messageData = {
      content: newMessage,
      media_url: null,
      media_type: null,
      reply_to_id: replyingTo?.id || null
    }

    // Optimistically add message to UI
    const optimisticMessage: CircleRoomMessage = {
      id: `temp-${Date.now()}`,
      content: newMessage,
      author: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified || false,
        is_premium: user.is_premium || false
      },
      timestamp: new Date().toISOString(),
      reactions: [],
      reply_to: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        author: replyingTo.author.display_name
      } : undefined,
      is_edited: false
    }

    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage("")
    setReplyingTo(null)

    // Send via WebSocket for real-time delivery
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        data: messageData
      }))
    } else {
      // Fallback to HTTP API
      try {
        await fetch(`/api/circles/${circleId}/rooms/${roomId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify(messageData)
        })
      } catch (error) {
        console.error('Failed to send message:', error)
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive"
        })
      }
    }
  }

  // Handle typing indicator
  const handleTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type: 'typing',
      data: { is_typing: true }
    }))

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          data: { is_typing: false }
        }))
      }
    }, 1000)
  }

  // Handle reactions
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type: 'add_reaction',
      data: { message_id: messageId, emoji }
    }))
  }

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-3 h-3 text-yellow-500" />
      case "admin":
        return <Shield className="w-3 h-3 text-red-500" />
      case "moderator":
        return <Shield className="w-3 h-3 text-blue-500" />
      default:
        return null
    }
  }

  // Render message
  const renderMessage = (message: CircleRoomMessage) => (
    <div key={message.id} className="group mb-4">
      {message.reply_to && (
        <div className="ml-12 mb-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 border-l-2 border-gray-300">
          <span className="font-medium">{message.reply_to.author}:</span> {message.reply_to.content}
        </div>
      )}

      <div className="flex items-start space-x-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={message.author.avatar_url} alt={message.author.display_name} />
          <AvatarFallback>{message.author.display_name.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-medium text-sm">{message.author.display_name}</span>
            {message.author.is_premium && <Crown className="w-3 h-3 text-yellow-500" />}
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
            </span>
            {message.is_edited && (
              <span className="text-xs text-gray-400">(edited)</span>
            )}
          </div>

          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg max-w-md">
            <p className="text-sm">{message.content}</p>
          </div>

          {/* Reactions */}
          {message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.reactions.map((reaction, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => handleReaction(message.id, reaction.emoji)}
                >
                  {reaction.emoji} {reaction.count}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Message Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex space-x-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Smile className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <div className="flex space-x-1 p-1">
                  {REACTION_EMOJIS.map((reaction) => (
                    <Button
                      key={reaction.emoji}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleReaction(message.id, reaction.emoji)}
                    >
                      {reaction.emoji}
                    </Button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setReplyingTo(message)}
            >
              <Reply className="h-3 w-3" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Copy Message</DropdownMenuItem>
                {message.author.id === user?.id && (
                  <>
                    <DropdownMenuItem>Edit Message</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">Delete Message</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem>Report Message</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span># {roomName}</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-2 text-xs text-gray-500">
            {typingUsers.length === 1 ? "Someone is" : `${typingUsers.length} people are`} typing...
          </div>
        )}

        {/* Reply Preview */}
        {replyingTo && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Reply className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  Replying to <span className="font-medium">{replyingTo.author.display_name}</span>
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                ×
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate">{replyingTo.content}</p>
          </div>
        )}

        {/* Message Input */}
        <div className="p-4 border-t">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <Textarea
                placeholder={`Message # ${roomName}...`}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  handleTyping()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                className="min-h-[40px] max-h-32 resize-none"
              />
            </div>

            <div className="flex space-x-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="w-4 h-4" />
              </Button>

              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="grid grid-cols-8 gap-2">
                {["😀", "😂", "😍", "🤔", "👍", "❤️", "🔥", "✨", "🎉", "💯", "🚀", "⭐", "💎", "🌟", "🎊", "🔮"].map(
                  (emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setNewMessage(newMessage + emoji)
                        setShowEmojiPicker(false)
                      }}
                      className="text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded p-1"
                    >
                      {emoji}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
