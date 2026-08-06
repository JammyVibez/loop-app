"use client"

import Link from "next/link"
import { Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { TaggedCircle } from "@/lib/circle-limits"
import { cn } from "@/lib/utils"

export function BioCommunityTags({
  tags,
  className,
}: {
  tags?: TaggedCircle[] | null
  className?: string
}) {
  const list = Array.isArray(tags) ? tags.filter((t) => t?.id && t?.name) : []
  if (list.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {list.map((tag) => (
        <Link
          key={tag.id}
          href={`/circles/${tag.id}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <Avatar className="h-4 w-4">
            <AvatarImage src={tag.avatar_url || undefined} alt="" />
            <AvatarFallback className="text-[8px]">
              <Users className="h-2.5 w-2.5" />
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{tag.name}</span>
        </Link>
      ))}
    </div>
  )
}
