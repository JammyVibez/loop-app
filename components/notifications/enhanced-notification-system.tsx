
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Bell,
  Gift,
  Heart,
  MessageCircle,
  UserPlus,
  Crown,
  Coins,
  Trophy,
  CheckCircle,
  XCircle,
  Eye,
  Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: any
  is_read: boolean
  created_at: string
  action_url?: string
}

interface Gift {
  id: string
  gift_name: string
  gift_type: string
  gift_value: any
  cost: number
  message?: string
  is_anonymous: boolean
  sender: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
  }
  created_at: string
  status: string
}

export function EnhancedNotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pendingGifts, setPendingGifts] = useState<Gift[]>([])
  const [loading, setLoading] = useState(false)
  const [processingGift, setProcessingGift] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user?.token) {
      fetchNotifications()
      fetchPendingGifts()
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(() => {
        fetchNotifications()
        fetchPendingGifts()
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [user?.token])

  const fetchNotifications = async () => {
    if (!user?.token) return

    try {
      const response = await fetch("/api/notifications", {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    }
  }

  const fetchPendingGifts = async () => {
    if (!user?.token) return

    try {
      const response = await fetch("/api/gifts/manage?status=sent", {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPendingGifts(data.data?.gifts || [])
      }
    } catch (error) {
      console.error("Error fetching pending gifts:", error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    if (!user?.token) return

    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })

      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      )
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const handleGiftAction = async (giftId: string, action: 'accept' | 'decline', reason?: string) => {
    if (!user?.token) return

    setProcessingGift(giftId)

    try {
      const response = await fetch("/api/gifts/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          gift_id: giftId,
          action,
          reason
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: action === 'accept' ? "Gift Accepted!" : "Gift Declined",
          description: data.message,
        })

        // Remove the gift from pending list
        setPendingGifts(prev => prev.filter(gift => gift.id !== giftId))
        
        // Refresh notifications
        fetchNotifications()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process gift",
        variant: "destructive",
      })
    } finally {
      setProcessingGift(null)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500" />
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500" />
      case 'follow':
        return <UserPlus className="w-4 h-4 text-green-500" />
      case 'gift_received':
        return <Gift className="w-4 h-4 text-purple-500" />
      case 'achievement':
        return <Trophy className="w-4 h-4 text-yellow-500" />
      case 'weekly_bonus':
        return <Coins className="w-4 h-4 text-yellow-500" />
      case 'premium_granted':
        return <Crown className="w-4 h-4 text-purple-500" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length + pendingGifts.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} unread</p>
          )}
        </div>

        <ScrollArea className="h-96">
          <div className="p-2">
            {/* Pending Gifts Section */}
            {pendingGifts.length > 0 && (
              <>
                <div className="px-2 py-1">
                  <h4 className="text-sm font-medium text-purple-600">Pending Gifts</h4>
                </div>
                {pendingGifts.map((gift) => (
                  <Card key={gift.id} className="mb-2 border-purple-200">
                    <CardContent className="p-3">
                      <div className="flex items-start space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage 
                            src={gift.is_anonymous ? "/placeholder.svg" : gift.sender.avatar_url} 
                          />
                          <AvatarFallback>
                            {gift.is_anonymous ? "?" : gift.sender.display_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Gift className="w-4 h-4 text-purple-500" />
                            <span className="text-sm font-medium">{gift.gift_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {gift.cost} coins
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600">
                            From: {gift.is_anonymous ? "Anonymous" : gift.sender.display_name}
                          </p>
                          {gift.message && (
                            <p className="text-xs text-gray-600 mt-1 italic">
                              "{gift.message}"
                            </p>
                          )}
                          <div className="flex space-x-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => handleGiftAction(gift.id, 'accept')}
                              disabled={processingGift === gift.id}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-auto"
                            >
                              {processingGift === gift.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGiftAction(gift.id, 'decline')}
                              disabled={processingGift === gift.id}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {notifications.length > 0 && <Separator className="my-2" />}
              </>
            )}

            {/* Regular Notifications */}
            {notifications.length === 0 && pendingGifts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                    !notification.is_read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id)
                    }
                    if (notification.action_url) {
                      window.location.href = notification.action_url
                    }
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {(notifications.length > 0 || pendingGifts.length > 0) && (
          <div className="p-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false)
                // Navigate to full notifications page
                window.location.href = "/notifications"
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              View All Notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
