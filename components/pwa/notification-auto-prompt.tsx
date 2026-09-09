"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Bell, X } from "lucide-react"
import {
  ensureServiceWorker,
  subscribeToPush,
  subscriptionToJSON,
} from "@/lib/push-client"

/**
 * Automatically prompts users to enable push notifications on their first
 * visit after login. Shows a non-intrusive bottom banner. Once the user
 * enables or dismisses, it never shows again (state saved in notification_settings).
 */
export function NotificationAutoPrompt() {
  const { user, getAuthHeader, applyServerProfile } = useAuth()
  const { toast } = useToast()
  const [show, setShow] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return

    // Already granted or denied — nothing to prompt
    if (Notification.permission !== "default") return

    // Already dismissed or enabled before — check localStorage + DB settings
    if (localStorage.getItem("notif-prompt-dismissed") === "true") return
    const settings = (user as any)?.notification_settings || {}
    if (settings.push_prompt_dismissed || settings.push_prompt_enabled) return

    // Small delay so it doesn't compete with page load
    const timer = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(timer)
  }, [user?.id])

  const handleEnable = async () => {
    setEnabling(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === "granted") {
        await ensureServiceWorker()
        const subscription = await subscribeToPush()
        if (subscription) {
          const payload = subscriptionToJSON(subscription)
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify(payload),
          })
        }
        // Mark as enabled in notification_settings
        const nextSettings = {
          ...(user as any)?.notification_settings || {},
          push: true,
          push_notifications: true,
          push_prompt_enabled: true,
          push_prompt_dismissed: false,
        }
        await fetch("/api/users/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ notification_settings: nextSettings }),
        })
        applyServerProfile?.({ notification_settings: nextSettings })
        toast({
          title: "Notifications enabled",
          description: "You'll get alerts for likes, comments, messages, and more.",
        })
      }
    } catch (err) {
      console.warn("Auto notification prompt failed:", err)
    } finally {
      setEnabling(false)
      setShow(false)
    }
  }

  const handleDismiss = async () => {
    setShow(false)
    // Persist locally so it never re-shows even if DB write fails
    localStorage.setItem("notif-prompt-dismissed", "true")
    try {
      const nextSettings = {
        ...(user as any)?.notification_settings || {},
        push_prompt_dismissed: true,
      }
      await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ notification_settings: nextSettings }),
      })
      applyServerProfile?.({ notification_settings: nextSettings })
    } catch {
      // Best effort — even if save fails, the UI is dismissed
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-2xl border border-border bg-card shadow-2xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Stay in the loop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified about likes, comments, messages, and Co-Loop invites.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={enabling}
            className="h-8 px-3 text-xs font-semibold rounded-lg"
          >
            {enabling ? "Enabling..." : "Enable"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 p-0 rounded-lg"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
