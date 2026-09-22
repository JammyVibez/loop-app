"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { persistFeatureTourSeen, resetFeatureTourLocally } from "@/lib/feature-tour"
import {
  Info,
  FileText,
  ShieldCheck,
  HeartHandshake,
  Smartphone,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Compass,
} from "lucide-react"

const APP_VERSION = "0.1.0"

export function AboutSettings() {
  const { user, getAuthHeader } = useAuth()
  const router = useRouter()
  const [deviceInfo, setDeviceInfo] = useState("")
  const [pwaMode, setPwaMode] = useState(false)
  const [replayingTour, setReplayingTour] = useState(false)

  /** Clear the seen flag so the on-feed coach-mark tour plays again. */
  const replayTour = async () => {
    setReplayingTour(true)
    resetFeatureTourLocally()
    await persistFeatureTourSeen(false, getAuthHeader())
    router.push("/")
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const ua = navigator.userAgent
    const browser =
      ua.includes("Firefox")
        ? "Firefox"
        : ua.includes("Edg/")
          ? "Edge"
          : ua.includes("Chrome")
            ? "Chrome"
            : ua.includes("Safari")
              ? "Safari"
              : "Browser"
    const os = ua.includes("Android")
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : ua.includes("Mac")
          ? "macOS"
          : ua.includes("Win")
            ? "Windows"
            : ua.includes("Linux")
              ? "Linux"
              : "Unknown OS"
    setDeviceInfo(`${os} · ${browser}`)
    setPwaMode(window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true)
  }, [])

  const checkForUpdates = () => {
    if (typeof window === "undefined") return
    // Ask the service worker to check for a new version and reload into it.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update()
        setTimeout(() => window.location.reload(), 800)
      })
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            About Loop
          </CardTitle>
          <CardDescription>Loop is a social platform for sharing loops, communities, reels, and more.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Version</p>
              <p className="mt-0.5 text-lg font-bold">v{APP_VERSION}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in as</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{user?.display_name || "Guest"}</p>
              {user?.is_premium && (
                <Badge className="mt-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Premium member
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={checkForUpdates}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Check for updates
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={replayTour}
              disabled={replayingTour}
            >
              <Compass className="mr-1.5 h-3.5 w-3.5" />
              {replayingTour ? "Starting tour…" : "Replay the tour"}
            </Button>
            <Badge variant={pwaMode ? "default" : "secondary"}>
              {pwaMode ? "Installed app" : "Running in browser"}
            </Badge>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Smartphone className="h-3.5 w-3.5" /> Device
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {deviceInfo || "Detecting…"}
              {pwaMode ? " · installed as app" : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Get the native experience — see the <Link href="/download" className="text-primary hover:underline">download page</Link>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Community & support</CardTitle>
          <CardDescription>Policies, help, and ways to reach the team.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {[
            { href: "/help", icon: Info, label: "Help center", desc: "Guides and FAQs" },
            { href: "/support", icon: MessageCircle, label: "Support chat", desc: "Talk to the team" },
            { href: "/terms", icon: FileText, label: "Terms of service", desc: "The rules of the road" },
            { href: "/privacy", icon: ShieldCheck, label: "Privacy policy", desc: "How your data is handled" },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition hover:bg-muted/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="truncate text-xs text-muted-foreground">{desc}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <HeartHandshake className="h-3.5 w-3.5" />
            Built with care for the Loop community. Status and platform health live on the{" "}
            <Link href="/status" className="text-primary hover:underline">status page</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
