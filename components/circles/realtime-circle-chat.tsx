"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Wifi, WifiOff } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { formatDistanceToNow } from "date-fns"

interface CircleRoomMessage {
  id: string
  content: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_verified?: boolean
    is_premium?: boolean
  }
  timestamp: string
}

interface RealtimeCircleChatProps {
  circleId: string
  roomId: string
  roomName: string
}

function mapMessage(message: any): CircleRoomMessage {
  const author = Array.isArray(message.author) ? message.author[0] : message.author
  return {
    id: message.id,
    content: message.content || "",
    author: author || { id: message.author_id, username: "member", display_name: "Member" },
    timestamp: message.created_at || message.timestamp || new Date().toISOString(),
  }
}

export function RealtimeCircleChat({ circleId, roomId, roomName }: RealtimeCircleChatProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<CircleRoomMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = async () => {
    if (!user || !roomId) return

    try {
      const response = await fetch(`/api/circles/${circleId}/rooms/${roomId}/messages`, {
        headers: getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load messages")
      setMessages((data.messages || []).map(mapMessage))
    } catch (error) {
      console.error("Failed to load room messages:", error)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [circleId, roomId, user?.id])

  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`circle-room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "circle_room_messages", filter: `room_id=eq.${roomId}` },
        () => loadMessages(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "circle_room_messages", filter: `room_id=eq.${roomId}` },
        () => loadMessages(),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "circle_room_messages", filter: `room_id=eq.${roomId}` },
        () => loadMessages(),
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"))

    return () => {
      supabase.removeChannel(channel)
      setIsConnected(false)
    }
  }, [roomId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return

    const optimisticMessage: CircleRoomMessage = {
      id: `temp-${Date.now()}`,
      content: newMessage.trim(),
      author: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
        is_premium: user.is_premium,
      },
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage("")
    setIsSending(true)

    try {
      const response = await fetch(`/api/circles/${circleId}/rooms/${roomId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ content: optimisticMessage.content, media_url: null, media_type: null }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to send message")
      setMessages((prev) => prev.map((item) => item.id === optimisticMessage.id ? mapMessage(data.data) : item))
    } catch (error: any) {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticMessage.id))
      toast({ title: "Message failed", description: error?.message || "Please try again.", variant: "destructive" })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card className="flex h-full min-h-[28rem] flex-col border-white/10 bg-[#0a1020]/90 text-slate-100">
      <CardHeader className="border-b border-white/10 pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span># {roomName}</span>
          <span className="flex items-center gap-1 text-xs font-normal text-slate-400">
            {isConnected ? <Wifi className="h-3.5 w-3.5 text-emerald-300" /> : <WifiOff className="h-3.5 w-3.5 text-amber-300" />}
            {isConnected ? "Realtime" : "Syncing"}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                No messages yet. Start the room conversation.
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={message.author.avatar_url} alt={message.author.display_name} />
                  <AvatarFallback>{message.author.display_name?.charAt(0) || "M"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{message.author.display_name}</span>
                    <span className="text-xs text-slate-500">{formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}</span>
                  </div>
                  <div className="max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-end gap-2">
            <Textarea
              placeholder={`Message #${roomName}...`}
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  handleSendMessage()
                }
              }}
              className="min-h-[44px] max-h-32 resize-none border-white/10 bg-white/[0.04] text-slate-100"
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim() || isSending} className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
