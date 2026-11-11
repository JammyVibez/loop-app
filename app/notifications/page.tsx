"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AtSign, Bell, CheckCheck, CheckCircle2, Heart, MessageCircle,
  Trash2, UserPlus, XCircle, Gift, Star, Repeat2,
  Shield, Award, TrendingUp, Users, Radio, Flame, BadgeCheck, Quote
} from "@/components/icons/lucide-compat"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Header } from "@/components/header"
import { mentionHref } from "@/lib/mentions-shared"
import { NotificationQuickReply } from "@/components/notifications/notification-quick-reply"
import { AdSlot } from "@/components/ads/ad-slot"
import { Spinner } from "@/components/ui/skeletons"
import { getNotificationCopy, maskAdminCopy, SYSTEM_SENDER } from "@/lib/notification-copy"
import { supabase } from "@/lib/supabase"

type Notification = {
  id: string
  type: string
  title: string
  message: string
  data?: any
  is_read: boolean
  created_at: string
  grouped_ids?: string[]
  unread_count?: number
  count?: number
  actor?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
    is_verified?: boolean
  } | null
}

type FollowRequest = {
  id: string
  status: string
  created_at: string
  requester?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
    is_verified?: boolean
    bio?: string
  } | null
}

type MentionRow = {
  id: string
  source_type: string
  snippet?: string
  href?: string
  created_at: string
  why: string
  actor?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
  } | null
  loop_id?: string
  circle_id?: string
  post_id?: string
  comment_id?: string
  reel_id?: string
}

