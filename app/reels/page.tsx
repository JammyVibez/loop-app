"use client"

import { useState } from "react"
import { TreeReels } from "@/components/reels/tree-reels"
import { cn } from "@/lib/utils"

const FILTERS = [
  { id: "trending", label: "For You" },
  { id: "following", label: "Following" },
  { id: "recent", label: "Recent" },
]

export default function ReelsPage() {
  const [category, setCategory] = useState("trending")

  return (
    <div className="relative min-h-[100dvh] bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center gap-4 sm:top-16">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setCategory(filter.id)}
            className={cn(
              "pointer-events-auto text-sm font-semibold text-white/60 transition",
              category === filter.id && "text-white underline decoration-2 underline-offset-8",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <TreeReels category={category} />
    </div>
  )
}
