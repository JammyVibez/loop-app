"use client"

import { useCallback } from "react"
import { Gift } from "@/components/icons/lucide-compat"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GiftPanel, type GiftPanelContext } from "@/components/gifting/gift-panel"
import {
  GiftCelebration,
  useGiftCelebration,
  type GiftSendEvent,
} from "@/components/gifting/gift-celebration"

interface GiftModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipient: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    video_avatar_url?: string | null
    is_premium?: boolean
  }
  context?: GiftPanelContext
  /** Fired optimistically so the host can start the animation immediately. */
  onGiftQueued?: (event: GiftSendEvent) => void
  onGiftSent?: (gift: {
    id: string
    name: string
    cost: number
    type: string
    rarity: string
    art?: string | null
    durationMs?: number | null
    palette?: { primary: string; secondary: string; accent?: string } | null
  }) => void
}

/**
 * The app's gift modal is a thin dark shell around the shared GiftPanel.
 * Outside a live room it owns the celebration: Send closes the sheet and plays
 * the same queued full-screen effect the Channel page uses.
 */
export function GiftModal({
  open,
  onOpenChange,
  recipient,
  context,
  onGiftQueued,
  onGiftSent,
}: GiftModalProps) {
  const { current, queue, enqueue, finish } = useGiftCelebration()

  const handleQueued = useCallback(
    (event: GiftSendEvent) => {
      enqueue(event)
      onGiftQueued?.(event)
      // The animation is the confirmation surface; don't leave the sheet open.
      onOpenChange(false)
    },
    [enqueue, onGiftQueued, onOpenChange],
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          scrollable={false}
          className="max-h-[85dvh] w-[calc(100vw-1rem)] max-w-[460px] overflow-hidden rounded-2xl border-border bg-card text-card-foreground shadow-2xl sm:w-[min(96vw,460px)] sm:rounded-2xl"
          // The shared DialogContent is a padded CSS grid. Tailwind's `flex`,
          // `p-0` and `gap-0` lose to those base utilities, so the panel was
          // clipped instead of scrolling. Set the layout explicitly and cap it
          // with dvh so mobile browser chrome / the keyboard can shrink it.
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 0,
            gap: 0,
            height: "min(85dvh, 720px)",
            maxHeight: "85dvh",
          }}
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-black tracking-tight text-card-foreground">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/25">
                <Gift className="h-4 w-4 text-primary" />
              </span>
              Send a gift
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              Pick a gift, add a note, and it plays live for everyone.
            </DialogDescription>
          </DialogHeader>

          {/* The panel owns its internal scroll (grid + fixed footer), so it must
              flex to the remaining height instead of a fixed dvh box that gets
              clipped once the mobile keyboard opens. */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <GiftPanel
              recipient={recipient}
              context={context}
              onGiftQueued={handleQueued}
              onGiftSent={onGiftSent}
              className="h-full"
            />
          </div>
        </DialogContent>
      </Dialog>

      {current ? (
        <GiftCelebration
          key={current.key}
          event={current}
          queued={queue.length}
          muted
          onDone={finish}
        />
      ) : null}
    </>
  )
}
