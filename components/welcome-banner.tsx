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
    <Card className="relative overflow-hidden border-white/10 bg-[#0a1020]/85 shadow-2xl shadow-violet-950/20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.2),transparent_50%)]" />
      <CardContent className="relative p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                Welcome back, {user.display_name}!
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 flex items-center flex-wrap gap-1">
                <span>You have</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  <Coins className="w-3 h-3 mr-1 text-amber-400" />
                  {user.loop_coins.toLocaleString()}
                </Badge>
                <span>Loop Coins in your wallet</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10 text-xs sm:text-sm"
              onClick={() => window.location.href = "/shop"}
            >
              <Gift className="w-4 h-4 mr-1.5" />
              Visit Shop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
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
