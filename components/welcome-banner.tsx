"use client"

import { useState } from "react"
import { X, Sparkles } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import { useAuth } from "../providers/auth-provider"

export function WelcomeBanner() {
  const { user } = useAuth()
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible || !user) return null

  return (
    <Card className="bg-gradient-to-r from-purple-500 to-blue-600 text-white border-0 relative overflow-hidden">
      <CardContent className="p-6">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 text-white hover:bg-white/20"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/20 rounded-full">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Welcome back, {user.display_name}!</h2>
            <p className="text-white/90">You have {user.loop_coins} Loop Coins. Ready to create something amazing?</p>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full"></div>
        <div className="absolute -right-5 -bottom-5 w-20 h-20 bg-white/5 rounded-full"></div>
      </CardContent>
    </Card>
  )
}