/** Map notification types to Lucide icons + accent colors */
function notifIcon(type: string) {
  switch (type) {
    case "like":
      return { icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" }
    case "comment":
    case "comment_reply":
      return { icon: MessageCircle, color: "text-sky-500", bg: "bg-sky-500/10" }
    case "follow":
    case "follow_accepted":
      return { icon: UserPlus, color: "text-emerald-500", bg: "bg-emerald-500/10" }
    case "mention":
      return { icon: AtSign, color: "text-violet-500", bg: "bg-violet-500/10" }
    case "gift_received":
    case "gift_sent":
      return { icon: Gift, color: "text-amber-500", bg: "bg-amber-500/10" }
    case "repost":
    case "repost_of_your_post":
      return { icon: Repeat2, color: "text-cyan-500", bg: "bg-cyan-500/10" }
    case "quote":
      return { icon: Quote, color: "text-teal-500", bg: "bg-teal-500/10" }
    case "achievement":
      return { icon: Award, color: "text-yellow-500", bg: "bg-yellow-500/10" }
    case "level_up":
      return { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" }
    case "circle_invite":
    case "circle_joined":
      return { icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" }
    case "circle_post_comment":
      return { icon: MessageCircle, color: "text-sky-500", bg: "bg-sky-500/10" }
    case "circle_post_like":
      return { icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" }
    case "community_reaction":
      return { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" }
    case "chat_message":
      return { icon: MessageCircle, color: "text-indigo-500", bg: "bg-indigo-500/10" }
    case "verification_badge":
      return { icon: BadgeCheck, color: "text-cyan-500", bg: "bg-cyan-500/10" }
    case "live_stream":
    case "live_started":
      return { icon: Radio, color: "text-red-500", bg: "bg-red-500/10" }
    case "verified":
      return { icon: Shield, color: "text-blue-500", bg: "bg-blue-500/10" }
    case "system":
    case "reward":
      return { icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" }
    default:
      return { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" }
  }
}

/** Clean emoji artifacts from notification titles/messages */
function cleanText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Remove emoji
    .replace(/[\u{2600}-\u{26FF}]/gu, "")     // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "")     // Dingbats
    .replace(/\s{2,}/g, " ")                    // Collapse whitespace
    .trim()
}

function linkForNotification(n: Notification) {
  const d = n.data || {}
  if (d.href) return d.href
  // `action_url` is the destination the writer chose — for a quote it points at
  // the new quote post, while `loop_id` stays the quoted original.
  if (d.action_url) return d.action_url
  if ((n as any).action_url) return (n as any).action_url
  if (d.url) return d.url
  return mentionHref({
    source: d.source || "loop",
    loop_id: d.loop_id,
    circle_id: d.circle_id,
    post_id: d.post_id,
    reel_id: d.reel_id,
    comment_id: d.comment_id,
    conversation_id: d.conversation_id,
    room_id: d.room_id,
  })
}

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      }
    >
      <NotificationsContent />
    </Suspense>
  )
}

function NotificationsContent() {
  const { user, getAuthHeader, applyServerProfile } = useAuth()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("filter") || searchParams.get("type")
  const initialTab = searchParams.get("tab") === "tagged"
    ? "tagged"
    : requestedTab === "mention" || requestedTab === "mentions"
      ? "mentions"
      : requestedTab === "verified" || requestedTab === "unread"
        ? requestedTab
        : "all"
  const [tab, setTab] = useState(initialTab)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [mentions, setMentions] = useState<MentionRow[]>([])
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([])
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mutedTypes, setMutedTypes] = useState<string[]>([])
  const { toast } = useToast()

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const filterQuery = ["mentions", "verified", "unread"].includes(tab) ? `&filter=${tab}` : ""
      const [notifRes, mentionRes, followRes] = await Promise.all([
        fetch(`/api/notifications?limit=40${filterQuery}`, {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        }),
        fetch("/api/mentions?limit=40", {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        }),
        fetch("/api/users/follow-requests", {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        }),
      ])
      const notifData = await notifRes.json()
      const mentionData = await mentionRes.json()
      const followData = await followRes.json().catch(() => ({}))
      if (notifRes.ok) {
        setNotifications(notifData.notifications || [])
        setUnreadCount(typeof notifData.unread_count === "number" ? notifData.unread_count : 0)
        setMutedTypes(Array.isArray(notifData.muted_types) ? notifData.muted_types : [])
      }
      if (mentionRes.ok) setMentions(mentionData.mentions || [])
      if (followRes.ok) setFollowRequests(followData.incoming || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [user?.id, tab, getAuthHeader])

  const handleFollowRequest = async (requestId: string, action: "accept" | "decline") => {
    if (!user || processingRequest) return
    setProcessingRequest(requestId)
    try {
      const res = await fetch("/api/users/follow-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ request_id: requestId, action }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to process request")
      setFollowRequests((prev) => prev.filter((r) => r.id !== requestId))
      toast({
        title: action === "accept" ? "Follow request accepted" : "Follow request declined",
        description:
          action === "accept"
            ? "They can now see your profile and posts."
            : "They won't be able to follow you.",
      })
      void load()
    } catch (error: any) {
      toast({ title: "Could not process request", description: error.message, variant: "destructive" })
    } finally {
      setProcessingRequest(null)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`notifications-page:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe()
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 45_000)
    return () => {
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [user?.id, load])

  const markRead = async (id: string) => {
    const notification = notifications.find((item) => item.id === id)
    if (!notification || notification.is_read) return
    const groupedIds = notification.grouped_ids || [id]
    const newlyReadCount = notification.unread_count ?? groupedIds.length
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ notification_ids: groupedIds }),
    })
    if (!response.ok) return
    setNotifications((items) => items.map((item) => groupedIds.includes(item.id) || item.id === id ? { ...item, is_read: true } : item))
    setUnreadCount((count) => Math.max(0, count - newlyReadCount))
    window.dispatchEvent(new Event("loop:notifications-changed"))
  }

  const markAllRead = async () => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ mark_all_read: true }),
    })
    if (response.ok) {
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })))
      setUnreadCount(0)
      window.dispatchEvent(new Event("loop:notifications-changed"))
    }
  }

  const toggleMutedType = async (type: string) => {
    const previous = mutedTypes
    const next = previous.includes(type) ? previous.filter((value) => value !== type) : [...previous, type]
    setMutedTypes(next)
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ muted_types: next }),
    })
    if (!response.ok) {
      setMutedTypes(previous)
      toast({ title: "Could not save notification filters", variant: "destructive" })
    } else {
      applyServerProfile({ notification_settings: { ...((user as any)?.notification_settings || {}), muted_types: next } })
    }
    void load()
  }

  const clearAllNotifs = async () => {
    if (
      !(await confirmDialog({
        title: "Clear all notifications?",
        description: "Everything in this list is removed. This cannot be undone.",
        confirmLabel: "Clear all",
        destructive: true,
      }))
    )
      return
    const response = await fetch("/api/notifications?clear_all=true", {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    })
    if (!response.ok) {
      toast({ title: "Could not clear notifications", variant: "destructive" })
      return
    }
    setNotifications([])
    setUnreadCount(0)
    window.dispatchEvent(new Event("loop:notifications-changed"))
  }

  const deleteNotif = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    const response = await fetch(`/api/notifications?id=${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    })
    if (response.ok) void load()
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-muted-foreground">Sign in to see tags and notifications.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-2 py-4 sm:px-4 sm:py-6">
        <div className="overflow-hidden border-border/70 bg-background sm:rounded-2xl sm:border">
          <div className="sticky top-16 z-20 flex items-center justify-between border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
              <p className="text-xs text-muted-foreground">Your Loop, at a glance{unreadCount > 0 ? ` · ${unreadCount} unread` : ""}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => void markAllRead()}>
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Mark read
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => void clearAllNotifs()}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Clear all
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            {/* Pending follow requests */}
            {followRequests.length > 0 && (
              <div className="space-y-2 border-b border-border/70 p-3">
                <div className="flex items-center gap-2 px-1">
                  <UserPlus className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-bold">
                    Follow requests
                    <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {followRequests.length}
                    </span>
                  </p>
                </div>
                {followRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5"
                  >
                    <Link href={`/profile/${request.requester?.username || ""}`} className="shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.requester?.avatar_url || undefined} />
                        <AvatarFallback>{(request.requester?.display_name || "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${request.requester?.username || ""}`} className="text-sm font-semibold hover:underline">
                        {request.requester?.display_name || request.requester?.username || "Someone"}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        @{request.requester?.username || "member"} wants to follow you
                        <span className="ml-1.5">middot {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 rounded-full bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
                        disabled={processingRequest === request.id}
                        onClick={() => void handleFollowRequest(request.id, "accept")}
                      >
                        {processingRequest === request.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        )}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        disabled={processingRequest === request.id}
                        onClick={() => void handleFollowRequest(request.id, "decline")}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <TabsList className="sticky top-[7.5rem] z-10 grid h-auto w-full grid-cols-5 rounded-none border-b border-border/70 bg-background/90 p-0 backdrop-blur-xl">
              <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-amber-500 data-[state=active]:shadow-none">All</TabsTrigger>
              <TabsTrigger value="mentions" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-amber-500 data-[state=active]:shadow-none"><AtSign className="mr-1 h-4 w-4" />Mentions</TabsTrigger>
              <TabsTrigger value="verified" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-amber-500 data-[state=active]:shadow-none"><BadgeCheck className="mr-1 h-4 w-4" />Verified</TabsTrigger>
              <TabsTrigger value="unread" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-amber-500 data-[state=active]:shadow-none">Unread{unreadCount > 0 ? <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 text-[10px] text-amber-500">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</TabsTrigger>
              <TabsTrigger value="tagged" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-amber-500 data-[state=active]:shadow-none">Tagged</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 overflow-x-auto border-b border-border/50 px-3 py-2">
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Mute:</span>
              {["likes", "follows", "replies", "circles", "system"].map((type) => (
                <button key={type} type="button" aria-pressed={mutedTypes.includes(type)} onClick={() => void toggleMutedType(type)} className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize transition-colors", mutedTypes.includes(type) ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground hover:text-foreground")}>{type}</button>
              ))}
            </div>

            <TabsContent value="all" className="mt-0">
              <NotifList items={notifications} loading={loading} onDelete={deleteNotif} onOpen={markRead} />
            </TabsContent>
            <TabsContent value="mentions" className="mt-0">
              <NotifList items={notifications} loading={loading} onDelete={deleteNotif} onOpen={markRead} empty="No mentions yet. When someone mentions you, it appears here." />
            </TabsContent>
            <TabsContent value="verified" className="mt-0">
              <NotifList items={notifications} loading={loading} onDelete={deleteNotif} onOpen={markRead} empty="No notifications from verified accounts yet." />
            </TabsContent>
            <TabsContent value="unread" className="mt-0">
              <NotifList items={notifications} loading={loading} onDelete={deleteNotif} onOpen={markRead} empty="You're all caught up." />
            </TabsContent>
            <TabsContent value="tagged" className="mt-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : mentions.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nobody has tagged you yet. Ask friends to use @yourusername in posts and comments.
                </p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {mentions.map((m) => {
                    const href =
                      m.href ||
                      mentionHref({
                        source: m.source_type as any,
                        loop_id: m.loop_id,
                        circle_id: m.circle_id,
                        post_id: m.post_id,
                        reel_id: m.reel_id,
                        comment_id: m.comment_id,
                      })
                    return (
                      <li key={m.id}>
                        <Link href={href} className="flex gap-3 px-4 py-3 hover:bg-muted/50">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={m.actor?.avatar_url || undefined} />
                            <AvatarFallback>
                              {(m.actor?.display_name || m.actor?.username || "?").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">
                              <span className="font-semibold">
                                {m.actor?.display_name || m.actor?.username || "Someone"}
                              </span>{" "}
                              <span className="text-muted-foreground">{m.why}</span>
                            </p>
                            {m.snippet ? (
                              <p className="mt-1 line-clamp-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                                {m.snippet}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Tasteful sponsored slot (server-gated; never for Pro/Sponsor) */}
        <AdSlot surface="notifications" />
      </main>
    </div>
  )
}

/** Individual notification row with actor PFP + type icon */
function NotifRow({
  n,
  onDelete,
  onOpen,
}: {
  n: Notification
  onDelete?: (id: string) => void
  onOpen?: (id: string) => void
}) {
  const { icon: Icon, color, bg } = notifIcon(n.type)
  const actor = n.actor
  const href = linkForNotification(n)
  // Platform notifications are attributed to Loop and never name an admin;
  // they also carry their own title instead of a post-interaction verb.
  const copy = getNotificationCopy({
    type: n.type,
    title: n.title,
    message: n.message,
    actorName: actor?.display_name || actor?.username || (n as any).actor_name || "",
    groupCount: (n as any).count,
  })

  return (
    <li className="group relative flex items-center justify-between transition-colors hover:bg-muted/30">
      {/* Main tap target (title + message + time). Interactive extras
          (quick reply, delete) live OUTSIDE this anchor — a button nested
          inside an <a> is invalid HTML and makes the click bubble into a
          full navigation, which is what made quick reply "refresh" the app. */}
      <Link
        href={href}
        onClick={() => onOpen?.(n.id)}
        className={cn("min-w-0 flex-1 px-4 py-4", !n.is_read && "bg-amber-500/[0.055]")}
      >
        <div className="flex items-start gap-3">
          {/* Actor avatar with type icon badge */}
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={actor?.avatar_url || undefined} />
              <AvatarFallback>{(actor?.display_name || actor?.username || "?").charAt(0)}</AvatarFallback>
            </Avatar>
            <div className={cn("absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background", bg)}>
              <Icon className={cn("h-2.5 w-2.5", color)} />
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">
                {copy.system
                  ? SYSTEM_SENDER
                  : actor?.display_name || actor?.username || (n as any).actor_name || "A member"}
              </span>
              {" "}
              <span className="text-muted-foreground">
                {cleanText(maskAdminCopy(copy.system ? n.title || n.message || copy.action : n.message || n.title))}
              </span>
            </p>
            {n.count && n.count > 1 ? <span className="ml-1 text-xs font-medium text-muted-foreground">· {n.count}</span> : null}
            {(n.data?.preview || n.data?.snippet || n.data?.content_text) ? (
              <p className="mt-2 line-clamp-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {n.data.preview || n.data.snippet || n.data.content_text}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </p>
          </div>

          {/* Unread indicator */}
          {!n.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.45)]" /> : null}
        </div>
      </Link>

      {/* Quick reply + delete — siblings of the link, not children of it */}
      <div className="absolute inset-y-0 right-10 flex items-center">
        <NotificationQuickReply notification={n} compact />
      </div>
      {onDelete && (
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(n.id)
          }}
          className="mr-2 h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </li>
  )
}

function NotifList({
  items,
  loading,
  empty = "You're all caught up.",
  onDelete,
  onOpen,
}: {
  items: Notification[]
  loading: boolean
  empty?: string
  onDelete?: (id: string) => void
  onOpen?: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    )
  }
  if (!items.length) {
    return <p className="px-4 py-12 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="divide-y divide-border/70">
      {items.map((n) => (
        <NotifRow key={n.id} n={n} onDelete={onDelete} onOpen={onOpen} />
      ))}
    </ul>
  )
}
