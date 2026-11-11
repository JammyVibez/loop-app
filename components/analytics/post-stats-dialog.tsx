"use client"

import { Bookmark, Eye, GitBranch, Heart, MessageCircle, Share2, TrendingUp } from "@/components/icons/lucide-compat"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatTile } from "@/components/ui/page-header"
import { compactNumber } from "@/components/analytics/post-analytics-panel"

export interface PublicPostStats {
  views: number
  likes: number
  comments: number
  branches: number
  shares: number
  saves: number
}

/**
 * Public post stats.
 *
 * Everyone can see how a post is doing — that is part of reading Loop. The
 * deeper breakdown (reach timeline, surfaces, follower split) stays with the
 * author, so this sheet shows counts and an engagement rate only.
 */
export function PostStatsDialog({
  open,
  onOpenChange,
  stats,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stats: PublicPostStats
}) {
  const engagements = stats.likes + stats.comments + stats.branches + stats.shares + stats.saves
  const rate = stats.views > 0 ? Number(((engagements / stats.views) * 100).toFixed(1)) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 rounded-2xl p-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold tracking-tight">Post stats</DialogTitle>
          <DialogDescription className="text-xs">
            How this Loop is doing across the feed, Trees and shares.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Views" value={compactNumber(stats.views)} icon={Eye} />
          <StatTile label="Engagement" value={`${rate}%`} hint={`${compactNumber(engagements)} interactions`} icon={TrendingUp} />
          <StatTile label="Likes" value={compactNumber(stats.likes)} icon={Heart} />
          <StatTile label="Comments" value={compactNumber(stats.comments)} icon={MessageCircle} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="tabular-nums text-foreground">{compactNumber(stats.branches)}</span> Trees
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            <span className="tabular-nums text-foreground">{compactNumber(stats.shares)}</span> shares
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            <span className="tabular-nums text-foreground">{compactNumber(stats.saves)}</span> bookmarks
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Reach timeline, traffic sources and follower split are private to the author.
        </p>
      </DialogContent>
    </Dialog>
  )
}
