"use client"

import { useState, useEffect, useCallback } from "react"
import { Zap, Users, TrendingUp } from "@/components/icons/lucide-compat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { BoostLoopDialog } from "@/components/loops/boost-loop-dialog"

interface BoostData {
  current: number
  target: number
  tier: string | null
  is_boosted: boolean
  boosted_at: string | null
  contributors: Array<{
    id: string
    coins: number
    user?: { id: string; username: string; display_name: string; avatar_url?: string }
  }>
  contributor_count: number
}

interface LoopDetailBoostBarProps {
  loopId: string
}

export function LoopDetailBoostBar({ loopId }: LoopDetailBoostBarProps) {
  const [boost, setBoost] = useState<BoostData | null>(null)
  const [boostDialogOpen, setBoostDialogOpen] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const loadBoost = useCallback(async () => {
    try {
      const res = await fetch(`/api/loops/${loopId}/boost`)
      if (!res.ok) return
      const data = await res.json()
      setBoost(data.boost || null)
    } catch {
      /* soft-fail */
    }
  }, [loopId])

  useEffect(() => {
    void loadBoost()
  }, [loadBoost])

  if (!boost || (boost.current === 0 && !boost.is_boosted)) return null

  const progress = boost.target > 0 ? Math.min(100, (boost.current / boost.target) * 100) : 0

  const tierColors: Record<string, string> = {
    bronze: "from-amber-600 to-amber-400",
    silver: "from-slate-400 to-slate-200",
    gold: "from-yellow-500 to-yellow-300",
    platinum: "from-cyan-400 to-purple-400",
  }

  return (
    <>
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-yellow-500/10 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-amber-500/20 p-2">
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {boost.is_boosted ? "Crowd-Funded Boost" : "Community Funding"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {boost.contributor_count} supporter{boost.contributor_count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {boost.tier && (
            <Badge
              className={`bg-gradient-to-r ${tierColors[boost.tier] || tierColors.bronze} text-black font-bold text-[10px] px-2 py-0.5`}
            >
              {boost.tier.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 rounded-full bg-black/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="font-semibold text-amber-500">{boost.current.toLocaleString()} coins</span>
            <span>{boost.target.toLocaleString()} target</span>
          </div>
        </div>

        {/* Top contributors */}
        {boost.contributors.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {boost.contributors.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold"
                  title={c.user?.display_name || "Supporter"}
                >
                  {(c.user?.display_name || "?").charAt(0)}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {boost.contributors.length > 5 ? `+${boost.contributors.length - 5} more` : "boosted this"}
            </span>
          </div>
        )}

        {/* Boost button */}
        {user && (
          <Button
            onClick={() => setBoostDialogOpen(true)}
            size="sm"
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs"
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Boost This Loop
          </Button>
        )}
      </div>

      <BoostLoopDialog
        open={boostDialogOpen}
        onOpenChange={setBoostDialogOpen}
        loopId={loopId}
        onBoosted={loadBoost}
      />
    </>
  )
}
