"use client"

import Link from "next/link"
import {
  Heart,
  MessageCircle,
  Share,
  Share2,
  Bookmark,
  GitBranch,
  GitFork,
  Rocket,
  Gift,
  Users,
  Lock,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SaveToDevice } from "@/components/download/save-to-device"
import { useAuth } from "@/hooks/use-auth"
import { useLoginGate } from "@/hooks/use-login-gate"
import { isCodeLoop } from "@/lib/pro-features"
import { Spinner } from "@/components/ui/skeletons"

interface LoopCardActionsProps {
  loop: any
  rawLoop: any
  isLiked: boolean
  isSaved: boolean
  likesCount: number
  commentsCount: number
  branchesCount: number
  sharesCount: number
  activeInteracting: string | null
  isAnimating: boolean
  isBoosted: boolean
  boostCoinsCurrent: number
  forking: boolean
  onLike: () => void
  onBookmark: () => void
  onBranch: () => void
  onFork: () => void
  onBoost: () => void
  onGift: () => void
  onShareDmOpen: () => void
  onShareCircleOpen: () => void
  onShareSheetOpen: () => void
  onShareImageOpen: () => void
}

/**
 * X-style action row: one dense line of icon + count pairs directly under the
 * post, muted by default and tinted on hover — no pill backgrounds, no borders
 * and no second meta strip, so a post keeps a single row of chrome. Every Loop
 * action is still here (like, comment, branch, share, boost, gift, fork,
 * bookmark) and the view count lives at the end of the row the way X shows it.
 */
