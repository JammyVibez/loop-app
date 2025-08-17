"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Gift, X, Heart, Sparkles } from "lucide-react"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/hooks/use-auth"

interface GiftNotification {
  id: string
  sender: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
  }
  gift: {
    id: string
    name: string
    type: string
    rarity: string
    effects?: {
      animation?: string
      sound?: string
      particles?: boolean
    }
  }
  message?: string
  is_anonymous: boolean
  timestamp: string
}

export function GiftNotificationSystem() {
  const [notifications, setNotifications] = useState<GiftNotification[]>([])
  const { socket, isConnected } = useRealtime()
  const { user } = useAuth()

  useEffect(() => {
    if (socket && isConnected && user) {
      // Listen for incoming gifts
      socket.on("gift_received", (giftData: GiftNotification) => {
        if (giftData.sender.id !== user.id) {
          // Don't show notifications for gifts we sent
          setNotifications((prev) => [giftData, ...prev.slice(0, 4)]) // Keep only 5 most recent

          // Trigger gift effects
          if (giftData.gift.effects) {
            triggerGiftEffects(giftData.gift.effects)
          }

          // Auto-remove after 10 seconds
          setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== giftData.id))
          }, 10000)
        }
      })

      return () => {
        socket.off("gift_received")
      }
    }
  }, [socket, isConnected, user])

  const triggerGiftEffects = (effects: GiftNotification["gift"]["effects"]) => {
    if (effects?.animation) {
      // Add CSS animation class
      document.body.classList.add(`gift-received-${effects.animation}`)
      setTimeout(() => {
        document.body.classList.remove(`gift-received-${effects.animation}`)
      }, 3000)
    }

    if (effects?.sound) {
      // Play sound effect
      const audio = new Audio(`/sounds/gifts/${effects.sound}.mp3`)
      audio.volume = 0.4
      audio.play().catch(() => {
        // Ignore audio errors
      })
    }

    if (effects?.particles) {
      // Trigger particle effect
      createParticleEffect()
    }
  }

  const createParticleEffect = () => {
    // Create floating particles
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement("div")
      particle.className = "gift-particle"
      particle.style.cssText = `
        position: fixed;
        top: ${Math.random() * 100}vh;
        left: ${Math.random() * 100}vw;
        width: 8px;
        height: 8px;
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        animation: giftParticleFloat 3s ease-out forwards;
      `
      document.body.appendChild(particle)

      setTimeout(() => {
        particle.remove()
      }, 3000)
    }
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "bg-gray-100 text-gray-700"
      case "rare":
        return "bg-blue-100 text-blue-700"
      case "epic":
        return "bg-purple-100 text-purple-700"
      case "legendary":
        return "bg-yellow-100 text-yellow-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <Card
          key={notification.id}
          className="gift-notification-card animate-slide-in-right shadow-lg border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50"
        >
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage
                    src={notification.is_anonymous ? undefined : notification.sender.avatar_url}
                    alt={notification.is_anonymous ? "Anonymous" : notification.sender.display_name}
                  />
                  <AvatarFallback>
                    {notification.is_anonymous ? "?" : notification.sender.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <Gift className="w-3 h-3 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">
                    {notification.is_anonymous ? "Anonymous" : notification.sender.display_name} sent you a gift!
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissNotification(notification.id)}
                    className="h-6 w-6 p-0 hover:bg-red-100"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm font-medium text-purple-700">{notification.gift.name}</span>
                  <Badge className={`text-xs ${getRarityColor(notification.gift.rarity)}`}>
                    {notification.gift.rarity}
                  </Badge>
                </div>

                {notification.message && (
                  <p className="text-xs text-gray-600 bg-white/50 rounded p-2 mb-2">"{notification.message}"</p>
                )}

                <div className="flex items-center space-x-2">
                  <Heart className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-gray-500">{new Date(notification.timestamp).toLocaleTimeString()}</span>
                  {notification.gift.effects?.particles && (
                    <Sparkles className="w-3 h-3 text-purple-500 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
