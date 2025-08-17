"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Download, Smartphone, Zap, Wifi, Bell } from "lucide-react"
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
    // Don't show again for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true')
  }

  // Don't show if already installed or dismissed
  if (isInstalled || !showInstallPrompt || sessionStorage.getItem('pwa-prompt-dismissed')) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Install Loop App</CardTitle>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Free & Fast
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <CardDescription className="text-sm">
            Get the full Loop experience with our mobile app! Enjoy faster loading, offline access, and push notifications.
          </CardDescription>

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
              <span>No App Store</span>
            </div>
          </div>

          {/* Install Instructions */}
          {isIOS ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                To install on iOS:
              </p>
              <ol className="text-blue-700 dark:text-blue-300 space-y-1 text-xs">
                <li>1. Tap the Share button in Safari</li>
                <li>2. Scroll down and tap "Add to Home Screen"</li>
                <li>3. Tap "Add" to install Loop</li>
              </ol>
            </div>
          ) : (
            <div className="flex space-x-2">
              <Button
                onClick={handleInstallClick}
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                disabled={!deferredPrompt}
              >
                <Download className="w-4 h-4 mr-2" />
                Install Now
              </Button>
              <Button variant="outline" onClick={handleDismiss}>
                Later
              </Button>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center">
            Free forever • No app store required • Install in seconds
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
