"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  AtSign,
  Bell,
  CheckCheck,
  Coins,
  Gift,
  GitBranch,
  Heart,
  Mail,
  MessageCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/skeletons"
import { useAuth } from "@/hooks/use-auth"
import { useUnreadNotifications } from "@/hooks/use-unread-notifications"
import { cn } from "@/lib/utils"

type Notification = {
  id: string
  type: string
  title: string
  message?: string | null
  action_url?: string | null
  is_read: boolean
  created_at: string
  count?: number
  actor?: {
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
}

const TYPE_ICON: Record<string, { icon: typeof Heart; className: string }> = {
  like: { icon: Heart, className: "bg-rose-500/10 text-rose-500" },
  comment: { icon: MessageCircle, className: "bg-blue-500/10 text-blue-500" },
  reply: { icon: MessageCircle, className: "bg-sky-500/10 text-sky-500" },
  follow: { icon: UserPlus, className: "bg-violet-500/10 text-violet-500" },
  branch: { icon: GitBranch, className: "bg-emerald-500/10 text-emerald-500" },
  mention: { icon: AtSign, className: "bg-amber-500/10 text-amber-500" },
  gift: { icon: Gift, className: "bg-pink-500/10 text-pink-500" },
  message: { icon: Mail, className: "bg-cyan-500/10 text-cyan-500" },
  coins: { icon: Coins, className: "bg-amber-500/10 text-amber-500" },
  live_stream: { icon: Radio, className: "bg-red-500/10 text-red-500" },
  system: { icon: ShieldCheck, className: "bg-emerald-500/10 text-emerald-500" },
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "mentions", label: "Mentions" },
] as const

type Filter = (typeof FILTERS)[number]["id"]

export function NotificationCenterSheet({ className }: { className?: string }) {
  const { user, getAuthHeader } = useAuth()
  const unread = useUnreadNotifications()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [filter, setFilter] = useState<Filter>("all")

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch("/api/notifications?limit=30", {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      if (!res.ok) return
      const json = await res.json().catch(() => ({}))
      setItems(Array.isArray(json.notifications) ? json.notifications : [])
    } catch {
      /* keep whatever is already on screen */
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeader])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const visible = useMemo(() => {
    if (filter === "unread") return items.filter((item) => !item.is_read)
    if (filter === "mentions") return items.filter((item) => item.type === "mention" || item.type === "reply")
    return items
  }, [items, filter])

  const markAll = async () => {
    if (!items.some((item) => !item.is_read)) return
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
    window.dispatchEvent(new Event("loop:notifications-changed"))
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      })
    } catch {
      /* the badge poll will reconcile */
    }
  }

  const openNotification = async (notification: Notification) => {
    setOpen(false)
    if (!notification.is_read) {
      setItems((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
      )
      window.dispatchEvent(new Event("loop:notifications-changed"))
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ notification_id: notification.id }),
        })
      } catch {
        /* non-blocking */
      }
    }
    if (notification.action_url) router.push(notification.action_url)
  }

  if (!user) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
          className={cn(
            "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground transition hover:border-primary/40 hover:text-primary",
            className,
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b border-border/70 px-5 pb-4 pt-5 text-left">
          <div className="flex items-center justify-between gap-3 pr-8">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              Notifications
            </SheetTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
              onClick={markAll}
              disabled={!items.some((item) => !item.is_read)}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          </div>
          <SheetDescription className="text-xs">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </SheetDescription>

          <div className="mt-3 flex gap-1.5">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  filter === option.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {filter === "unread" ? "Nothing unread" : filter === "mentions" ? "No mentions yet" : "No notifications yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Activity on your Loops shows up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {visible.map((item) => {
                const config = TYPE_ICON[item.type] ?? { icon: Bell, className: "bg-muted text-muted-foreground" }
                const Icon = config.icon
                const name = item.actor?.display_name || item.actor?.username

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openNotification(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-muted/50",
                        !item.is_read && "bg-primary/[0.045]",
                      )}
                    >
                      <span className={cn("relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", config.className)}>
                        <Icon className="h-4 w-4" />
                        {item.actor?.avatar_url ? (
                          <Avatar className="absolute -bottom-1 -right-1 h-4 w-4 ring-2 ring-background">
                            <AvatarImage src={item.actor.avatar_url} alt="" />
                            <AvatarFallback className="text-[8px]">{name?.slice(0, 1) ?? "?"}</AvatarFallback>
                          </Avatar>
                        ) : null}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-sm", item.is_read ? "font-medium text-foreground/80" : "font-semibold")}>
                            {item.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                        </span>
                        {item.message ? (
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                            {item.message}
                          </span>
                        ) : null}
                      </span>

                      {!item.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t border-border/70 p-3">
          <Button asChild variant="ghost" className="w-full rounded-xl text-sm" onClick={() => setOpen(false)}>
            <Link href="/notifications">Open the full notification center</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
