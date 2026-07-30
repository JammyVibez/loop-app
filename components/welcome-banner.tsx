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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.18),transparent_38%)]" />
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/25">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Welcome back, {user.display_name}! 🎉
              </h3>
              <p className="text-slate-400">
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
              className="rounded-full border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10"
              onClick={() => window.location.href = "/shop"}
            >
              <Gift className="w-4 h-4 mr-2" />
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
