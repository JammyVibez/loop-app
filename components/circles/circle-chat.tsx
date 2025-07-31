"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface CircleChatProps {
  circleId: string
  circleName: string
}

// Mock chat data
const mockChatRooms = [
  {
    id: "general",
    name: "General",
    description: "Main discussion room",
    member_count: 1247,
    is_voice_enabled: true,
    is_video_enabled: false,
  },
  {
    id: "writing-tips",
    name: "Writing Tips",
    description: "Share and discuss writing techniques",
    member_count: 456,
    is_voice_enabled: false,
    is_video_enabled: false,
  },
  {
    id: "collaboration",
    name: "Collaboration",
    description: "Find writing partners and projects",
    member_count: 234,
    is_voice_enabled: true,
    is_video_enabled: true,
  },
]

const mockMessages = [
  {
    id: "1",
    user: {
      id: "2",
      username: "storyteller",
      display_name: "Story Teller",
      avatar_url: "/placeholder.svg?height=32&width=32",
      role: "admin",
      is_premium: true,
    },
    content: "Welcome everyone to our writing circle! 📚✨",
    timestamp: new Date("2024-01-15T14:25:00Z"),
    type: "text",
    is_pinned: true,
  },
  {
    id: "2",
    user: {
      id: "3",
      username: "novelist",
      display_name: "Aspiring Novelist",
      avatar_url: "/placeholder.svg?height=32&width=32",
      role: "member",
      is_premium: false,
    },
    content: "Just finished my first chapter! Any feedback would be appreciated 🙏",
    timestamp: new Date("2024-01-15T14:30:00Z"),
    type: "text",
    is_pinned: false,
  },
  {
    id: "3",
    user: {
      id: "4",
      username: "poet",
      display_name: "Midnight Poet",
      avatar_url: "/placeholder.svg?height=32&width=32",
      role: "moderator",
      is_premium: true,
    },
    content: "I'd love to read it! Feel free to share in our collaboration room 📝",
    timestamp: new Date("2024-01-15T14:32:00Z"),
    type: "text",
    is_pinned: false,
  },
]

const mockVoiceUsers = [
  {
    id: "2",
    username: "storyteller",
    display_name: "Story Teller",
    avatar_url: "/placeholder.svg?height=32&width=32",
    is_speaking: true,
    is_muted: false,
  },
  {
    id: "5",
    username: "bookworm",
    display_name: "Book Worm",
    avatar_url: "/placeholder.svg?height=32&width=32",
    is_speaking: false,
    is_muted: true,
  },
]

