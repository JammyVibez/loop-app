"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { SmilePlus } from "lucide-react"

const REACTION_TYPES = [
  { type: "like", emoji: "Heart", label: "Like", color: "text-red-500" },
  { type: "fire", emoji: "Fire", label: "Fire", color: "text-orange-500" },
  { type: "clap", emoji: "Clap", label: "Applause", color: "text-amber-500" },
  { type: "thinking", emoji: "Thinking", label: "Interesting", color: "text-blue-500" },
  { type: "laugh", emoji: "Laugh", label: "Funny", color: "text-yellow-500" },
  { type: "rocket", emoji: "Rocket", label: "Awesome", color: "text-emerald-500" },
]

import {
  Heart,
  Flame,
  HandMetal,
  Brain,
  Laugh,
  Rocket,
} from "lucide-react"

const ICON_MAP: Record<string, typeof Heart> = {
  like: Heart,
  fire: Flame,
  clap: HandMetal,
  thinking: Brain,
  laugh: Laugh,
  rocket: Rocket,
}

interface Reaction {
  type: string
  count: number
  reacted: boolean
}

interface PostReactionsProps {
  postId: number
  reactions: Reaction[]
  onReact: (postId: number, type: string) => void
  isMember: boolean
}

export function PostReactions({ postId, reactions, onReact, isMember }: PostReactionsProps) {
  const [open, setOpen] = useState(false)

  const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0)
  const topReactions = reactions.filter((r) => r.count > 0).sort((a, b) => b.count - a.count).slice(0, 3)

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {topReactions.map((r) => {
        const Icon = ICON_MAP[r.type] || Heart
        return (
          <button
            key={r.type}
            onClick={() => isMember && onReact(postId, r.type)}
            disabled={!isMember}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition active:scale-95",
              r.reacted
                ? "bg-primary/10 text-primary ring-primary/30"
                : "bg-foreground/[0.05] text-muted-foreground ring-border/40 hover:text-foreground",
            )}
          >
            <Icon className={cn("h-3 w-3", r.reacted && "fill-current")} />
            {r.count}
          </button>
        )
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 rounded-full"
            disabled={!isMember}
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2 rounded-xl">
          <div className="flex gap-1">
            {REACTION_TYPES.map((r) => {
              const Icon = ICON_MAP[r.type] || Heart
              const existing = reactions.find((rx) => rx.type === r.type)
              return (
                <button
                  key={r.type}
                  onClick={() => {
                    onReact(postId, r.type)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-muted",
                    existing?.reacted && "bg-primary/10",
                  )}
                  title={r.label}
                >
                  <Icon className={cn("h-4 w-4", existing?.reacted ? "text-primary fill-current" : "text-muted-foreground")} />
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
