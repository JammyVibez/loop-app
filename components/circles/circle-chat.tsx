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
  Phone,
  PhoneCall,
  FileAudio,
  Square,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase"

interface CircleChatProps {
  circleId: string
  circleName: string
}

export function CircleChat({ circleId, circleName }: CircleChatProps) {
  const [chatRooms, setChatRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [isInVoice, setIsInVoice] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [voiceUsers, setVoiceUsers] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recordingInterval = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    const fetchChatRooms = async () => {
      try {
        const supabase = createClient()

        const { data: roomsData, error } = await supabase
          .from("circle_rooms")
          .select(`
            *,
            member_count:circle_room_members(count)
          `)
          .eq("circle_id", circleId)
          .order("created_at", { ascending: true })

        if (!error && roomsData) {
          setChatRooms(roomsData)
          if (roomsData.length > 0) {
            setSelectedRoom(roomsData[0])
          }
        }
      } catch (error) {
        console.error("Error fetching chat rooms:", error)
      }
    }

    fetchChatRooms()
  }, [circleId])

  useEffect(() => {
    if (!selectedRoom) return

    const fetchMessages = async () => {
      try {
        const supabase = createClient()

        const { data: messagesData, error } = await supabase
          .from("circle_messages")
          .select(`
            *,
            user:profiles(*),
            reactions:circle_message_reactions(
              user_id,
              emoji,
              created_at,
              user:profiles(*)
            )
          `)
          .eq("room_id", selectedRoom.id)
          .order("created_at", { ascending: true })
          .limit(50)

        if (!error && messagesData) {
          setMessages(messagesData)
        }

        const channel = supabase
          .channel(`circle_room_${selectedRoom.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "circle_messages",
              filter: `room_id=eq.${selectedRoom.id}`,
            },
            (payload) => {
              setMessages((prev) => [...prev, payload.new])
            },
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      } catch (error) {
        console.error("Error fetching messages:", error)
      }
    }

    fetchMessages()
  }, [selectedRoom])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !audioBlob) return

    try {
      const supabase = createClient()
      let messageData: any = {
        room_id: selectedRoom.id,
        user_id: user?.id,
        content: newMessage,
        message_type: "text",
        created_at: new Date().toISOString(),
      }

      if (audioBlob) {
        const fileName = `voice-note-${Date.now()}.webm`
        const filePath = `voice-notes/${circleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from("media").upload(filePath, audioBlob)

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(filePath)

        messageData = {
          ...messageData,
          message_type: "voice_note",
          file_url: publicUrl,
          content: "Voice Note",
        }
      }

      const { error } = await supabase.from("circle_messages").insert(messageData)

      if (error) throw error

      setNewMessage("")
      setAudioBlob(null)
      toast({ description: "Message sent!" })
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => {
        chunks.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" })
        setAudioBlob(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      setRecordingTime(0)

      recordingInterval.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Error starting recording:", error)
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current)
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
      setAudioBlob(null)
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current)
      }
    }
  }

  const handleJoinVoice = async () => {
    if (!selectedRoom.is_voice_enabled) {
      toast({
        title: "Voice Not Available",
        description: "Voice chat is not enabled in this room.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsInVoice(!isInVoice)
      toast({
        description: isInVoice ? "Left voice chat" : "Joined voice chat",
      })
    } catch (error) {
      console.error("Error joining voice:", error)
    }
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

  const handlePinMessage = async (messageId: string) => {
    try {
      const supabase = createClient()

      const message = messages.find((m: any) => m.id === messageId)
      const { error } = await supabase
        .from("circle_messages")
        .update({ is_pinned: !message.is_pinned })
        .eq("id", messageId)

      if (error) throw error

      setMessages((prev: any) =>
        prev.map((msg: any) => (msg.id === messageId ? { ...msg, is_pinned: !msg.is_pinned } : msg)),
      )

      toast({ description: "Message pinned!" })
    } catch (error) {
      console.error("Error pinning message:", error)
    }
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

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!selectedRoom) {
    return <div className="flex justify-center p-8">Loading chat rooms...</div>
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
            {chatRooms.map((room: any) => (
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
                    <span className="text-xs text-gray-500">{room.member_count?.[0]?.count || 0}</span>
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
                {voiceUsers.map((voiceUser: any) => (
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
                  {selectedRoom.description} • {selectedRoom.member_count?.[0]?.count || 0} members
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
                    {isInVoice ? <Phone className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
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
              {messages.filter((msg: any) => msg.is_pinned).length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center space-x-2 mb-2">
                    <Pin className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pinned Messages</span>
                  </div>
                  {messages
                    .filter((msg: any) => msg.is_pinned)
                    .map((message: any) => (
                      <div key={`pinned-${message.id}`} className="text-sm text-yellow-700 dark:text-yellow-300">
                        <strong>{message.user?.display_name}:</strong> {message.content}
                      </div>
                    ))}
                </div>
              )}

              {/* Regular Messages */}
              {messages.map((message: any) => (
                <div key={message.id} className="flex items-start space-x-3 group">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={message.user?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="text-xs">{message.user?.display_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{message.user?.display_name}</span>
                      {getRoleIcon(message.user?.role)}
                      {message.user?.is_premium && (
                        <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs">
                          Premium
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">{formatTime(message.created_at)}</span>
                    </div>

                    {/* Voice Note Display */}
                    {message.message_type === "voice_note" ? (
                      <div className="flex items-center space-x-2 mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <FileAudio className="w-4 h-4 text-purple-500" />
                        <audio controls className="flex-1">
                          <source src={message.file_url} type="audio/webm" />
                        </audio>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{message.content}</p>
                    )}
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
            {/* Voice Note Recording */}
            {isRecording && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                      Recording: {formatRecordingTime(recordingTime)}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={cancelRecording}>
                      Cancel
                    </Button>
                    <Button variant="default" size="sm" onClick={stopRecording}>
                      <Square className="w-4 h-4 mr-1" />
                      Stop
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Audio Preview */}
            {audioBlob && !isRecording && (
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileAudio className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">Voice note ready</span>
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

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <Smile className="w-4 h-4" />
              </Button>

              {/* Voice Note Button */}
              <Button
                variant="outline"
                size="icon"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                className={isRecording ? "bg-red-100 border-red-300" : ""}
              >
                <Mic className={`w-4 h-4 ${isRecording ? "text-red-500" : ""}`} />
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
                disabled={isRecording}
              />

              <Button
                onClick={handleSendMessage}
                disabled={(!newMessage.trim() && !audioBlob) || isRecording}
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
