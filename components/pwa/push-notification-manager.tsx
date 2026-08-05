"use client"

import { useEffect, useState } from "react"
import {
  Bell,
  BellOff,
  BellRing,
  Gift,
  Loader2,
  MessageSquare,
  Radio,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  subscribeToPush,
  subscriptionToJSON,
  unsubscribeFromPush,
} from "@/lib/push-client"

type Prefs = {
  liveStreams: boolean
  circleInvites: boolean
  directMessages: boolean
  giftRewards: boolean
  social: boolean
}

const DEFAULT_PREFS: Prefs = {
  liveStreams: true,
  circleInvites: true,
  directMessages: true,
  giftRewards: true,
  social: true,
}

export function PushNotificationManager() {
  const { user, getAuthHeader, applyServerProfile, refreshUser } = useAuth()
  const { toast } = useToast()

  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    setPermission(Notification.permission)

    const boot = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready.catch(() => null)
          const sub = await reg?.pushManager.getSubscription()
          setSubscribed(Boolean(sub) && Notification.permission === "granted")
        }
      } catch {
        setSubscribed(Notification.permission === "granted")
      }
    }
    void boot()
  }, [])

  useEffect(() => {
    const settings = (user as any)?.notification_settings || {}
    setPrefs({
      liveStreams: settings.liveStreams !== false && settings.live_streams !== false,
      circleInvites: settings.circleInvites !== false && settings.circles !== false,
      directMessages: settings.directMessages !== false && settings.messages !== false,
      giftRewards: settings.giftRewards !== false && settings.gifts !== false,
      social: settings.social !== false,
    })
  }, [user])

  const persistPrefs = async (next: Prefs) => {
    if (!user) return
    setSavingPrefs(true)
    setPrefs(next)
    try {
      const notification_settings = {
        ...((user as any).notification_settings || {}),
        push: true,
        push_notifications: true,
        liveStreams: next.liveStreams,
        live_streams: next.liveStreams,
        circleInvites: next.circleInvites,
        circles: next.circleInvites,
        directMessages: next.directMessages,
        direct_messages: next.directMessages,
        messages: next.directMessages,
        giftRewards: next.giftRewards,
        gifts: next.giftRewards,
        social: next.social,
      }
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ notification_settings }),
      })
      if (!res.ok) throw new Error("Failed to save preferences")
      applyServerProfile?.({ notification_settings })
      await refreshUser?.()
    } catch (err: any) {
      toast({
        title: "Could not save preferences",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleEnablePush = async () => {
    if (!user) {
      toast({ title: "Log in required", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const subscription = await subscribeToPush()
      if (!subscription) throw new Error("Browser did not return a push subscription")

      const payload = subscriptionToJSON(subscription)
      const subRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      })
      const data = await subRes.json()
      if (!subRes.ok) throw new Error(data.error || "Failed to save subscription")

      setPermission("granted")
      setSubscribed(true)
      await persistPrefs({ ...prefs })
      toast({
        title: "Push notifications enabled",
        description: "You’ll get alerts even when Loop is in the background.",
      })
    } catch (err: any) {
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "default")
      toast({
        title: "Push setup failed",
        description: err.message || "Could not enable browser push.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDisablePush = async () => {
    if (!user) return
    setLoading(true)
    try {
      const endpoint = await unsubscribeFromPush()
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(endpoint ? { endpoint } : {}),
      })
      setSubscribed(false)
      toast({ title: "Push notifications disabled" })
    } catch (err: any) {
      toast({ title: "Could not disable push", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleTestPush = async () => {
    if (!user) return
    setTesting(true)
    try {
      // Ensure subscription is fresh before testing
      if (!subscribed) await handleEnablePush()

      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          target_user_id: user.id,
          title: "Loop push works",
          message: "This is a real Web Push from Loop.",
          url: "/notifications",
          push_only: true,
          category: "system",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send test push")

      if (!data.deliveredCount) {
        throw new Error(
          data.skipped === "no_subscriptions"
            ? "No device subscription found — enable push first."
            : "Push could not be delivered. Check browser permission and try again.",
        )
      }

      toast({
        title: "Test push sent",
        description: `Delivered to ${data.deliveredCount} device${data.deliveredCount === 1 ? "" : "s"}. Check your system tray if the tab is in the background.`,
      })
    } catch (err: any) {
      toast({
        title: "Test push failed",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500 text-white">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Browser push notifications</CardTitle>
              <CardDescription className="text-xs">
                Real device alerts for lives, messages, gifts, follows, and more.
              </CardDescription>
            </div>
          </div>
          <Badge variant={permission === "granted" && subscribed ? "default" : "secondary"}>
            {permission === "granted" && subscribed
              ? "Active"
              : permission === "denied"
                ? "Blocked"
                : "Off"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold">
                {subscribed ? "This device is subscribed" : "This device is not subscribed"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {permission === "denied"
                ? "Notifications are blocked in your browser site settings."
                : "Enable once — Loop uses the Web Push API + your service worker."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {!subscribed ? (
              <Button onClick={handleEnablePush} disabled={loading || permission === "denied"} className="rounded-xl">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                Enable push
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleTestPush}
                  disabled={testing}
                  variant="outline"
                  className="rounded-xl"
                >
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send test
                </Button>
                <Button onClick={handleDisablePush} disabled={loading} variant="ghost" className="rounded-xl">
                  <BellOff className="mr-2 h-4 w-4" />
                  Disable
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Alert preferences
            </h4>
            {savingPrefs && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PrefRow
              icon={<Radio className="h-4 w-4 text-rose-500" />}
              title="Live streams"
              subtitle="Followed creators go live"
              checked={prefs.liveStreams}
              onChange={(v) => void persistPrefs({ ...prefs, liveStreams: v })}
            />
            <PrefRow
              icon={<Users className="h-4 w-4 text-indigo-500" />}
              title="Communities & Co-Loops"
              subtitle="Invites and collab alerts"
              checked={prefs.circleInvites}
              onChange={(v) => void persistPrefs({ ...prefs, circleInvites: v })}
            />
            <PrefRow
              icon={<MessageSquare className="h-4 w-4 text-sky-500" />}
              title="Messages & mentions"
              subtitle="DMs and @tags"
              checked={prefs.directMessages}
              onChange={(v) => void persistPrefs({ ...prefs, directMessages: v })}
            />
            <PrefRow
              icon={<Gift className="h-4 w-4 text-amber-500" />}
              title="Gifts & coins"
              subtitle="Tips and rewards"
              checked={prefs.giftRewards}
              onChange={(v) => void persistPrefs({ ...prefs, giftRewards: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PrefRow({
  icon,
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-3">
      <div className="flex items-center gap-2.5">
        {icon}
        <div>
          <p className="text-xs font-bold">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
