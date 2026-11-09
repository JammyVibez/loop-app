"use client"

import { useCallback } from "react"
import { Gift } from "lucide-react"
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
        <DialogContent className="max-h-[92dvh] w-[min(96vw,460px)] overflow-hidden border-white/10 bg-[#080910] p-0 text-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]">
          <DialogHeader className="border-b border-white/10 px-4 py-3 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-black tracking-tight text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-rose-500/30 ring-1 ring-white/15">
                <Gift className="h-4 w-4 text-violet-200" />
              </span>
              Send a gift
            </DialogTitle>
            <DialogDescription className="text-[11px] text-white/45">
              Pick a gift, add a note, and it plays live for everyone.
            </DialogDescription>
          </DialogHeader>

          <div className="h-[min(76dvh,660px)]">
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
