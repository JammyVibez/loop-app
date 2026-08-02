"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Rocket, Sparkles, Coins, Flame, ChevronRight, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { BoostLoopDialog } from "@/components/loops/boost-loop-dialog"

interface TrendingBoostShelfProps {
  limit?: number
}

export function TrendingBoostShelf({ limit = 6 }: TrendingBoostShelfProps) {
  const [boostedLoops, setBoostedLoops] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [activeLoopForBoost, setActiveLoopForBoost] = useState<any | null>(null)

  const fetchTrendingBoosts = async () => {
    try {
      const res = await fetch(`/api/boosts/trending?limit=${limit}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setBoostedLoops(data.loops || [])
      }
    } catch (err) {
      console.error("Failed to fetch trending boosts:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrendingBoosts()
  }, [limit])

  if (loading || boostedLoops.length === 0) {
    return null
  }

  return (
    <div className="mb-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-slate-900/60 dark:from-cyan-950/40 dark:via-indigo-950/40 dark:to-slate-900/60 light:bg-card light:border-border p-3.5 sm:p-5 border border-cyan-500/20 shadow-xl backdrop-blur-md max-w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20 shrink-0">
            <Rocket className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-foreground dark:text-white flex items-center gap-1.5 tracking-tight">
              Trending Boosts
              <Badge className="bg-amber-500/20 text-amber-500 dark:text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0 font-bold">
                Crowd-Funded
              </Badge>
            </h2>
            <p className="text-[11px] text-muted-foreground dark:text-cyan-200/70">Top community-boosted Loops</p>
          </div>
        </div>

        <span className="text-xs text-muted-foreground dark:text-slate-400 flex items-center gap-1 font-medium ml-auto">
          <Flame className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
          Ranked by coins
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x snap-mandatory touch-pan-x">
        {boostedLoops.map((loop) => {
          const tier = loop.boostInfo?.tier || 1
          const coins = loop.boost_coins_current || loop.boostInfo?.coins || 0
          const author = loop.author || {}
          const tierLabel = tier === 3 ? "Tier 3 · 2k+" : tier === 2 ? "Tier 2 · 500+" : "Tier 1 · 100+"

          return (
            <div
              key={loop.id}
              className="flex-none w-[220px] sm:w-[270px] snap-start rounded-2xl bg-card dark:bg-slate-900/90 border border-cyan-500/30 p-3 shadow-lg flex flex-col justify-between transition-all duration-300 hover:border-cyan-400 hover:shadow-cyan-500/10 hover:-translate-y-0.5 group"
            >
              <div>
                {/* Header info */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 border border-cyan-400/40">
                      <AvatarImage src={author.avatar_url || ""} />
                      <AvatarFallback className="bg-cyan-950 text-[10px] text-cyan-300">
                        {author.display_name?.[0] || author.username?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-semibold text-slate-200 truncate max-w-[110px]">
                      {author.display_name || author.username || "User"}
                    </span>
                  </div>

                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                    <Rocket className="h-3 w-3 text-cyan-400" />
                    {tierLabel}
                  </Badge>
                </div>

                {/* Content text */}
                <Link href={`/loop/${loop.id}`}>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-3 group-hover:text-cyan-100 transition-colors">
                    {loop.content_text || loop.content || "Boosted Loop"}
                  </p>
                </Link>
              </div>

              <div>
                {/* Coin progress */}
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1 text-amber-400">
                    <Coins className="h-3.5 w-3.5" />
                    {coins} Coins Funded
                  </span>
                  <span className="text-cyan-400 text-[10px] font-semibold">Decays over time</span>
                </div>

                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-400 rounded-full"
                    style={{ width: `${Math.min(100, (coins / 2000) * 100)}%` }}
                  />
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveLoopForBoost(loop)}
                  className="w-full h-7 text-xs font-bold rounded-xl border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-500 hover:text-white hover:border-transparent transition-all"
                >
                  <Coins className="h-3 w-3 mr-1 text-amber-400" />
                  Contribute Boost
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {activeLoopForBoost && (
        <BoostLoopDialog
          loopId={activeLoopForBoost.id}
          loopTitle={activeLoopForBoost.content_title || activeLoopForBoost.content_text}
          currentCoins={activeLoopForBoost.boost_coins_current || 0}
          targetCoins={activeLoopForBoost.boost_coins_target || 1000}
          open={Boolean(activeLoopForBoost)}
          onOpenChange={(open) => {
            if (!open) setActiveLoopForBoost(null)
          }}
          onBoostSuccess={() => fetchTrendingBoosts()}
        />
      )}
    </div>
  )
}
