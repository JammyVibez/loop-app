"use client"

import { useState } from "react"
import { TreeReels } from "@/components/reels/tree-reels"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { Clapperboard } from "@/components/icons/lucide-compat"

const FILTERS = [
  { id: "trending", label: "For You" },
  { id: "following", label: "Following" },
  { id: "recent", label: "Recent" },
]

export default function ReelsPage() {
  const { user } = useAuth()
  const [category, setCategory] = useState("trending")
  const filters = user ? [...FILTERS, { id: "mine", label: "My Trees" }] : FILTERS

  return (
    <div className="relative min-h-[100dvh] bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center gap-4 sm:top-16">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setCategory(filter.id)}
            className={cn(
              "pointer-events-auto flex items-center gap-1 text-sm font-semibold text-white/60 transition",
              category === filter.id && "text-white underline decoration-2 underline-offset-8",
            )}
          >
            {filter.id === "mine" && <Clapperboard className="h-3.5 w-3.5" />}
            {filter.label}
          </button>
        ))}
      </div>
      <TreeReels category={category} />
    </div>
  )
}
