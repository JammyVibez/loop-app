"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, X, Gift, Coins } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { user } = useAuth()

  if (dismissed || !user) return null

  return (
    <Card className="relative overflow-hidden border-border/60 bg-card/90 shadow-lg">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-cyan-500/10" />
      <CardContent className="relative p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shrink-0 shadow-md">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold truncate">
                Welcome back, {user.display_name}!
              </h3>
              <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-1">
                You have{" "}
                <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
                  <Coins className="w-3 h-3 mr-1 text-yellow-500" />
                  {user.loop_coins.toLocaleString()}
                </Badge>
                coins available.
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs font-medium"
              onClick={() => window.location.href = "/shop"}
            >
              <Gift className="w-3.5 h-3.5 mr-1.5" />
              Visit Shop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground hover:text-foreground h-8 w-8 p-0"
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
