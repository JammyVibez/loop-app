"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Send,
  Smile,
  Paperclip,
  Gift,
  Reply,
  MoreHorizontal,
  Heart,
  ThumbsUp,
  Laugh,
  Angry,
  FrownIcon as Sad,
  Crown,
  Phone,
  Video,
  Users,
  Settings,
  Mic,
  Search,
  Plus,
  FileText,
  Square,
  Download,
  MessageCircle,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { GiftModal } from "@/components/gifting/gift-modal"
import { VideoCallModal } from "@/components/calls/video-call-modal"
import { formatDistanceToNow } from "date-fns"
import { createClient } from "@/lib/supabase"

interface Message {
  id: string
  content: string
  sender: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_premium: boolean
    is_online: boolean
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
    sender: string
  }
  attachments?: Array<{
    name: string
    url: string
    type: string
    size: number
  }>
  is_gift?: boolean
  gift_data?: {
    type: "premium" | "coins" | "theme"
    amount?: number
    duration?: string
    name?: string
  }
  message_type: "text" | "image" | "video" | "file" | "voice_note" | "system" | "gift"
  is_edited?: boolean
  edited_at?: string
  file_url?: string
}

interface Conversation {
  id: string
  name: string
  participants: Array<{
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_premium: boolean
    is_online: boolean
    last_seen?: string
  }>
  is_group: boolean
  last_message?: Message
  unread_count: number
  is_typing?: string[]
  type: "direct" | "group"
}

interface RealTimeChatProps {
  conversationId?: string
  onConversationChange?: (conversationId: string) => void
}

const REACTION_EMOJIS = [
  { emoji: "❤️", icon: Heart },
  { emoji: "👍", icon: ThumbsUp },
  { emoji: "😂", icon: Laugh },
  { emoji: "😢", icon: Sad },
  { emoji: "😡", icon: Angry },
]

