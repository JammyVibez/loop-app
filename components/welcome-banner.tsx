"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, X, Gift, Coins } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { user } = useAuth()

  if (dismissed || !user) return null

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Welcome back, {user.display_name}! 🎉
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You have{" "}
                <Badge variant="secondary" className="mx-1">
                  <Coins className="w-3 h-3 mr-1" />
                  {user.loop_coins.toLocaleString()}
                </Badge>
                Loop Coins to spend in the shop!
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/shop"}
            >
              <Gift className="w-4 h-4 mr-2" />
              Visit Shop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
