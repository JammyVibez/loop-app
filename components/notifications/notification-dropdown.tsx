"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Check, Loader2, Settings, Heart, MessageCircle, UserPlus, GitBranch, AtSign, Gift, Mail, BellRing, ChevronRight } from "lucide-react"
import { NotificationQuickReply } from "@/components/notifications/notification-quick-reply";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp";
import { CoLoopInviteCard } from "@/components/invitations/co-loop-invite-card";
import { supabase } from "@/lib/supabase";
import { getDiceBearUrl } from "@/lib/dicebear";

interface Actor {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_verified: boolean
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: any
  is_read: boolean
  created_at: string
  updated_at?: string
  actor?: Actor | null
  actors?: Actor[]
  count?: number
  actor_ids?: string[]
}

// ── Notification type → icon + color ──────────────────────────────
const TYPE_CONFIG: Record<string, { icon: typeof Heart; color: string; bg: string; label: string }> = {
  like: { icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10", label: "Like" },
  comment: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10", label: "Comment" },
  follow: { icon: UserPlus, color: "text-violet-500", bg: "bg-violet-500/10", label: "Follow" },
  branch: { icon: GitBranch, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Branch" },
  mention: { icon: AtSign, color: "text-amber-500", bg: "bg-amber-500/10", label: "Mention" },
  gift: { icon: Gift, color: "text-pink-500", bg: "bg-pink-500/10", label: "Gift" },
  message: { icon: Mail, color: "text-cyan-500", bg: "bg-cyan-500/10", label: "Message" },
  system: { icon: BellRing, color: "text-sky-500", bg: "bg-sky-500/10", label: "System" },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { icon: Bell, color: "text-muted-foreground", bg: "bg-muted", label: "Notification" }
}

// ── Time grouping helper ──────────────────────────────────────────
function groupNotifications(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: Notification[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ]

  for (const n of notifications) {
    const d = new Date(n.created_at)
    if (d >= today) groups[0].items.push(n)
    else if (d >= yesterday) groups[1].items.push(n)
    else if (d >= weekAgo) groups[2].items.push(n)
    else groups[3].items.push(n)
  }

  return groups.filter((g) => g.items.length > 0)
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
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      })
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)))
        setUnreadCount((prev) => Math.max(0, prev - 1))
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
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ mark_all_read: true }),
      })
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        setUnreadCount(0)
        toast({ title: "Success", description: "All notifications marked as read" })
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const notificationHref = (n: Notification) => {
    const data = n.data || {}
    if (data.href) return data.href
    if (data.action_url) return data.action_url
    if (data.url) return data.url
    if (data.conversation_id) return `/messages?c=${data.conversation_id}`
    if (data.loop_id) return `/loop/${data.loop_id}`
    if (data.circle_id) return `/circles/${data.circle_id}`
    if (data.reel_id) return `/trees?id=${data.reel_id}`
    if (data.username) return `/profile/${data.username}`
    if (data.actor_username) return `/profile/${data.actor_username}`
    if (n.type === "mention") return "/notifications?type=mention"
    return "/notifications"
  }

  const groups = useMemo(() => groupNotifications(notifications), [notifications])

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[380px] max-w-[calc(100vw-2rem)] p-0" align="end" forceMount>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="h-[420px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 opacity-50" />
              </div>
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">When someone interacts with you, it will show up here</p>
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-2 bg-muted/30">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                  </div>
                  {group.items.map((notification) => {
                    const href = notificationHref(notification)
                    const config = getTypeConfig(notification.type)
                    const Icon = config.icon
                    const actor = notification.actor

                    const isCoLoopInvite =
                      notification.type === "co_loop" ||
                      notification.type === "co_loop_invite" ||
                      notification.title.toLowerCase().includes("co-loop")

                    if (isCoLoopInvite) {
                      const inviteSessionId = notification.data?.session_id || notification.data?.sessionId || "demo-session-1"
                      const inviterDisplayName =
                        notification.data?.inviter_name ||
                        notification.data?.inviter_username ||
                        notification.message?.split(" invited")[0] ||
                        "A Collaborator"
                      return (
                        <div key={notification.id} className="p-2 border-b border-border/40">
                          <CoLoopInviteCard
                            sessionId={inviteSessionId}
                            inviterName={inviterDisplayName}
                            createdAt={notification.created_at}
                          />
                        </div>
                      )
                    }

                    // Grouped notification — show stacked actor avatars
                    const groupedActors = (notification as any).actors || []
                    const groupCount = (notification as any).count || 1
                    const isGrouped = groupCount > 1 && groupedActors.length > 1

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border/40 last:border-0 transition-colors hover:bg-muted/50 ${
                          !notification.is_read ? "bg-primary/5" : ""
                        }`}
                        onClick={() => {
                          if (!notification.is_read) void markAsRead(notification.id)
                          if (href) window.location.href = href
                        }}
                      >
                        {/* Actor avatar(s) — stacked for grouped, single for normal */}
                        <div className="relative shrink-0">
                          {isGrouped ? (
                            <div className="relative h-10 w-10">
                              {/* Stacked avatars — top 3 */}
                              {groupedActors.slice(0, 3).map((a: any, i: number) => (
                                <Avatar
                                  key={a.id || i}
                                  className="absolute h-8 w-8 border-2 border-background"
                                  style={{ top: i * 4, left: i * 4, zIndex: 3 - i }}
                                >
                                  <AvatarImage src={a.avatar_url || undefined} alt={a.display_name || a.username} />
                                  <AvatarFallback className="text-[10px]">
                                    {(a.display_name || a.username || "?").charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                          ) : (
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={actor?.avatar_url || undefined}
                                alt={actor?.display_name || actor?.username || "user"}
                                fallbackSeed={actor?.username}
                              />
                              <AvatarFallback className="text-xs">
                                {actor?.display_name?.charAt(0) || actor?.username?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {/* Type icon badge overlay */}
                          <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full ${config.bg} flex items-center justify-center ring-2 ring-background`}>
                            <Icon className={`h-2.5 w-2.5 ${config.color}`} />
                          </div>
                          {isGrouped && groupCount > 3 && (
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground ring-2 ring-background z-10">
                              +{groupCount - 3}
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">
                            {isGrouped ? (
                              <>
                                <span className="font-semibold">
                                  {groupedActors[0]?.display_name || groupedActors[0]?.username || ""}
                                </span>
                                <span className="text-muted-foreground">
                                  {groupCount === 2
                                    ? ` and ${groupedActors[1]?.display_name || groupedActors[1]?.username || "someone"} `
                                    : ` and ${groupCount - 1} others `}
                                </span>
                                <span className="text-muted-foreground">
                                  {notification.type === "like" ? "liked" : notification.type === "follow" ? "followed" : notification.type === "boost" ? "boosted" : "interacted with"} your post
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-semibold">
                                  {actor?.display_name || actor?.username || ""}
                                </span>
                                {actor && <span className="text-muted-foreground"> </span>}
                                <span className="text-muted-foreground">
                                  {notification.title}
                                </span>
                              </>
                            )}
                          </p>
                          {notification.message && notification.message !== notification.title && !isGrouped && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <FreshnessTimestamp date={notification.updated_at || notification.created_at} showIcon />
                            {!notification.is_read && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          {/* Quick reply for DMs and comments */}
                          {!isGrouped && (notification.type === "message" || notification.type === "comment" || notification.type === "reply") && (
                            <NotificationQuickReply notification={notification} compact />
                          )}
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-2" />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border/60 p-2">
          <Link href="/notifications" className="block">
            <Button variant="ghost" className="w-full justify-center text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(false)}>
              See all notifications
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
