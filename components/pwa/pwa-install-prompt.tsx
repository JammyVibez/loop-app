"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Download, Smartphone, Zap, Wifi, Bell, ShoppingBag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      const isIOSStandalone = (window.navigator as any).standalone === true
      setIsStandalone(isStandaloneMode || isIOSStandalone)
      setIsInstalled(isStandaloneMode || isIOSStandalone)
    }

    // Check if iOS
    const checkIfIOS = () => {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
      setIsIOS(isIOSDevice)
    }

    checkIfInstalled()
    checkIfIOS()
    setIsDismissed(sessionStorage.getItem('pwa-prompt-dismissed') === 'true')

    const fallbackTimer = window.setTimeout(() => {
      const dismissed = sessionStorage.getItem('pwa-prompt-dismissed') === 'true'
      const standaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
      const mobileLike = /Android|iPad|iPhone|iPod/i.test(navigator.userAgent)

      if (!dismissed && !standaloneMode && mobileLike) {
        setShowInstallPrompt(true)
      }
    }, 3500)

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Show install prompt after a delay if not already installed
      if (!isInstalled) {
        setTimeout(() => {
          setShowInstallPrompt(true)
        }, 3000)
      }
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      toast({
        title: "App Installed! 🎉",
        description: "Loop has been installed on your device. You can now access it from your home screen!",
      })
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isInstalled, toast])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        toast({
          title: "Installing Loop...",
          description: "The app is being installed on your device.",
        })
      }
      
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    } catch (error) {
      console.error('Error installing PWA:', error)
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
    sessionStorage.setItem('pwa-prompt-dismissed', 'true')
  }

  // Don't show if already installed or dismissed
  if (isInstalled || !showInstallPrompt || isDismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="overflow-hidden border-white/10 bg-[#0a1020]/95 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Install Loop App</CardTitle>
                <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                  Free & Fast
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <CardDescription className="text-sm text-slate-300">
            Add Loop to your phone home screen for a fast app-like experience today. Native Play Store release is coming soon.
          </CardDescription>

          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-3 text-xs text-cyan-100">
            <div className="flex items-center gap-2 font-medium">
              <ShoppingBag className="h-4 w-4" />
              Play Store coming soon
            </div>
            <p className="mt-1 text-cyan-100/75">
              Until then, install Loop directly from your browser as a PWA.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>Lightning Fast</span>
            </div>
            <div className="flex items-center space-x-2">
              <Wifi className="w-4 h-4 text-blue-500" />
              <span>Works Offline</span>
            </div>
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-green-500" />
              <span>Push Notifications</span>
            </div>
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-purple-500" />
              <span>Home Screen</span>
            </div>
          </div>

          {/* Install Instructions */}
          {isIOS ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
              <p className="font-medium text-cyan-100 mb-1">
                To install on iOS:
              </p>
              <ol className="text-slate-300 space-y-1 text-xs">
                <li>1. Tap the Share button in Safari</li>
                <li>2. Scroll down and tap "Add to Home Screen"</li>
                <li>3. Tap "Add" to install Loop</li>
              </ol>
            </div>
          ) : (
            <div className="flex space-x-2">
              <Button
                onClick={handleInstallClick}
                className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-600/25 hover:from-violet-500 hover:to-cyan-400"
                disabled={!deferredPrompt}
              >
                <Download className="w-4 h-4 mr-2" />
                Install Now
              </Button>
              <Button variant="outline" onClick={handleDismiss} className="rounded-full border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10">
                Later
              </Button>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">
            Free forever • Install from browser now • Play Store coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
