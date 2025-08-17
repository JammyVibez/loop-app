"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Mic,
  MicOff,
  PhoneOff,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"

interface Message {
  id: string
  content: string
  sender: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
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
    type: "premium" | "coins"
    amount?: number
    duration?: string
  }
  type?: "voice_note"
  audio_url?: string
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
  }>
  is_group: boolean
  last_message?: Message
}

const REACTION_EMOJIS = [
  { emoji: "❤️", icon: Heart },
  { emoji: "👍", icon: ThumbsUp },
  { emoji: "😂", icon: Laugh },
  { emoji: "😢", icon: Sad },
  { emoji: "😡", icon: Angry },
]

export function EnhancedChatWindow() {
  const { user } = useAuth()
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [showGiftDialog, setShowGiftDialog] = useState(false)
  const [giftRecipient, setGiftRecipient] = useState<string | null>(null)

  const [isInCall, setIsInCall] = useState(false)
  const [callType, setCallType] = useState<"voice" | "video" | null>(null)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Conversations data - will be loaded from API
  const [conversations, setConversations] = useState<Conversation[]>([])

  // Load conversations and messages from API
  useEffect(() => {
    if (!user) return

    const loadConversations = async () => {
      try {
        const response = await fetch("/api/conversations", {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setConversations(data.conversations || [])
        }
      } catch (error) {
        console.error("Failed to load conversations:", error)
      }
    }

    loadConversations()
  }, [user])

  useEffect(() => {
    if (!user || !selectedConversation) return

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/conversations/${selectedConversation}/messages`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages || [])
        }
      } catch (error) {
        console.error("Failed to load messages:", error)
      }
    }

    loadMessages()
  }, [selectedConversation, user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    const message: Message = {
      id: Date.now().toString(),
      content: newMessage,
      sender: {
        id: user?.id || "1",
        username: user?.username || "you",
        display_name: user?.display_name || "You",
        avatar_url: user?.avatar_url,
        is_premium: user?.is_premium || false,
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
    }

    setMessages((prev) => [...prev, message])
    setNewMessage("")
    setReplyingTo(null)

    // Send message to API
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          conversation_id: selectedConversation,
          content: newMessage,
          reply_to_id: replyingTo?.id,
        }),
      })

      if (!response.ok) {
        console.error("Failed to send message:", await response.text())
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  const handleReaction = async (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          const existingReaction = msg.reactions.find((r) => r.emoji === emoji)
          const userId = user?.id || "1"

          if (existingReaction) {
            if (existingReaction.users.includes(userId)) {
              // Remove reaction
              return {
                ...msg,
                reactions: msg.reactions
                  .map((r) =>
                    r.emoji === emoji ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== userId) } : r,
                  )
                  .filter((r) => r.count > 0),
              }
            } else {
              // Add reaction
              return {
                ...msg,
                reactions: msg.reactions.map((r) =>
                  r.emoji === emoji ? { ...r, count: r.count + 1, users: [...r.users, userId] } : r,
                ),
              }
            }
          } else {
            // New reaction
            return {
              ...msg,
              reactions: [...msg.reactions, { emoji, count: 1, users: [userId] }],
            }
          }
        }
        return msg
      }),
    )

    // Send reaction to API
    try {
      const response = await fetch("/api/messages/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          message_id: messageId,
          emoji,
        }),
      })

      if (!response.ok) {
        console.error("Failed to add reaction:", await response.text())
      }
    } catch (error) {
      console.error("Failed to add reaction:", error)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    // TODO: Handle file upload
    console.log("Files to upload:", files)
  }

  const handleGiftPremium = async (recipientId: string, duration: string) => {
    // TODO: Implement gift premium logic
    console.log("Gifting premium:", { recipientId, duration })
    setShowGiftDialog(false)
    setGiftRecipient(null)
  }

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" })
        await sendVoiceNote(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecordingVoice(true)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Failed to start recording:", error)
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop()
    }
    setIsRecordingVoice(false)
    setRecordingTime(0)
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
    }
  }

  const sendVoiceNote = async (audioBlob: Blob) => {
    if (!selectedConversation) return

    const formData = new FormData()
    formData.append("audio", audioBlob, "voice-note.webm")
    formData.append("conversation_id", selectedConversation)
    formData.append("type", "voice_note")

    try {
      const response = await fetch("/api/messages/voice-note", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setMessages((prev) => [...prev, data.message])
      }
    } catch (error) {
      console.error("Failed to send voice note:", error)
    }
  }

  const startCall = async (type: "voice" | "video") => {
    if (!selectedConversation) return

    try {
      const response = await fetch("/api/calls/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          conversation_id: selectedConversation,
          call_type: type,
        }),
      })

      if (response.ok) {
        setIsInCall(true)
        setCallType(type)
      }
    } catch (error) {
      console.error("Failed to start call:", error)
    }
  }

  const endCall = async () => {
    try {
      await fetch("/api/calls/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          conversation_id: selectedConversation,
        }),
      })
    } catch (error) {
      console.error("Failed to end call:", error)
    } finally {
      setIsInCall(false)
      setCallType(null)
    }
  }

  const selectedConv = conversations.find((c) => c.id === selectedConversation)

  return (
    <div className="flex h-[600px] md:h-[700px] border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Conversations List */}
      <div
        className={`${selectedConversation ? "hidden md:block" : "block"} w-full md:w-80 border-r bg-gray-50 dark:bg-gray-800`}
      >
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Messages</h2>
        </div>
        <ScrollArea className="h-full">
          <div className="p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedConversation === conversation.id
                    ? "bg-purple-100 border border-purple-200"
                    : "hover:bg-gray-100"
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
                      <p className="text-xs text-gray-500 truncate">{conversation.last_message.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`${selectedConversation ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="p-3 md:p-4 border-b bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 md:space-x-3">
                  {/* Back button for mobile */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden p-1"
                    onClick={() => setSelectedConversation(null)}
                  >
                    ←
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedConv.participants[0]?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{selectedConv.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-1">
                      <h3 className="font-medium">{selectedConv.name}</h3>
                      {selectedConv.participants[0]?.is_premium && <Crown className="h-4 w-4 text-yellow-500" />}
                    </div>
                    <p className="text-xs text-gray-500">
                      {selectedConv.participants[0]?.is_online ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!isInCall ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startCall("voice")}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startCall("video")}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={endCall} className="text-red-600 hover:text-red-700">
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => {
                          setGiftRecipient(selectedConv.participants[0]?.id || null)
                          setShowGiftDialog(true)
                        }}
                      >
                        <Gift className="h-4 w-4 mr-2" />
                        Gift Premium
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {isInCall && (
                <div className="mt-2 p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    {callType === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                    <span className="text-sm font-medium">
                      {callType === "video" ? "Video Call" : "Voice Call"} in progress
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-2 md:p-4">
              <div className="space-y-3 md:space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="group">
                    {message.reply_to && (
                      <div className="ml-8 md:ml-12 mb-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 border-l-2 border-gray-300 dark:border-gray-600">
                        <span className="font-medium">{message.reply_to.sender}:</span> {message.reply_to.content}
                      </div>
                    )}

                    <div className="flex items-start space-x-2 md:space-x-3">
                      <Avatar className="h-6 w-6 md:h-8 md:w-8 flex-shrink-0">
                        <AvatarImage src={message.sender.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{message.sender.display_name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1 md:space-x-2 mb-1">
                          <span className="font-medium text-xs md:text-sm truncate">{message.sender.display_name}</span>
                          {message.sender.is_premium && (
                            <Crown className="h-2 w-2 md:h-3 md:w-3 text-yellow-500 flex-shrink-0" />
                          )}
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        {message.is_gift ? (
                          <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-3 rounded-lg border border-purple-200">
                            <div className="flex items-center space-x-2">
                              <Gift className="h-5 w-5 text-purple-600" />
                              <span className="font-medium text-purple-800">{message.content}</span>
                            </div>
                          </div>
                        ) : message.type === "voice_note" ? (
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 md:p-3 rounded-lg max-w-xs md:max-w-md flex items-center">
                            <Mic className="h-5 w-5 text-gray-500 mr-2" />
                            <a href={message.audio_url} download className="text-sm md:text-base break-words">
                              Voice Note
                            </a>
                          </div>
                        ) : (
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 md:p-3 rounded-lg max-w-xs md:max-w-md">
                            <p className="text-xs md:text-sm break-words">{message.content}</p>
                          </div>
                        )}

                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.attachments.map((attachment, index) => (
                              <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
                                <Paperclip className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium">{attachment.name}</span>
                                <span className="text-xs text-gray-500">
                                  ({(attachment.size / 1024 / 1024).toFixed(1)} MB)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reactions */}
                        {message.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {message.reactions.map((reaction, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="text-xs cursor-pointer hover:bg-gray-200"
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
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-500">
                {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            {/* Reply Preview */}
            {replyingTo && (
              <div className="px-4 py-2 bg-gray-50 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Reply className="h-4 w-4 text-gray-500" />
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

            {/* Message Input */}
            <div className="p-2 md:p-4 border-t bg-white dark:bg-gray-900">
              {isRecordingVoice && (
                <div className="mb-2 p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Recording voice note</span>
                      <span className="text-sm text-gray-600">
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={stopVoiceRecording}
                      className="text-red-600 hover:text-red-700"
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-end space-x-1 md:space-x-2">
                <div className="flex-1">
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    className="min-h-[36px] md:min-h-[40px] max-h-24 md:max-h-32 resize-none text-sm"
                    disabled={isRecordingVoice}
                  />
                </div>

                <div className="flex space-x-1">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="hidden sm:flex"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                    className={isRecordingVoice ? "text-red-600 hover:text-red-700" : ""}
                  >
                    {isRecordingVoice ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>

                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isRecordingVoice}
                    className="bg-purple-600 hover:bg-purple-700 px-2 md:px-4"
                    size="sm"
                  >
                    <Send className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-sm">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Gift Premium Dialog */}
      <Dialog open={showGiftDialog} onOpenChange={setShowGiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gift Premium</DialogTitle>
            <DialogDescription>Send a premium subscription as a gift</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => handleGiftPremium(giftRecipient!, "1 month")}>
                1 Month
              </Button>
              <Button variant="outline" onClick={() => handleGiftPremium(giftRecipient!, "3 months")}>
                3 Months
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGiftDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
