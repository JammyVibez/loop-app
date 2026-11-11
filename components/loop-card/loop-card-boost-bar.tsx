"use client"

import { Rocket, Coins } from "@/components/icons/lucide-compat"

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
      className="mt-3 cursor-pointer space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-2.5 transition-colors hover:border-primary/40"
    >
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 text-[10px] sm:text-[11px] font-bold">
        <span className="flex items-center gap-1.5 tracking-tight text-primary">
          <Rocket className="h-3.5 w-3.5 shrink-0" />
          {isBoosted ? "BOOSTED IN FEED" : "BOOST PROGRESS"}
        </span>
        <span className="flex items-center gap-1 font-mono text-muted-foreground">
          <Coins className="h-3 w-3 shrink-0 text-primary" /> {boostCoinsCurrent} /{" "}
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
