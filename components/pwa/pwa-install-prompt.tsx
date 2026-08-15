"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Download, Smartphone, Zap, Wifi, Bell, Share2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AppStoreBadge, PlayStoreBadge, detectPlatform, type DevicePlatform } from "@/components/app-download-badges"
import { isNative } from "@/lib/native"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

/**
 * Install experience, platform-aware:
 *  - Inside the Capacitor native app: nothing (the app is already installed).
 *  - Android / iOS phones: native store card (App Store / Google Play), with
 *    the PWA path as a secondary fallback where the browser supports it.
 *  - Desktop: classic PWA install prompt.
 */
export function PWAInstallPrompt() {
  const [platform, setPlatform] = useState<DevicePlatform>("desktop")
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Running inside the Capacitor app — there's nothing to install.
    if (isNative()) return

    const detected = detectPlatform()
    setPlatform(detected)

    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
    setIsInstalled(standaloneMode)
    setIsDismissed(sessionStorage.getItem("pwa-prompt-dismissed") === "true")

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Desktop: the browser supports PWA install — surface the prompt once ready.
      if (detected === "desktop" && !standaloneMode) {
        window.setTimeout(() => setShowInstallPrompt(true), 3000)
      }
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      toast({
        title: "App Installed! 🎉",
        description: "Loop has been installed on your device. You can now access it from your home screen!",
      })
    }

    // Mobile: show the native store card shortly after load (unless already
    // installed or dismissed this session). PWA fallback stays available via
    // beforeinstallprompt on Android Chrome.
    let mobileTimer: number | undefined
    if (detected !== "desktop") {
      mobileTimer = window.setTimeout(() => {
        if (!standaloneMode && sessionStorage.getItem("pwa-prompt-dismissed") !== "true") {
          setShowInstallPrompt(true)
        }
      }, 2500)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      if (mobileTimer !== undefined) window.clearTimeout(mobileTimer)
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [toast])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        toast({
          title: "Installing Loop...",
          description: "The app is being installed on your device.",
        })
      }

      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    } catch (error) {
      console.error("Error installing PWA:", error)
      toast({
        title: "Installation Error",
        description: "There was an error installing the app. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    setIsDismissed(true)
    // Don't show again for this session
    sessionStorage.setItem("pwa-prompt-dismissed", "true")
  }

  // Don't show if already installed, dismissed, or inside the native app
  if (isInstalled || !showInstallPrompt || isDismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-[26rem]">
      <Card className="overflow-hidden border-border bg-card/95 text-foreground shadow-2xl shadow-black/40 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/25">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Get the Loop app</CardTitle>
                <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">Free</Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {platform === "android" ? (
            <>
              <CardDescription className="text-sm text-muted-foreground">
                Loop for Android is almost here. Grab it on Google Play once it&apos;s live — or keep using the
                browser app today.
              </CardDescription>
              <PlayStoreBadge />
              {deferredPrompt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInstallClick}
                  className="rounded-full border-border bg-muted text-foreground hover:bg-muted/70"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Or install from browser
                </Button>
              )}
            </>
          ) : platform === "ios" ? (
            <>
              <CardDescription className="text-sm text-muted-foreground">
                Loop for iPhone &amp; iPad is on the way. Download it on the App Store once it&apos;s live.
              </CardDescription>
              <AppStoreBadge />
              <div className="rounded-2xl border border-border bg-muted p-3 text-sm">
                <p className="mb-1 font-medium text-foreground">Want it right now?</p>
                <ol className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span>1.</span>
                    <span className="flex items-center gap-1">
                      Tap the Share <Share2 className="h-3 w-3" /> button in Safari
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span>2.</span>
                    <span>Scroll down and tap &quot;Add to Home Screen&quot;</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span>3.</span>
                    <span>Tap &quot;Add&quot; to install Loop</span>
                  </li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <CardDescription className="text-sm text-muted-foreground">
                Add Loop to your home screen for a fast, app-like experience — or grab the native app from the
                stores when they land.
              </CardDescription>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>Lightning Fast</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Wifi className="h-4 w-4 text-blue-500" />
                  <span>Works Offline</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-green-500" />
                  <span>Push Notifications</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Download className="h-4 w-4 text-purple-500" />
                  <span>Home Screen</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleInstallClick}
                  className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-600/25 hover:from-violet-500 hover:to-cyan-400"
                  disabled={!deferredPrompt}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Install Now
                </Button>
                <Button variant="outline" onClick={handleDismiss} className="rounded-full border-border bg-muted text-foreground hover:bg-muted/70">
                  Later
                </Button>
              </div>

              {!deferredPrompt && (
                <p className="text-center text-xs text-muted-foreground">
                  Your browser will offer the install button automatically — it can take a moment to appear.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