export function LoopCardActions({
  loop,
  rawLoop,
  isLiked,
  isSaved,
  likesCount,
  commentsCount,
  branchesCount,
  sharesCount,
  activeInteracting,
  isAnimating,
  isBoosted,
  boostCoinsCurrent,
  forking,
  onLike,
  onBookmark,
  onBranch,
  onFork,
  onBoost,
  onGift,
  onShareDmOpen,
  onShareCircleOpen,
  onShareSheetOpen,
  onShareImageOpen,
}: LoopCardActionsProps) {
  const { user: currentUser } = useAuth()
  const { requireAuth } = useLoginGate()

  const viewsCount = Number(loop.stats?.views_count || 0)
  const giftsCount = Number(loop.gifts_received || 0)

  // Shared X-like button styling: quiet by default, the hover tint lives on the
  // icon color only (never a filled pill), with a small press-in feedback.
  const action =
    "h-8 rounded-full px-1.5 font-normal text-muted-foreground transition-colors active:scale-[0.97]"

  return (
    <div className="mt-1 flex items-center justify-between gap-1">
      {/* Primary engagement — the counts read as one tight cluster. */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="sm"
          aria-label={isLiked ? "Unlike this loop" : "Like this loop"}
          className={`${action} relative -ml-1.5 gap-1.5 ${
            isLiked ? "text-rose-500" : "hover:text-rose-500"
          }`}
          onClick={onLike}
          disabled={activeInteracting === `${loop.id}-like`}
        >
          {isAnimating && (
            <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-60" />
          )}
          {activeInteracting === `${loop.id}-like` ? (
            <Spinner className="h-[18px] w-[18px]" />
          ) : (
            <Heart className={`h-[18px] w-[18px] transition-transform ${isLiked ? "fill-current scale-105" : ""}`} />
          )}
          <span className="text-[13px] tabular-nums font-medium">{likesCount}</span>
        </Button>

        <Link href={`/loop/${loop.id}`} aria-label="View comments on this loop">
          <Button
            variant="ghost"
            size="sm"
            className={`${action} gap-1.5 hover:text-sky-500`}
          >
            {loop.comments_disabled ? (
              <Lock className="h-[18px] w-[18px] text-amber-500" />
            ) : (
              <MessageCircle className="h-[18px] w-[18px]" />
            )}
            <span className="text-[13px] tabular-nums font-medium">{commentsCount}</span>
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${action} gap-1.5 hover:text-emerald-500`}
              title="Branch / View Chain"
              aria-label="Branch this loop or view the chain"
            >
              <GitBranch className="h-[18px] w-[18px]" />
              <span className="text-[13px] tabular-nums font-medium">{branchesCount}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover border-border text-foreground">
            <DropdownMenuItem onClick={onBranch} className="cursor-pointer hover:bg-muted">
              <GitBranch className="h-4 w-4 mr-2 text-green-400" /> Branch this Loop
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${action} gap-1.5 hover:text-sky-500`}
              title="Share options"
              aria-label="Share this loop"
            >
              <Share className="h-[18px] w-[18px]" />
              <span className="text-[13px] tabular-nums font-medium">{sharesCount}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl bg-card border-border shadow-xl">
            <DropdownMenuItem
              onClick={() => {
                if (!requireAuth("message")) return
                onShareDmOpen()
              }}
              className="cursor-pointer font-medium flex items-center gap-2 py-2 text-xs"
            >
              <MessageCircle className="h-4 w-4 text-violet-500" />
              <span>Send in Direct Message</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!requireAuth("message")) return
                onShareCircleOpen()
              }}
              className="cursor-pointer font-medium flex items-center gap-2 py-2 text-xs"
            >
              <Users className="h-4 w-4 text-emerald-500" />
              <span>Share in a Circle</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onShareSheetOpen}
              className="cursor-pointer flex items-center gap-2 py-2 text-xs"
            >
              <Share className="h-4 w-4 text-blue-500" />
              <span>Share</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onShareImageOpen}
              className="cursor-pointer flex items-center gap-2 py-2 text-xs"
            >
              <Share2 className="h-4 w-4 text-fuchsia-500" />
              <span>Share as image</span>
            </DropdownMenuItem>
            {((loop as any).content_media_url ||
              (loop as any).media_url ||
              ((loop as any).content_metadata?.media_urls as string[] | undefined)?.length) && (
              <DropdownMenuItem asChild className="cursor-pointer py-0">
                <SaveToDevice
                  mediaUrl={
                    (loop as any).content_media_url ||
                    (loop as any).media_url ||
                    ((loop as any).content_metadata?.media_urls as string[] | undefined)?.[0] ||
                    ""
                  }
                  contentType={
                    (loop as any).content_type === "video"
                      ? "video"
                      : (loop as any).content_type === "image"
                      ? "image"
                      : "file"
                  }
                  isPro={Boolean(currentUser?.is_premium)}
                  className="w-full justify-start gap-2 py-2 text-xs h-auto"
                  size="sm"
                />
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Secondary actions + view count, right-aligned like X's analytics slot. */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        {(isCodeLoop(loop) || isCodeLoop(rawLoop)) && currentUser?.id !== loop.author_id && (
          <Button
            variant="ghost"
            size="sm"
            className={`${action} hover:text-violet-500`}
            onClick={onFork}
            disabled={forking}
            title="Fork code"
            aria-label="Fork this code"
          >
            {forking ? <Spinner className="h-[18px] w-[18px]" /> : <GitFork className="h-[18px] w-[18px]" />}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className={`${action} gap-1.5 hover:text-[var(--theme-primary)]`}
          onClick={onBoost}
          title="Boost Loop with Coins"
          aria-label="Boost this loop with coins"
        >
          <Rocket className="h-[18px] w-[18px]" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={`${action} ${giftsCount > 0 ? "gap-1.5" : ""} hover:text-[var(--theme-primary)]`}
          onClick={onGift}
          title="Send a gift"
          aria-label="Send a gift for this loop"
        >
          <Gift className="h-[18px] w-[18px]" />
          {giftsCount > 0 && (
            <span className="text-[13px] tabular-nums font-medium">{giftsCount}</span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={`${action} ${isSaved ? "text-sky-500" : "hover:text-sky-500"}`}
          onClick={onBookmark}
          disabled={activeInteracting === `${loop.id}-save`}
          title="Bookmark"
          aria-label={isSaved ? "Remove bookmark" : "Bookmark this loop"}
        >
          {activeInteracting === `${loop.id}-save` ? (
            <Spinner className="h-[18px] w-[18px]" />
          ) : (
            <Bookmark className={`h-[18px] w-[18px] ${isSaved ? "fill-current" : ""}`} />
          )}
        </Button>

        {/* View count sits last, dimmed, exactly where X places it. */}
        <span
          className="ml-0.5 inline-flex cursor-default items-center gap-1.5 px-1.5 text-muted-foreground"
          title={`${viewsCount.toLocaleString()} views`}
        >
          <BarChart3 className="h-[18px] w-[18px]" />
          <span className="text-[13px] tabular-nums font-medium">
            {viewsCount >= 1000 ? `${(viewsCount / 1000).toFixed(viewsCount >= 10000 ? 0 : 1)}K` : viewsCount}
          </span>
        </span>
      </div>
    </div>
  )
}
