"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WifiOff, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-gray-500" />
          </div>
          <CardTitle className="text-2xl font-bold">You're Offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            It looks like you've lost your internet connection. Some features may not be available until you're back
            online.
          </p>

          <div className="space-y-3">
            <Button onClick={handleRetry} className="w-full" variant="default">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>

            <Link href="/" className="block">
              <Button variant="outline" className="w-full bg-transparent">
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </Link>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Available Offline:</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• View cached content</li>
              <li>• Browse your profile</li>
              <li>• Access saved items</li>
              <li>• View offline quests</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
