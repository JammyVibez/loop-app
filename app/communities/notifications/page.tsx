"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, ChevronRight, Loader2, MessageSquare } from "lucide-react"
import { Header } from "@/components/header"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

type Notification = {
  id: string
  type?: string | null
  title?: string | null
  message?: string | null
  action_url?: string | null
  is_read?: boolean
  read_at?: string | null
  created_at?: string | null
  data?: Record<string, any> | null
}

/** Everything a community can tell you about, in one place. */
const COMMUNITY_TYPES = [
  "circle_",
  "community_",
  "circle_post",
  "circle_join",
  "circle_invite",
  "circle_event",
]

const isCommunityNotification = (n: Notification) => {
  const type = String(n.type || "")
  if (COMMUNITY_TYPES.some((prefix) => type.startsWith(prefix))) return true
  return Boolean(n.data && (n.data.circle_id || n.data.community_id))
}

function timeAgo(value?: string | null) {
  if (!value) return ""
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function CommunityNotificationsPage() {
  const { user, getAuthHeader, loading } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Notification[]>([])
  const [busy, setBusy] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setBusy(false)
      return
    }
    try {
      const res = await fetch("/api/notifications?limit=60", { headers: getAuthHeader() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not load notifications")
      const all: Notification[] = Array.isArray(json.notifications) ? json.notifications : []
      setItems(all.filter(isCommunityNotification))
    } catch (e: any) {
      toast({ title: "Could not load", description: e.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [user, getAuthHeader, toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-400">
            <Bell className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-xl font-black tracking-tight">Community activity</h1>
            <p className="text-xs text-muted-foreground">Mentions, replies, joins and invites across your worlds.</p>
          </div>
        </div>

        {loading || busy ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !user ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Sign in to see your community notifications.</p>
            <Link
              href="/auth?returnTo=/communities/notifications"
              className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Sign in
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
            <Bell className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">Nothing yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When someone tags you in a thread or replies to your post, it lands here.
            </p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {items.map((item) => {
              const href = item.action_url || "/notifications"
              return (
                <li key={item.id}>
                  <Link href={href} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{item.title || "Community activity"}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                      </span>
                      {item.message && (
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                          {item.message}
                        </span>
                      )}
                    </span>
                    {!item.is_read && !item.read_at && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-400" aria-label="Unread" />
                    )}
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
