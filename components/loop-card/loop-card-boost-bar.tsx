"use client"

import { Rocket, Coins } from "lucide-react"

interface LoopCardBoostBarProps {
  boostCoinsCurrent: number
  boostCoinsTarget: number
  isBoosted: boolean
  onClick: () => void
}

export function LoopCardBoostBar({
  boostCoinsCurrent,
  boostCoinsTarget,
  isBoosted,
  onClick,
}: LoopCardBoostBarProps) {
  if (boostCoinsCurrent <= 0) return null

  const percentage = Math.min(
    100,
    Math.round((boostCoinsCurrent / boostCoinsTarget) * 100)
  )

  return (
    <div
      onClick={onClick}
      className="mt-3 p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-500/20 hover:border-cyan-400/40 cursor-pointer transition-all space-y-1.5"
    >
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 text-[10px] sm:text-[11px] font-bold">
        <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300 tracking-tight">
          <Rocket className="h-3.5 w-3.5 text-cyan-400 animate-pulse shrink-0" />
          {isBoosted ? "BOOSTED IN FEED" : "BOOST PROGRESS"}
        </span>
        <span className="text-amber-300 flex items-center gap-1 font-mono">
          <Coins className="h-3 w-3 shrink-0" /> {boostCoinsCurrent} /{" "}
          {boostCoinsTarget} Coins
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
