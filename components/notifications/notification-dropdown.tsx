"use client"

import { useState } from "react"
import { Bell, Heart, MessageCircle, UserPlus, Gift, TrendingUp } from "lucide-react"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { formatDistanceToNow } from "date-fns"

interface Notification {
  id: string
  type: "like" | "comment" | "follow" | "mention" | "gift" | "trending"
  user: {
    username: string
    display_name: string
    avatar_url: string
  }
  content: string
  created_at: string
  read: boolean
}

export function NotificationDropdown() {
  const [notifications] = useState<Notification[]>([
    {
      id: "1",
      type: "like",
      user: {
        username: "techcreator",
        display_name: "Tech Creator",
        avatar_url: "/placeholder.svg?height=32&width=32",
      },
      content: "liked your loop about AI innovation",
      created_at: "2024-01-20T10:30:00Z",
      read: false,
    },
    {
      id: "2",
      type: "comment",
      user: {
        username: "designguru",
        display_name: "Design Guru",
        avatar_url: "/placeholder.svg?height=32&width=32",
      },
      content: "commented on your design loop",
      created_at: "2024-01-20T09:15:00Z",
      read: false,
    },
    {
      id: "3",
      type: "follow",
      user: {
        username: "musicmaker",
        display_name: "Music Maker",
        avatar_url: "/placeholder.svg?height=32&width=32",
      },
      content: "started following you",
      created_at: "2024-01-20T08:45:00Z",
      read: true,
    },
    {
      id: "4",
      type: "gift",
      user: {
        username: "artcreator",
        display_name: "Art Creator",
        avatar_url: "/placeholder.svg?height=32&width=32",
      },
      content: "sent you a premium gift",
      created_at: "2024-01-19T16:20:00Z",
      read: true,
    },
  ])

  const unreadCount = notifications.filter((n) => !n.read).length

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="h-4 w-4 text-red-500" />
      case "comment":
        return <MessageCircle className="h-4 w-4 text-blue-500" />
      case "follow":
        return <UserPlus className="h-4 w-4 text-green-500" />
      case "gift":
        return <Gift className="h-4 w-4 text-purple-500" />
      case "trending":
        return <TrendingUp className="h-4 w-4 text-orange-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && <p className="text-sm text-muted-foreground">{unreadCount} new notifications</p>}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                  !notification.read ? "bg-blue-50 dark:bg-blue-900/10" : ""
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={notification.user.avatar_url || "/placeholder.svg"}
                      alt={notification.user.display_name}
                    />
                    <AvatarFallback>{notification.user.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {getNotificationIcon(notification.type)}
                      <span className="font-medium text-sm">{notification.user.display_name}</span>
                      {!notification.read && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{notification.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-4 border-t">
            <Button variant="ghost" className="w-full text-sm">
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
