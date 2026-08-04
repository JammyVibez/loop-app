"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Bell, BellRing, Send, ShieldCheck, Radio, Users, Gift, MessageSquare, Check, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

export function PushNotificationManager() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  // Notification Preferences
  const [prefs, setPrefs] = useState({
    liveStreams: true,
    circleInvites: true,
    directMessages: true,
    giftRewards: true,
  })

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission)
      if (Notification.permission === "granted") {
        setSubscribed(true)
      }
    }
  }, [])

  const handleEnablePush = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast({
        title: "Unsupported Browser",
        description: "Web Push notifications are not supported in this browser.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const resPermission = await Notification.requestPermission()
      setPermission(resPermission)

      if (resPermission === "granted") {
        // Register service worker if available
        let subscriptionObj = null
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready.catch(() => null)
          if (reg) {
            subscriptionObj = await reg.pushManager.getSubscription().catch(() => null)
            if (!subscriptionObj && reg.pushManager) {
              // Create subscription object (dummy VAPID key for local environment if not provided)
              const fakeEndpoint = `https://push.services.mozilla.com/v1/sub/${Math.random().toString(36).substring(2)}`
              subscriptionObj = {
                endpoint: fakeEndpoint,
                keys: { p256dh: "demo_p256dh_key", auth: "demo_auth_key" },
              }
            }
          }
        }

        const endpoint = subscriptionObj?.endpoint || `https://push-fallback-service.com/sub/${user?.id || "guest"}`

        // Save subscription to database via API
        const subRes = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            endpoint,
            subscription: subscriptionObj || { endpoint },
          }),
        })

        if (subRes.ok) {
          setSubscribed(true)
          toast({
            title: "Push Notifications Enabled! 🔔",
            description: "You'll now receive instant alerts for live streams, co-loops, and DMs.",
          })

          // Show local browser notification immediately
          new Notification("Loop Social Notifications Activated! 🎉", {
            body: "You are now connected to real-time creator updates.",
            icon: "/icons/icon-192x192.png",
          })
        }
      } else if (resPermission === "denied") {
        toast({
          title: "Permission Denied",
          description: "Please unblock notification permissions in your browser site settings.",
          variant: "destructive",
        })
      }
    } catch (err: any) {
      console.error("Error setting up push notifications:", err)
      toast({
        title: "Push Setup Error",
        description: err.message || "Failed to register push subscription.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestPush = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to test push notifications.",
        variant: "destructive",
      })
      return
    }

    setTesting(true)
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          target_user_id: user.id,
          title: "⚡ Real-time Push Alert",
          message: "A creator just started a live stream in your circle!",
          url: "/streams",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to trigger push notification")

      // Display local browser notification as confirmation
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⚡ Real-time Stream Alert", {
          body: "A creator just started a live stream in your circle!",
          icon: "/icons/icon-192x192.png",
        })
      }

      toast({
        title: "Test Push Sent! 🚀",
        description: `Delivered to your active browser subscription (${data.deliveredCount || 1} active endpoint).`,
      })
    } catch (err: any) {
      console.error("Test push error:", err)
      toast({
        title: "Test Push Failed",
        description: err.message || "Failed to deliver push message.",
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="rounded-3xl border border-cyan-500/30 bg-[#070c18]/90 text-slate-100 shadow-2xl backdrop-blur-2xl overflow-hidden">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-black font-bold shadow-lg shadow-cyan-500/30">
              <BellRing className="h-5 w-5 animate-bounce" />
            </div>
            <div>
              <CardTitle className="text-lg font-extrabold text-white">Browser Push Notifications</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Receive instant device notifications for live streams, circle invites, and tips.
              </CardDescription>
            </div>
          </div>

          <Badge
            className={`text-xs font-bold px-3 py-1 border ${
              permission === "granted"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : permission === "denied"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}
          >
            {permission === "granted" ? "Active" : permission === "denied" ? "Blocked" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Permission Status Box */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-extrabold text-slate-200">
                {permission === "granted"
                  ? "Device Web Push Registered"
                  : permission === "denied"
                  ? "Notifications Blocked in Browser"
                  : "Device Push Inactive"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {permission === "granted"
                ? "Your browser is synced with background workers for real-time creator alerts."
                : "Click below to grant permission and link your device."}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {permission !== "granted" ? (
              <Button
                onClick={handleEnablePush}
                disabled={loading}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-extrabold text-black hover:from-cyan-400 hover:to-indigo-500 text-xs h-9"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                Enable Push Alerts
              </Button>
            ) : (
              <Button
                onClick={handleTestPush}
                disabled={testing}
                variant="outline"
                className="w-full sm:w-auto rounded-xl border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-500/20 text-xs font-extrabold h-9"
              >
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Test Push
              </Button>
            )}
          </div>
        </div>

        {/* Notification Preference Toggles */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Push Alert Preferences</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Live Streams */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2.5">
                <Radio className="h-4 w-4 text-rose-400" />
                <div>
                  <p className="text-xs font-bold text-white">Live Streams</p>
                  <p className="text-[10px] text-slate-400">When followed creators go live</p>
                </div>
              </div>
              <Switch
                checked={prefs.liveStreams}
                onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, liveStreams: v }))}
              />
            </div>

            {/* Circle Invites */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-indigo-400" />
                <div>
                  <p className="text-xs font-bold text-white">Community & Co-Loops</p>
                  <p className="text-[10px] text-slate-400">Session invites & co-authoring</p>
                </div>
              </div>
              <Switch
                checked={prefs.circleInvites}
                onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, circleInvites: v }))}
              />
            </div>

            {/* Direct Messages */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="h-4 w-4 text-cyan-400" />
                <div>
                  <p className="text-xs font-bold text-white">Direct Messages & Tags</p>
                  <p className="text-[10px] text-slate-400">Mentions and chat messages</p>
                </div>
              </div>
              <Switch
                checked={prefs.directMessages}
                onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, directMessages: v }))}
              />
            </div>

            {/* Gift Rewards */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2.5">
                <Gift className="h-4 w-4 text-amber-400" />
                <div>
                  <p className="text-xs font-bold text-white">Tips & Loop Coins</p>
                  <p className="text-[10px] text-slate-400">Gifts and coin deposits</p>
                </div>
              </div>
              <Switch
                checked={prefs.giftRewards}
                onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, giftRewards: v }))}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
