"use client"

import { useState, useEffect, useRef } from "react"
import { 
  Bell, 
  Heart, 
  MessageCircle, 
  UserPlus, 
  Gift, 
  TrendingUp, 
  Trophy,
  Zap,
  Star,
  Crown,
  X
} from "lucide-react"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent } from "../ui/card"

interface Notification {
  id: string
  type: "like" | "comment" | "follow" | "mention" | "gift" | "trending" | "achievement" | "level_up" | "coin_reward"
  user?: {
    username: string
    display_name: string
    avatar_url: string
    is_verified?: boolean
    is_premium?: boolean
  }
  content: string
  data?: {
    xp_gained?: number
    coins_gained?: number
    achievement_name?: string
    level_reached?: number
    gift_item?: string
  }
  created_at: string
  read: boolean
  priority: "low" | "medium" | "high"
}

export function EnhancedNotificationDropdown3D() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "achievement",
      content: "Unlocked 'Social Butterfly' achievement!",
      data: { achievement_name: "Social Butterfly", xp_gained: 100 },
      created_at: "2024-01-20T10:30:00Z",
      read: false,
      priority: "high"
    },
    {
      id: "2",
      type: "level_up",
      content: "Congratulations! You've reached Level 3!",
      data: { level_reached: 3, xp_gained: 50, coins_gained: 100 },
      created_at: "2024-01-20T10:25:00Z",
      read: false,
      priority: "high"
    },
    {
      id: "3",
      type: "like",
      user: {
        username: "techcreator",
        display_name: "Tech Creator",
        avatar_url: "/placeholder.svg?height=32&width=32",
        is_verified: true
      },
      content: "liked your loop about AI innovation",
      created_at: "2024-01-20T10:30:00Z",
      read: false,
      priority: "medium"
    },
    {
      id: "4",
      type: "gift",
      user: {
        username: "artcreator",
        display_name: "Art Creator",
        avatar_url: "/placeholder.svg?height=32&width=32",
        is_premium: true
      },
      content: "sent you a Cyberpunk Theme!",
      data: { gift_item: "Cyberpunk Theme" },
      created_at: "2024-01-19T16:20:00Z",
      read: false,
      priority: "high"
    },
    {
      id: "5",
      type: "coin_reward",
      content: "Daily login bonus: 50 Loop Coins!",
      data: { coins_gained: 50 },
      created_at: "2024-01-19T08:00:00Z",
      read: true,
      priority: "low"
    }
  ])

  const [isOpen, setIsOpen] = useState(false)
  const [animatingNotifications, setAnimatingNotifications] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length
  const highPriorityCount = notifications.filter((n) => !n.read && n.priority === "high").length

  const getNotificationIcon = (type: string, priority: string = "medium") => {
    const iconClass = `h-4 w-4 ${priority === "high" ? "animate-pulse" : ""}`
    
    switch (type) {
      case "like":
        return <Heart className={`${iconClass} text-red-500`} />
      case "comment":
        return <MessageCircle className={`${iconClass} text-blue-500`} />
      case "follow":
        return <UserPlus className={`${iconClass} text-green-500`} />
      case "gift":
        return <Gift className={`${iconClass} text-purple-500`} />
      case "trending":
        return <TrendingUp className={`${iconClass} text-orange-500`} />
      case "achievement":
        return <Trophy className={`${iconClass} text-yellow-500`} />
      case "level_up":
        return <Star className={`${iconClass} text-blue-600`} />
      case "coin_reward":
        return <Zap className={`${iconClass} text-yellow-600`} />
      default:
        return <Bell className={iconClass} />
    }
  }

  const getPriorityStyles = (priority: string, read: boolean) => {
    if (read) return "opacity-70"
    
    switch (priority) {
      case "high":
        return "bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border-l-4 border-red-500"
      case "medium":
        return "bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500"
      default:
        return "hover:bg-gray-50 dark:hover:bg-gray-800"
    }
  }

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const removeNotification = (notificationId: string) => {
    setAnimatingNotifications(prev => new Set(prev).add(notificationId))
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      setAnimatingNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
    }, 300)
  }

  // Auto-mark as read when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        markAllAsRead()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="btn-3d relative group">
          <div className="relative">
            <Bell className={`h-5 w-5 transition-all duration-300 ${
              unreadCount > 0 ? "animate-pulse text-primary" : ""
            } group-hover:scale-110`} />
            
            {/* Notification badges */}
            {unreadCount > 0 && (
              <>
                <Badge className={`absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs transition-all duration-300 ${
                  highPriorityCount > 0 
                    ? "bg-red-500 animate-bounce" 
                    : "bg-blue-500 animate-pulse"
                }`}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
                
                {/* High priority indicator */}
                {highPriorityCount > 0 && (
                  <div className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                )}
              </>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        ref={dropdownRef}
        className="w-96 max-h-[80vh] overflow-hidden modal-3d-content" 
        align="end" 
        forceMount
      >
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-background to-background/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {unreadCount} new notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-xs btn-3d"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">All caught up!</p>
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`
                    relative p-4 cursor-pointer transition-all duration-300 group
                    ${getPriorityStyles(notification.priority, notification.read)}
                    ${animatingNotifications.has(notification.id) ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
                  `}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeNotification(notification.id)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>

                  <div className="flex items-start space-x-3">
                    {/* User Avatar or System Icon */}
                    {notification.user ? (
                      <div className="relative">
                        <Avatar className="h-10 w-10 transition-transform duration-200 group-hover:scale-110">
                          <AvatarImage
                            src={notification.user.avatar_url || "/placeholder.svg"}
                            alt={notification.user.display_name}
                          />
                          <AvatarFallback>{notification.user.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {notification.user.is_premium && (
                          <Crown className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500" />
                        )}
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        {getNotificationIcon(notification.type, notification.priority)}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center space-x-2">
                        {getNotificationIcon(notification.type, notification.priority)}
                        {notification.user && (
                          <>
                            <span className="font-medium text-sm truncate">
                              {notification.user.display_name}
                            </span>
                            {notification.user.is_verified && (
                              <Badge variant="secondary" className="h-3 w-3 p-0 bg-blue-500">
                                <span className="text-white text-xs">✓</span>
                              </Badge>
                            )}
                          </>
                        )}
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        )}
                      </div>

                      <p className="text-sm text-foreground leading-relaxed">
                        {notification.content}
                      </p>

                      {/* Additional data display */}
                      {notification.data && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {notification.data.xp_gained && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                              +{notification.data.xp_gained} XP
                            </Badge>
                          )}
                          {notification.data.coins_gained && (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                              +{notification.data.coins_gained} coins
                            </Badge>
                          )}
                          {notification.data.level_reached && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                              Level {notification.data.level_reached}
                            </Badge>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Priority indicator */}
                  {notification.priority === "high" && !notification.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-orange-500 rounded-r" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-4 border-t bg-gradient-to-r from-background/80 to-background">
            <Button variant="ghost" className="w-full text-sm btn-3d">
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