export function CircleChat({ circleId, circleName }: CircleChatProps) {
  const [selectedRoom, setSelectedRoom] = useState(mockChatRooms[0])
  const [messages, setMessages] = useState(mockMessages)
  const [newMessage, setNewMessage] = useState("")
  const [isInVoice, setIsInVoice] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [voiceUsers, setVoiceUsers] = useState(mockVoiceUsers)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (!newMessage.trim()) return

    const message = {
      id: Date.now().toString(),
      user: {
        id: user?.id || "1",
        username: user?.username || "user",
        display_name: user?.display_name || "User",
        avatar_url: user?.avatar_url || "/placeholder.svg",
        role: "member",
        is_premium: user?.is_premium || false,
      },
      content: newMessage,
      timestamp: new Date(),
      type: "text",
      is_pinned: false,
    }

    setMessages((prev) => [...prev, message])
    setNewMessage("")
    toast({ description: "Message sent!" })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleJoinVoice = () => {
    if (!selectedRoom.is_voice_enabled) {
      toast({
        title: "Voice Not Available",
        description: "Voice chat is not enabled in this room.",
        variant: "destructive",
      })
      return
    }

    setIsInVoice(!isInVoice)
    toast({
      description: isInVoice ? "Left voice chat" : "Joined voice chat",
    })
  }

  const handleToggleMute = () => {
    setIsMuted(!isMuted)
    toast({
      description: isMuted ? "Unmuted" : "Muted",
    })
  }

  const handleToggleVideo = () => {
    if (!selectedRoom.is_video_enabled) {
      toast({
        title: "Video Not Available",
        description: "Video chat is not enabled in this room.",
        variant: "destructive",
      })
      return
    }

    setIsVideoOn(!isVideoOn)
    toast({
      description: isVideoOn ? "Video turned off" : "Video turned on",
    })
  }

  const handlePinMessage = (messageId: string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, is_pinned: !msg.is_pinned } : msg)))
    toast({ description: "Message pinned!" })
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Crown className="w-3 h-3 text-yellow-500" />
      case "moderator":
        return <Shield className="w-3 h-3 text-blue-500" />
      default:
        return null
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[700px]">
      {/* Room List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Chat Rooms</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            {mockChatRooms.map((room) => (
              <div
                key={room.id}
                className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedRoom.id === room.id ? "bg-purple-50 dark:bg-purple-900/20 border-r-2 border-purple-500" : ""
                }`}
                onClick={() => setSelectedRoom(room)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm"># {room.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{room.description}</p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className="text-xs text-gray-500">{room.member_count}</span>
                    <div className="flex space-x-1">
                      {room.is_voice_enabled && <Mic className="w-3 h-3 text-green-500" />}
                      {room.is_video_enabled && <Video className="w-3 h-3 text-blue-500" />}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Voice Chat Users */}
          {isInVoice && voiceUsers.length > 0 && (
            <div className="mt-4 p-3 border-t dark:border-gray-700">
              <p className="text-sm font-medium mb-2">In Voice ({voiceUsers.length})</p>
              <div className="space-y-2">
                {voiceUsers.map((voiceUser) => (
                  <div key={voiceUser.id} className="flex items-center space-x-2">
                    <div className="relative">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={voiceUser.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback className="text-xs">{voiceUser.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {voiceUser.is_speaking && (
                        <div className="absolute -inset-1 bg-green-500 rounded-full animate-pulse opacity-50" />
                      )}
                    </div>
                    <span className="text-xs flex-1">{voiceUser.display_name}</span>
                    {voiceUser.is_muted && <MicOff className="w-3 h-3 text-red-500" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3 border-b dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div>
                <p className="font-semibold"># {selectedRoom.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedRoom.description} • {selectedRoom.member_count} members
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {selectedRoom.is_voice_enabled && (
                <>
                  <Button
                    variant={isInVoice ? "default" : "outline"}
                    size="sm"
                    onClick={handleJoinVoice}
                    className={isInVoice ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    {isInVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  {isInVoice && (
                    <Button variant={isMuted ? "destructive" : "outline"} size="sm" onClick={handleToggleMute}>
                      {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  )}
                </>
              )}
              {selectedRoom.is_video_enabled && isInVoice && (
                <Button
                  variant={isVideoOn ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleVideo}
                  className={isVideoOn ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Pin className="w-4 h-4 mr-2" />
                    Pinned Messages
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share className="w-4 h-4 mr-2" />
                    Invite Members
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Room Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex flex-col h-[580px]">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Pinned Messages */}
              {messages.filter((msg) => msg.is_pinned).length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center space-x-2 mb-2">
                    <Pin className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pinned Messages</span>
                  </div>
                  {messages
                    .filter((msg) => msg.is_pinned)
                    .map((message) => (
                      <div key={`pinned-${message.id}`} className="text-sm text-yellow-700 dark:text-yellow-300">
                        <strong>{message.user.display_name}:</strong> {message.content}
                      </div>
                    ))}
                </div>
              )}

              {/* Regular Messages */}
              {messages.map((message) => (
                <div key={message.id} className="flex items-start space-x-3 group">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={message.user.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="text-xs">{message.user.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{message.user.display_name}</span>
                      {getRoleIcon(message.user.role)}
                      {message.user.is_premium && (
                        <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs">
                          Premium
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{message.content}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          •••
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePinMessage(message.id)}>
                          <Pin className="w-4 h-4 mr-2" />
                          {message.is_pinned ? "Unpin" : "Pin"} Message
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share className="w-4 h-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t dark:border-gray-700 p-4">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <Smile className="w-4 h-4" />
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Gift className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Circle Gift</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Send a gift to support this circle and show appreciation!
                  </p>
                </DialogContent>
              </Dialog>

              <Input
                placeholder={`Message # ${selectedRoom.name}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />

              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="bg-gradient-to-r from-purple-500 to-blue-500"
              >
                <Send className="w-4 h-4" />
              </Button>
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
    </div>
  )
}
