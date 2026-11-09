"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Rocket, Coins, Flame } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { BoostLoopDialog } from "@/components/loops/boost-loop-dialog"

interface TrendingBoostShelfProps {
  limit?: number
}

export function TrendingBoostShelf({ limit = 6 }: TrendingBoostShelfProps) {
  const [boostedLoops, setBoostedLoops] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [activeLoopForBoost, setActiveLoopForBoost] = useState<any | null>(null)

  const fetchTrendingBoosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/boosts/trending?limit=${limit}`, { cache: "no-store" })
      const data = await res.json()
      if (res.ok && data.success) setBoostedLoops(data.loops || [])
      else setBoostedLoops([])
    } catch (err) {
      console.error("Failed to fetch trending boosts:", err)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void fetchTrendingBoosts()
  }, [fetchTrendingBoosts])

  if (loading || boostedLoops.length === 0) {
    return null
  }

  return (
    <div className="mb-6 max-w-full overflow-hidden rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
              Trending Boosts
              <Badge variant="secondary" className="px-2 py-0 text-[10px] font-medium">
                Crowd-Funded
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">Community-backed Loops gaining momentum</p>
          </div>
        </div>

        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
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
              className="group flex w-[250px] flex-none snap-start flex-col justify-between rounded-2xl border border-border/70 bg-background/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md sm:w-[280px]"
            >
              <div>
                {/* Header info */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <VideoAvatar
                      src={author.avatar_url}
                      videoSrc={(author as any).video_avatar_url}
                      alt={author.display_name || author.username}
                      fallback={author.display_name?.[0] || author.username?.[0] || "U"}
                      size="sm"
                    />
                    <span className="max-w-[120px] truncate text-xs font-medium text-foreground">
                      {author.display_name || author.username || "User"}
                    </span>
                  </div>

                  <Badge variant="outline" className="flex items-center gap-1 border-primary/25 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <Rocket className="h-3 w-3" />
                    {tierLabel}
                  </Badge>
                </div>

                {/* Content text */}
                <Link href={`/loop/${loop.id}`}>
                  <p className="mb-4 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground transition-colors group-hover:text-foreground">
                    {loop.content_text || loop.content || "Boosted Loop"}
                  </p>
                </Link>
              </div>

              <div>
                {/* Coin progress */}
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Coins className="h-3.5 w-3.5" />
                    {coins} Coins Funded
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">Community funded</span>
                </div>

                <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (coins / 2000) * 100)}%` }}
                  />
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveLoopForBoost(loop)}
                  className="h-9 w-full rounded-xl border-border text-xs font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
                >
                  <Coins className="mr-1.5 h-3.5 w-3.5 text-primary" />
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
