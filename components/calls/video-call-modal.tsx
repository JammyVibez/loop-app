"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Settings,
  Users,
  MessageSquare,
  MoreVertical,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Crown,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface CallParticipant {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_premium: boolean
  is_muted: boolean
  is_video_enabled: boolean
  is_speaking: boolean
  connection_quality: 'excellent' | 'good' | 'poor'
}

interface VideoCallModalProps {
  isOpen: boolean
  onClose: () => void
  callType: 'video' | 'audio'
  participants: CallParticipant[]
  callId: string
  isIncoming?: boolean
  caller?: CallParticipant
}

export function VideoCallModal({
  isOpen,
  onClose,
  callType,
  participants,
  callId,
  isIncoming = false,
  caller,
}: VideoCallModalProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video')
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting')
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string
    sender: string
    message: string
    timestamp: Date
  }>>([])
  const [newMessage, setNewMessage] = useState("")

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [callStatus])

  // Initialize media stream
  useEffect(() => {
    if (isOpen && callStatus === 'connecting') {
      initializeMediaStream()
    }
  }, [isOpen, callStatus])

  const initializeMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: true,
      })

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Simulate connection after 2 seconds
      setTimeout(() => {
        setCallStatus('connected')
        toast({
          title: "Call Connected",
          description: "You are now connected to the call.",
        })
      }, 2000)
    } catch (error) {
      console.error('Error accessing media devices:', error)
      toast({
        title: "Media Access Error",
        description: "Could not access camera or microphone.",
        variant: "destructive",
      })
    }
  }

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled)
    // TODO: Update video stream
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    // TODO: Update audio stream
  }

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn)
    // TODO: Update audio output
  }

  const endCall = () => {
    setCallStatus('ended')
    // TODO: Clean up media streams
    onClose()
    toast({
      title: "Call Ended",
      description: `Call duration: ${formatDuration(callDuration)}`,
    })
  }

  const acceptCall = () => {
    setCallStatus('connecting')
    initializeMediaStream()
  }

  const rejectCall = () => {
    onClose()
    toast({
      title: "Call Rejected",
      description: "You rejected the incoming call.",
    })
  }

  const sendChatMessage = () => {
    if (!newMessage.trim()) return

    const message = {
      id: Date.now().toString(),
      sender: user?.display_name || 'You',
      message: newMessage,
      timestamp: new Date(),
    }

    setChatMessages(prev => [...prev, message])
    setNewMessage("")
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getConnectionQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-500'
      case 'good': return 'text-yellow-500'
      case 'poor': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  if (isIncoming && callStatus === 'connecting') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-6 p-6">
            <div className="relative">
              <Avatar className="h-24 w-24 mx-auto">
                <AvatarImage src={caller?.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {caller?.display_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {caller?.is_premium && (
                <Crown className="absolute -top-2 -right-2 h-6 w-6 text-yellow-500" />
              )}
            </div>

            <div>
              <h3 className="text-xl font-semibold">{caller?.display_name}</h3>
              <p className="text-gray-500">@{caller?.username}</p>
              <Badge className="mt-2">
                {callType === 'video' ? 'Video Call' : 'Voice Call'}
              </Badge>
            </div>

            <div className="flex justify-center space-x-4">
              <Button
                onClick={rejectCall}
                variant="destructive"
                size="lg"
                className="rounded-full h-14 w-14"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button
                onClick={acceptCall}
                className="bg-green-500 hover:bg-green-600 rounded-full h-14 w-14"
                size="lg"
              >
                <Phone className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isFullscreen ? 'max-w-full h-full' : 'max-w-4xl'} p-0`}>
        <div className="relative h-full bg-black rounded-lg overflow-hidden">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                  {callStatus === 'connected' ? formatDuration(callDuration) : 'Connecting...'}
                </Badge>
                <span className="text-sm">{participants.length} participants</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-white hover:bg-white/20"
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  className="text-white hover:bg-white/20"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Video Grid */}
          <div className="h-full flex">
            <div className={`${showChat ? 'flex-1' : 'w-full'} relative`}>
              {callType === 'video' && isVideoEnabled ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-full p-4">
                  {/* Remote Video */}
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {participants[0] && (
                      <div className="absolute bottom-2 left-2 flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={participants[0].avatar_url} />
                          <AvatarFallback>{participants[0].display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-white text-sm font-medium">
                          {participants[0].display_name}
                        </span>
                        {participants[0].is_muted && (
                          <MicOff className="h-4 w-4 text-red-400" />
                        )}
                        <div className={`w-2 h-2 rounded-full ${getConnectionQualityColor(participants[0].connection_quality)}`} />
                      </div>
                    )}
                  </div>

                  {/* Local Video */}
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.avatar_url} />
                        <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-white text-sm font-medium">You</span>
                      {isMuted && <MicOff className="h-4 w-4 text-red-400" />}
                    </div>
                  </div>
                </div>
              ) : (
                // Audio-only view
                <div className="h-full flex items-center justify-center">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {participants.map((participant) => (
                      <div key={participant.id} className="text-center">
                        <Avatar className="h-24 w-24 mx-auto mb-4">
                          <AvatarImage src={participant.avatar_url} />
                          <AvatarFallback className="text-2xl">
                            {participant.display_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="text-white text-lg font-medium">
                          {participant.display_name}
                        </h3>
                        <div className="flex items-center justify-center space-x-2 mt-2">
                          {participant.is_muted && (
                            <MicOff className="h-4 w-4 text-red-400" />
                          )}
                          <div className={`w-2 h-2 rounded-full ${getConnectionQualityColor(participant.connection_quality)}`} />
                        </div>
                      </div>
                    ))}
                    
                    {/* Current user */}
                    <div className="text-center">
                      <Avatar className="h-24 w-24 mx-auto mb-4">
                        <AvatarImage src={user?.avatar_url} />
                        <AvatarFallback className="text-2xl">
                          {user?.display_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-white text-lg font-medium">You</h3>
                      <div className="flex items-center justify-center space-x-2 mt-2">
                        {isMuted && <MicOff className="h-4 w-4 text-red-400" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Sidebar */}
            {showChat && (
              <div className="w-80 bg-white dark:bg-gray-900 border-l">
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold">Call Chat</h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="text-sm">
                        <div className="font-medium text-purple-600">{msg.sender}</div>
                        <div className="text-gray-700 dark:text-gray-300">{msg.message}</div>
                        <div className="text-xs text-gray-500">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-4 border-t">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      />
                      <Button onClick={sendChatMessage} size="sm">
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6">
            <div className="flex items-center justify-center space-x-4">
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                className="rounded-full h-12 w-12"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>

              {callType === 'video' && (
                <Button
                  onClick={toggleVideo}
                  variant={isVideoEnabled ? "secondary" : "destructive"}
                  size="lg"
                  className="rounded-full h-12 w-12"
                >
                  {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              )}

              <Button
                onClick={toggleSpeaker}
                variant="secondary"
                size="lg"
                className="rounded-full h-12 w-12"
              >
                {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </Button>

              <Button
                onClick={endCall}
                variant="destructive"
                size="lg"
                className="rounded-full h-12 w-12"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>

              <Button
                variant="secondary"
                size="lg"
                className="rounded-full h-12 w-12"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