export function RealTimeChat({ conversationId, onConversationChange }: RealTimeChatProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  // State management
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [giftRecipient, setGiftRecipient] = useState<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showVideoCall, setShowVideoCall] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(conversationId || null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    if (!user || !selectedConversation) return

    const connectWebSocket = () => {
      try {
        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001"}/chat/${selectedConversation}?token=${user.token}`
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log("WebSocket connected")
          setIsConnected(true)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            handleWebSocketMessage(data)
          } catch (error) {
            console.error("Error parsing WebSocket message:", error)
          }
        }

        ws.onclose = () => {
          console.log("WebSocket disconnected")
          setIsConnected(false)
          // Attempt to reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000)
        }

        ws.onerror = (error) => {
          console.error("WebSocket error:", error)
          setIsConnected(false)
        }

        wsRef.current = ws
      } catch (error) {
        console.error("Failed to connect WebSocket:", error)
        setIsConnected(false)
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [user, selectedConversation])

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case "new_message":
        setMessages((prev) => [...prev, data.message])
        scrollToBottom()
        break
      case "message_reaction":
        setMessages((prev) =>
          prev.map((msg) => (msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg)),
        )
        break
      case "user_typing":
        setTypingUsers((prev) => {
          if (data.is_typing && !prev.includes(data.user_id)) {
            return [...prev, data.user_id]
          } else if (!data.is_typing) {
            return prev.filter((id) => id !== data.user_id)
          }
          return prev
        })
        break
      case "user_online":
        setConversations((prev) =>
          prev.map((conv) => ({
            ...conv,
            participants: conv.participants.map((p) =>
              p.id === data.user_id ? { ...p, is_online: data.is_online, last_seen: data.last_seen } : p,
            ),
          })),
        )
        break
      case "message_edited":
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.message_id
              ? { ...msg, content: data.content, is_edited: true, edited_at: data.edited_at }
              : msg,
          ),
        )
        break
      case "message_deleted":
        setMessages((prev) => prev.filter((msg) => msg.id !== data.message_id))
        break
      case "call_request":
        handleIncomingCall(data)
        break
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const loadConversations = async () => {
      try {
        const supabase = createClient()

        const { data: conversations, error } = await supabase
          .from("conversations")
          .select(`
            *,
            participants:conversation_participants(
              user:profiles(*)
            ),
            last_message:messages(
              id,
              content,
              sender_id,
              created_at,
              message_type,
              sender:profiles(*)
            )
          `)
          .eq("conversation_participants.user_id", user.id)
          .order("updated_at", { ascending: false })

        if (!error && conversations) {
          const formattedConversations = conversations.map((conv: any) => ({
            id: conv.id,
            name:
              conv.type === "direct"
                ? conv.participants.find((p: any) => p.user.id !== user.id)?.user.display_name || "Unknown"
                : conv.name || "Group Chat",
            participants: conv.participants
              .filter((p: any) => p.user.id !== user.id)
              .map((p: any) => ({
                id: p.user.id,
                username: p.user.username,
                display_name: p.user.display_name,
                avatar_url: p.user.avatar_url,
                is_premium: p.user.is_premium || false,
                is_online: p.user.is_online || false,
                last_seen: p.user.last_seen,
              })),
            is_group: conv.type === "group",
            last_message: conv.last_message?.[0],
            unread_count: 0, // TODO: Calculate unread count
            type: conv.type,
          }))
          setConversations(formattedConversations)
        }

        // Set up real-time subscription for conversations
        const channel = supabase
          .channel("conversations")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "conversations",
            },
            (payload) => {
              console.log("Conversation change:", payload)
              // Reload conversations on change
              loadConversations()
            },
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      } catch (error) {
        console.error("Failed to load conversations:", error)
      }
    }

    loadConversations()
  }, [user])

  // Load messages for current conversation
  useEffect(() => {
    if (!user || !selectedConversation) return

    const loadMessages = async () => {
      try {
        const supabase = createClient()

        const { data: messages, error } = await supabase
          .from("messages")
          .select(`
            *,
            sender:profiles(*),
            reactions:message_reactions(
              user_id,
              emoji,
              created_at,
              user:profiles(*)
            )
          `)
          .eq("conversation_id", selectedConversation)
          .order("created_at", { ascending: true })
          .limit(50)

        if (!error && messages) {
          const formattedMessages = messages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            sender: {
              id: msg.sender.id,
              username: msg.sender.username,
              display_name: msg.sender.display_name,
              avatar_url: msg.sender.avatar_url,
              is_premium: msg.sender.is_premium || false,
              is_online: msg.sender.is_online || false,
            },
            timestamp: msg.created_at,
            reactions:
              msg.reactions?.map((r: any) => ({
                emoji: r.emoji,
                count: 1, // TODO: Aggregate count
                users: [r.user_id],
              })) || [],
            message_type: msg.message_type,
            file_url: msg.file_url,
            is_edited: msg.is_edited,
            edited_at: msg.edited_at,
          }))
          setMessages(formattedMessages)
          scrollToBottom()
        }

        // Set up real-time subscription for messages
        const channel = supabase
          .channel(`messages_${selectedConversation}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${selectedConversation}`,
            },
            (payload) => {
              console.log("New message:", payload)
              // Add new message to state
              if (payload.new) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: payload.new.id,
                    content: payload.new.content,
                    sender: {
                      id: payload.new.sender_id,
                      username: "Unknown",
                      display_name: "Unknown",
                      avatar_url: "",
                      is_premium: false,
                      is_online: false,
                    },
                    timestamp: payload.new.created_at,
                    reactions: [],
                    message_type: payload.new.message_type,
                    file_url: payload.new.file_url,
                  },
                ])
                scrollToBottom()
              }
            },
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      } catch (error) {
        console.error("Failed to load messages:", error)
      }
    }

    loadMessages()
  }, [user, selectedConversation])

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !audioBlob) || !selectedConversation || !user) return

    try {
      const supabase = createClient()
      let fileUrl = null

      // Handle voice note upload
      if (audioBlob) {
        const fileName = `voice-note-${Date.now()}.webm`
        const filePath = `voice-notes/${selectedConversation}/${fileName}`

        const { error: uploadError } = await supabase.storage.from("media").upload(filePath, audioBlob)

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(filePath)

        fileUrl = publicUrl
      }

      const messageData = {
        conversation_id: selectedConversation,
        content: audioBlob ? `Voice message (${recordingTime}s)` : newMessage,
        reply_to_id: replyingTo?.id,
        message_type: audioBlob ? "voice_note" : "text",
        file_url: fileUrl,
      }

      // Optimistically add message to UI
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content: messageData.content,
        sender: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          is_premium: user.is_premium || false,
          is_online: true,
        },
        timestamp: new Date().toISOString(),
        reactions: [],
        reply_to: replyingTo
          ? {
              id: replyingTo.id,
              content: replyingTo.content,
              sender: replyingTo.sender.display_name,
            }
          : undefined,
        message_type: messageData.message_type,
        file_url: fileUrl,
      }

      setMessages((prev) => [...prev, optimisticMessage])
      setNewMessage("")
      setReplyingTo(null)
      setAudioBlob(null)

      // Send to database
      const { data: message, error } = await supabase
        .from("messages")
        .insert(messageData)
        .select(`
          *,
          sender:profiles(*)
        `)
        .single()

      if (error) throw error

      // Update conversation last message
      await supabase
        .from("conversations")
        .update({
          last_message_id: message.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedConversation)

      // Send via WebSocket for real-time delivery
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "send_message",
            data: message,
          }),
        )
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle typing indicator
  const handleTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    wsRef.current.send(
      JSON.stringify({
        type: "typing",
        data: { is_typing: true },
      }),
    )

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "typing",
            data: { is_typing: false },
          }),
        )
      }
    }, 1000)
  }

  // Handle reactions
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const supabase = createClient()

      const { error } = await supabase.from("message_reactions").upsert({
        message_id: messageId,
        user_id: user?.id,
        emoji,
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "add_reaction",
            data: { message_id: messageId, emoji },
          }),
        )
      }
    } catch (error) {
      console.error("Failed to add reaction:", error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !selectedConversation) return

    for (const file of Array.from(files)) {
      try {
        const supabase = createClient()
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
        const filePath = `messages/${selectedConversation}/${fileName}`

        const { error: uploadError } = await supabase.storage.from("media").upload(filePath, file)

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(filePath)

        // Determine message type based on file type
        let messageType = "file"
        if (file.type.startsWith("image/")) messageType = "image"
        else if (file.type.startsWith("video/")) messageType = "video"

        // Send file message
        const messageData = {
          conversation_id: selectedConversation,
          content: `Shared ${messageType}: ${file.name}`,
          message_type: messageType,
          file_url: publicUrl,
        }

        const { data: message, error } = await supabase
          .from("messages")
          .insert(messageData)
          .select(`
            *,
            sender:profiles(*)
          `)
          .single()

        if (error) throw error

        // Send via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "send_message",
              data: message,
            }),
          )
        }
      } catch (error) {
        console.error("File upload failed:", error)
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}. Please try again.`,
          variant: "destructive",
        })
      }
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      })
      const audioChunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Failed to start recording:", error)
      toast({
        title: "Recording Failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setAudioBlob(null)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  const handleVoiceCall = () => {
    if (!selectedConversation || !currentConversation) return

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "call_request",
          data: {
            conversation_id: selectedConversation,
            call_type: "voice",
            caller_id: user?.id,
          },
        }),
      )
    }

    toast({
      title: "Voice Call",
      description: "Calling...",
    })
  }

  const handleVideoCall = () => {
    if (!selectedConversation || !currentConversation) return
    setShowVideoCall(true)
  }

  const handleIncomingCall = (data: any) => {
    // Handle incoming call notification
    toast({
      title: "Incoming Call",
      description: `${data.caller_name} is calling you`,
      action: (
        <div className="flex space-x-2">
          <Button size="sm" onClick={() => setShowVideoCall(true)}>
            Accept
          </Button>
          <Button size="sm" variant="outline">
            Decline
          </Button>
        </div>
      ),
    })
  }

  const handleCreateConversation = async (participantIds: string[]) => {
    try {
      const supabase = createClient()

      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({
          type: participantIds.length > 1 ? "group" : "direct",
          created_by: user?.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      const participantData = [user?.id, ...participantIds].map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
        joined_at: new Date().toISOString(),
      }))

      const { error: participantError } = await supabase.from("conversation_participants").insert(participantData)

      if (participantError) throw participantError

      setSelectedConversation(conversation.id)
      setShowNewConversation(false)

      toast({
        title: "Success",
        description: "Conversation created successfully!",
      })
    } catch (error) {
      console.error("Failed to create conversation:", error)
      toast({
        title: "Error",
        description: "Failed to create conversation. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Get current conversation
  const currentConversation = conversations.find((c) => c.id === selectedConversation)

  // Filter conversations based on search
  const filteredConversations = conversations.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.participants.some(
        (p) =>
          p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.username.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  )

  const renderMessage = (message: Message) => (
    <div key={message.id} className="group mb-4">
      {message.reply_to && (
        <div className="ml-12 mb-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 border-l-2 border-gray-300">
          <span className="font-medium">{message.reply_to.sender}:</span> {message.reply_to.content}
        </div>
      )}

      <div className="flex items-start space-x-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={message.sender.avatar_url || "/placeholder.svg"} alt={message.sender.display_name} />
          <AvatarFallback>{message.sender.display_name.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-medium text-sm">{message.sender.display_name}</span>
            {message.sender.is_premium && <Crown className="w-3 h-3 text-yellow-500" />}
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
            </span>
            {message.is_edited && <span className="text-xs text-gray-400">(edited)</span>}
          </div>

          {message.is_gift ? (
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 p-3 rounded-lg border border-purple-200">
              <div className="flex items-center space-x-2">
                <Gift className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-800 dark:text-purple-200">{message.content}</span>
              </div>
              {message.gift_data && (
                <div className="mt-2 text-sm text-purple-700 dark:text-purple-300">
                  {message.gift_data.name}
                  {message.gift_data.duration && ` (${message.gift_data.duration})`}
                  {message.gift_data.amount && ` - ${message.gift_data.amount} coins`}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg max-w-md">
              <p className="text-sm">{message.content}</p>

              {/* File attachments */}
              {message.file_url && (
                <div className="mt-2">
                  {message.message_type === "image" && (
                    <img
                      src={message.file_url || "/placeholder.svg"}
                      alt="Shared image"
                      className="max-w-xs max-h-48 rounded cursor-pointer"
                      onClick={() => window.open(message.file_url, "_blank")}
                    />
                  )}
                  {message.message_type === "video" && (
                    <video controls className="max-w-xs max-h-48 rounded" src={message.file_url} />
                  )}
                  {message.message_type === "voice_note" && (
                    <div className="flex items-center space-x-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <Mic className="w-4 h-4 text-purple-500" />
                      <audio controls className="flex-1">
                        <source src={message.file_url} type="audio/webm" />
                      </audio>
                    </div>
                  )}
                  {message.message_type === "file" && (
                    <div className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium flex-1">File attachment</span>
                      <Button size="sm" variant="ghost" onClick={() => window.open(message.file_url, "_blank")}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setReplyingTo(message)}>
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
                {message.sender.id === user?.id && (
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
    <div className="flex h-[700px] border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Conversations List */}
      <div
        className={`${selectedConversation ? "hidden lg:block" : "block"} w-full lg:w-80 border-r bg-gray-50 dark:bg-gray-800`}
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Messages</h2>
            <Button
              size="sm"
              onClick={() => setShowNewConversation(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="h-full">
          <div className="p-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedConversation === conversation.id
                    ? "bg-purple-100 dark:bg-purple-900/20 border border-purple-200"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => setSelectedConversation(conversation.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={conversation.participants[0]?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{conversation.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {conversation.participants[0]?.is_online && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1">
                      <p className="font-medium text-sm truncate">{conversation.name}</p>
                      {conversation.participants[0]?.is_premium && <Crown className="h-3 w-3 text-yellow-500" />}
                    </div>
                    {conversation.last_message && (
                      <p className="text-xs text-gray-500 truncate">
                        {conversation.last_message.message_type === "voice_note"
                          ? "🎵 Voice message"
                          : conversation.last_message.message_type === "image"
                            ? "📷 Image"
                            : conversation.last_message.message_type === "video"
                              ? "🎥 Video"
                              : conversation.last_message.message_type === "file"
                                ? "📎 File"
                                : conversation.last_message.content}
                      </p>
                    )}
                    {conversation.unread_count > 0 && (
                      <Badge className="mt-1 bg-purple-600 text-white text-xs">{conversation.unread_count}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`${selectedConversation ? "flex" : "hidden lg:flex"} flex-1 flex-col`}>
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white dark:bg-gray-900 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Back button for mobile */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden p-1"
                  onClick={() => setSelectedConversation(null)}
                >
                  ←
                </Button>
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={currentConversation.participants[0]?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{currentConversation.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {currentConversation.participants[0]?.is_online && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-1">
                    <h3 className="font-medium">{currentConversation.name}</h3>
                    {currentConversation.participants[0]?.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <p className="text-xs text-gray-500">
                    {currentConversation.participants[0]?.is_online
                      ? "Online"
                      : currentConversation.participants[0]?.last_seen
                        ? `Last seen ${formatDistanceToNow(new Date(currentConversation.participants[0].last_seen), { addSuffix: true })}`
                        : "Offline"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Connection Status */}
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />

                <Button variant="ghost" size="sm" onClick={handleVoiceCall}>
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleVideoCall}>
                  <Video className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGiftRecipient(currentConversation.participants[0])
                    setShowGiftModal(true)
                  }}
                >
                  <Gift className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <Users className="w-4 h-4 mr-2" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="w-4 h-4 mr-2" />
                      Chat Settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

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
                      Replying to <span className="font-medium">{replyingTo.sender.display_name}</span>
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                    ×
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{replyingTo.content}</p>
              </div>
            )}

            {/* Voice Note Preview */}
            {audioBlob && (
              <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mic className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      Voice note ready ({recordingTime}s)
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setAudioBlob(null)}>
                      Cancel
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSendMessage}>
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t bg-white dark:bg-gray-900">
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <Textarea
                    placeholder="Type a message..."
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
                    disabled={isRecording}
                  />
                </div>

                <div className="flex space-x-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                    className="hidden"
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRecording}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    className={isRecording ? "text-red-500 bg-red-50" : ""}
                  >
                    {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>

                  <Button
                    onClick={handleSendMessage}
                    disabled={(!newMessage.trim() && !audioBlob) || isRecording}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {isRecording && (
                <div className="mt-2 flex items-center justify-between text-red-500">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm">Recording... {recordingTime}s</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={cancelRecording}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-sm">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Gift Modal */}
      {showGiftModal && giftRecipient && (
        <GiftModal
          open={showGiftModal}
          onOpenChange={setShowGiftModal}
          recipient={giftRecipient}
          context={{
            type: "profile",
            id: giftRecipient.id,
            title: giftRecipient.display_name,
          }}
        />
      )}

      {/* Video Call Modal */}
      {showVideoCall && currentConversation && (
        <VideoCallModal
          open={showVideoCall}
          onOpenChange={setShowVideoCall}
          participants={[
            {
              id: user?.id || "",
              name: user?.display_name || "",
              avatar: user?.avatar_url || "",
              isLocal: true,
            },
            ...currentConversation.participants.map((p) => ({
              id: p.id,
              name: p.display_name,
              avatar: p.avatar_url || "",
              isLocal: false,
            })),
          ]}
          conversationId={selectedConversation || ""}
        />
      )}
    </div>
  )
}
