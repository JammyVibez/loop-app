"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Gift, X, Heart, Sparkles } from "lucide-react"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/hooks/use-auth"

interface IncomingGiftPayload {
  id?: string
  gift_name?: string
  gift_type?: string
  rarity?: string
  message?: string | null
  sender?: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
  } | null
  gift?: {
    id: string
    name: string
    type: string
    rarity: string
  }
  is_anonymous?: boolean
  timestamp?: string
}

interface GiftNotification {
  id: string
  sender: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
  } | null
  gift: {
    id: string
    name: string
    type: string
    rarity: string
  }
  message?: string
  is_anonymous: boolean
  timestamp: string
}

export function GiftNotificationSystem() {
  const [notifications, setNotifications] = useState<GiftNotification[]>([])
  const { isConnected, subscribe, unsubscribe } = useRealtime()
  const { user } = useAuth()

  useEffect(() => {
    if (!isConnected || !user) return

    const handler = (raw: any) => {
      const payload: IncomingGiftPayload = raw?.payload || raw || {}
      const giftName = payload.gift_name || payload.gift?.name
      if (!giftName) return

      const sender = payload.sender || null
      if (sender?.id && sender.id === user.id) return

      const notification: GiftNotification = {
        id: payload.id || payload.gift?.id || `${Date.now()}`,
        sender,
        gift: {
          id: payload.gift?.id || payload.id || "gift",
          name: giftName,
          type: payload.gift_type || payload.gift?.type || "special",
          rarity: payload.rarity || payload.gift?.rarity || "common",
        },
        message: payload.message || undefined,
        is_anonymous: payload.is_anonymous ?? !sender,
        timestamp: payload.timestamp || new Date().toISOString(),
      }

      setNotifications((prev) => [notification, ...prev.slice(0, 4)])
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
      }, 10000)
    }

    subscribe("gift_received", handler)

    return () => {
      unsubscribe("gift_received")
    }
  }, [isConnected, user, subscribe, unsubscribe])

  if (!notifications.length) return null

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-3">
      {notifications.map((notification) => (
        <Card key={notification.id} className="pointer-events-auto border-violet-500/30 bg-background/95 shadow-xl backdrop-blur">
          <CardContent className="relative space-y-3 p-4">
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-2 top-2 h-7 w-7"
              onClick={() => setNotifications((prev) => prev.filter((n) => n.id !== notification.id))}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-start gap-3 pr-6">
              <div className="rounded-full bg-violet-500/15 p-2 text-violet-500">
                <Gift className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-semibold">Gift received</p>
                  <Badge variant="secondary" className="capitalize">
                    {notification.gift.rarity}
                  </Badge>
                </div>
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  {notification.is_anonymous || !notification.sender ? (
                    <span>Someone sent you {notification.gift.name}</span>
                  ) : (
                    <>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={notification.sender.avatar_url} />
                        <AvatarFallback>{notification.sender.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span>
                        @{notification.sender.username} sent {notification.gift.name}
                      </span>
                    </>
                  )}
                </div>
                {notification.message && (
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">“{notification.message}”</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-violet-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  <Heart className="h-3.5 w-3.5" />
                  Enjoy your gift
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
