"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,  } from "@/components/ui/dropdown-menu";
import { Bell, Check, Loader2, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp";
import { CoLoopInviteCard } from "@/components/invitations/co-loop-invite-card";
import { supabase } from "@/lib/supabase";

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: any
  is_read: boolean
  created_at: string
}

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const fetchNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return
    if (!opts?.silent) setLoading(true)
    try {
      const response = await fetch("/api/notifications?limit=20", {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await response.json()
      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount((data.notifications || []).filter((n: Notification) => !n.is_read).length)
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [user?.id, getAuthHeader])

  useEffect(() => {
    if (user && isOpen) void fetchNotifications()
  }, [user?.id, isOpen, fetchNotifications])

  // Live badge + list: postgres changes + light poll
  useEffect(() => {
    if (!user?.id) return

    void fetchNotifications({ silent: true })

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Notification
          setNotifications((prev) => [row, ...prev.filter((n) => n.id !== row.id)].slice(0, 30))
          setUnreadCount((c) => c + 1)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          void fetchNotifications({ silent: true })
        },
      )
      .on("broadcast", { event: "notification" }, () => {
        void fetchNotifications({ silent: true })
      })
      .subscribe()

    const poll = setInterval(() => {
      void fetchNotifications({ silent: true })
    }, 45000)

    return () => {
      clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [user?.id, fetchNotifications])

  const markAsRead = async (notificationId: string) => {
    if (!user) return

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          notification_ids: [notificationId],
        }),
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          mark_all_read: true,
        }),
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true }))
        )
        setUnreadCount(0)
        toast({
          title: "Success",
          description: "All notifications marked as read",
        })
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return "❤️"
      case "comment":
        return "💬"
      case "follow":
        return "👤"
      case "branch":
        return "🌿"
      case "mention":
        return "📢"
      case "gift":
        return "🎁"
      case "system":
        return "🔔"
      default:
        return "📢"
    }
  }

  const notificationHref = (n: Notification) => {
    const data = n.data || {}
    if (data.href) return data.href
    if (data.loop_id) return `/loop/${data.loop_id}`
    if (data.circle_id) return `/circles/${data.circle_id}`
    if (data.reel_id) return `/reels?id=${data.reel_id}`
    if (data.username) return `/profile/${data.username}`
    if (data.actor_username) return `/profile/${data.actor_username}`
    if (n.type === "mention") return "/notifications?type=mention"
    return "/notifications"
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <div className="flex items-center justify-between p-4">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <Check className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => {
                const href = notificationHref(notification)
                const isCoLoopInvite = notification.type === "co_loop" || notification.type === "co_loop_invite" || notification.title.toLowerCase().includes("co-loop")

                if (isCoLoopInvite) {
                  const inviteSessionId = notification.data?.session_id || notification.data?.sessionId || "demo-session-1"
                  const inviterDisplayName = notification.data?.inviter_name || notification.data?.inviter_username || notification.message?.split(" invited")[0] || "A Collaborator"
                  return (
                    <div key={notification.id} className="p-2">
                      <CoLoopInviteCard
                        sessionId={inviteSessionId}
                        inviterName={inviterDisplayName}
                        createdAt={notification.created_at}
                      />
                    </div>
                  )
                }

                return (
                <DropdownMenuItem
                  key={notification.id}
                  className={`p-4 cursor-pointer border-b border-white/5 last:border-0 ${
                    !notification.is_read ? "bg-cyan-950/20" : ""
                  }`}
                  onClick={() => {
                    if (!notification.is_read) {
                      void markAsRead(notification.id)
                    }
                    if (href) window.location.href = href
                  }}
                >
                  <div className="flex items-start space-x-3 w-full">
                    <div className="text-lg">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-cyan-400 rounded-full ml-2 shadow-[0_0_6px_#22d3ee]" />
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {notification.message}
                      </p>
                      <div className="mt-1">
                        <FreshnessTimestamp date={notification.created_at} showIcon />
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              )})}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Link href="/notifications" className="block">
            <Button variant="ghost" className="w-full justify-center text-sm" onClick={() => setIsOpen(false)}>
              See all notifications & tags
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
