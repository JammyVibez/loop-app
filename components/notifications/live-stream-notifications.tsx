"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Radio, 
  Users, 
  Eye, 
  Clock,
  Bell,
  BellOff,
  ExternalLink
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface LiveStream {
  id: string
  title: string
  category: string
  viewer_count: number
  started_at: string
  thumbnail_url?: string
  streamer: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_verified?: boolean
  }
}

export function LiveStreamNotifications() {
  const { user } = useAuth()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  useEffect(() => {
    if (user) {
      fetchLiveStreams()
      // Set up polling for live streams
      const interval = setInterval(fetchLiveStreams, 30000) // Check every 30 seconds
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchLiveStreams = async () => {
    try {
      const response = await fetch('/api/streams/notifications')
      if (response.ok) {
        const data = await response.json()
        setLiveStreams(data.live_streams || [])
      }
    } catch (error) {
      console.error('Error fetching live streams:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleNotifications = async () => {
    // In a real app, this would update user preferences
    setNotificationsEnabled(!notificationsEnabled)
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radio className="w-5 h-5 text-red-500" />
            Live Now
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleNotifications}
            className="text-gray-500 hover:text-gray-700"
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {liveStreams.length === 0 ? (
          <div className="text-center py-6">
            <Radio className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              No one you follow is streaming right now
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {liveStreams.map((stream) => (
              <div
                key={stream.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={stream.streamer.avatar_url} />
                    <AvatarFallback>
                      {stream.streamer.display_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">
                      {stream.streamer.display_name}
                    </p>
                    {stream.streamer.is_verified && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        ✓
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      LIVE
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-2">
                    {stream.title}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{stream.viewer_count}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDistanceToNow(new Date(stream.started_at))} ago</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {stream.category}
                    </Badge>
                  </div>
                </div>

                <Link href={`/streams/${stream.id}`}>
                  <Button size="sm" variant="outline" className="shrink-0">
                    <Eye className="w-3 h-3 mr-1" />
                    Watch
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}

        {liveStreams.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <Link href="/streams">
              <Button variant="ghost" size="sm" className="w-full text-purple-600 hover:text-purple-700">
                View All Streams
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Floating notification component for when someone goes live
export function LiveStreamFloatingNotification({ 
  stream, 
  onClose 
}: { 
  stream: LiveStream
  onClose: () => void 
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Auto-hide after 10 seconds
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300) // Wait for animation
    }, 10000)

    return () => clearTimeout(timer)
  }, [onClose])

  if (!visible) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <Card className="w-80 shadow-lg border-l-4 border-l-red-500">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={stream.streamer.avatar_url} />
                <AvatarFallback>
                  {stream.streamer.display_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm">
                  {stream.streamer.display_name} is live!
                </p>
                <Badge variant="outline" className="text-xs">
                  LIVE
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {stream.title}
              </p>
            </div>

            <div className="flex gap-1">
              <Link href={`/streams/${stream.id}`}>
                <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white">
                  Watch
                </Button>
              </Link>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setVisible(false)
                  setTimeout(onClose, 300)
                }}
              >
                ×
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
