"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PostAnalyticsPanel } from "@/components/analytics/post-analytics-panel"

/**
 * Author analytics sheet, opened from a feed card or a profile tile.
 * The same panel renders inline on the post page, so numbers agree everywhere.
 */
export function PostAnalyticsDialog({
  loopId,
  open,
  onOpenChange,
}: {
  loopId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl gap-4 overflow-y-auto rounded-2xl p-5 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold tracking-tight">Post analytics</DialogTitle>
          <DialogDescription className="text-xs">
            Reach, engagement and where this post&apos;s readers came from. Only you and Loop staff can see this.
          </DialogDescription>
        </DialogHeader>
        {open ? <PostAnalyticsPanel loopId={loopId} /> : null}
      </DialogContent>
    </Dialog>
  )
}
