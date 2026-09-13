"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AtSign, Bell, CheckCheck, CheckCircle2, Heart, MessageCircle,
  Trash2, UserPlus, XCircle, Gift, Star, Repeat2,
  Shield, Award, TrendingUp, Users, Radio
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Header } from "@/components/header"
import { mentionHref } from "@/lib/mentions-shared"
import { NotificationQuickReply } from "@/components/notifications/notification-quick-reply"
import { AdSlot } from "@/components/ads/ad-slot"
import { Spinner } from "@/components/ui/skeletons"

type Notification = {
  id: string
  type: string
  title: string
  message: string
  data?: any
  is_read: boolean
  created_at: string
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
    case "achievement":
      return { icon: Award, color: "text-yellow-500", bg: "bg-yellow-500/10" }
    case "level_up":
      return { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" }
    case "circle_invite":
    case "circle_joined":
      return { icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" }
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
  const { user, getAuthHeader } = useAuth()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("type") === "mention" || searchParams.get("tab") === "tagged"
    ? searchParams.get("tab") === "tagged"
      ? "tagged"
      : "mentions"
    : "all"
  const [tab, setTab] = useState(initialTab)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [mentions, setMentions] = useState<MentionRow[]>([])
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([])
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const typeQuery = tab === "mentions" ? "&type=mention" : ""
      const [notifRes, mentionRes, followRes] = await Promise.all([
        fetch(`/api/notifications?limit=40${typeQuery}`, {
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
      if (notifRes.ok) setNotifications(notifData.notifications || [])
      if (mentionRes.ok) setMentions(mentionData.mentions || [])
      if (followRes.ok) setFollowRequests(followData.incoming || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [user, tab, getAuthHeader])

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

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ mark_all_read: true }),
    })
    void load()
  }

  const clearAllNotifs = async () => {
    if (!confirm("Are you sure you want to clear all notifications?")) return
    await fetch("/api/notifications?clear_all=true", {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    })
    setNotifications([])
  }

  const deleteNotif = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/notifications?id=${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    })
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
      <main className="mx-auto w-full max-w-xl px-2 sm:px-4 py-4 sm:py-6 space-y-4">
        <div className="border-border/70 bg-background sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div>
              <h1 className="text-xl font-bold">Notifications</h1>
              <p className="text-xs text-muted-foreground">Activity from people you follow</p>
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

            <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b border-border/70 bg-transparent p-0">
              <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-sky-500 data-[state=active]:shadow-none">
                <Bell className="mr-1.5 h-4 w-4" /> All
              </TabsTrigger>
              <TabsTrigger value="mentions" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-sky-500 data-[state=active]:shadow-none">
                <AtSign className="mr-1.5 h-4 w-4" /> Mentions
              </TabsTrigger>
              <TabsTrigger value="tagged" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-sky-500 data-[state=active]:shadow-none">
                Tagged
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <NotifList items={notifications} loading={loading} onDelete={deleteNotif} />
            </TabsContent>
            <TabsContent value="mentions" className="mt-0">
              <NotifList items={notifications} loading={loading} onDelete={deleteNotif} empty="No @tags yet. When someone tags you, it shows up here." />
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
}: {
  n: Notification
  onDelete?: (id: string) => void
}) {
  const { icon: Icon, color, bg } = notifIcon(n.type)
  const actor = n.actor
  const href = linkForNotification(n)

  return (
    <li className="group relative flex items-center justify-between">
      {/* Main tap target (title + message + time). Interactive extras
          (quick reply, delete) live OUTSIDE this anchor — a button nested
          inside an <a> is invalid HTML and makes the click bubble into a
          full navigation, which is what made quick reply "refresh" the app. */}
      <Link
        href={href}
        className={cn("min-w-0 flex-1 px-4 py-3 hover:bg-muted/50", !n.is_read && "bg-sky-500/5")}
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
                {actor?.display_name || actor?.username || "Someone"}
              </span>
              {" "}
              <span className="text-muted-foreground">
                {cleanText(n.message || n.title)}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </p>
          </div>

          {/* Unread indicator */}
          {!n.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" /> : null}
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
}: {
  items: Notification[]
  loading: boolean
  empty?: string
  onDelete?: (id: string) => void
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
        <NotifRow key={n.id} n={n} onDelete={onDelete} />
      ))}
    </ul>
  )
}
