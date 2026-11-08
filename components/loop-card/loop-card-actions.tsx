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
  Eye,
  MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedIconView } from "@/components/icons/animated/animated-icon-view"
import HeartIcon from "@/components/icons/animated/heart-icon"
import MessageCircleIcon from "@/components/icons/animated/message-circle-icon"
import BookmarkIcon from "@/components/icons/animated/bookmark-icon"
import { AddLoopToCollectionItem } from "@/components/collections/add-loop-to-collection-item"
import SendHorizontalIcon from "@/components/icons/animated/send-horizontal-icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SaveToDevice } from "@/components/download/save-to-device"
import { useAuth } from "@/hooks/use-auth"
import { useLoginGate } from "@/hooks/use-login-gate"
import { isCodeLoop } from "@/lib/pro-features"
import { shouldShowCount } from "@/lib/feed-density"
import { Spinner } from "@/components/ui/skeletons"

interface LoopCardActionsProps {
  loop: any
  rawLoop: any
  isLiked: boolean
  isSaved: boolean
  likesCount: number
  commentsCount: number
  branchesCount: number
  /** Rebranches (quotes) of this post — tracked on loops.quote_count. */
  quotesCount?: number
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
  /** Opens the author's post analytics sheet. */
  onOpenAnalytics?: () => void
  /** Opens post stats — full analytics for the author, public counts for everyone else. */
  onOpenStats?: () => void
}

/**
 * X-density action row.
 *
 * Four actions earn permanent space on a feed card — like, comment, branch and
 * share — because they are what people actually do from the feed, and the
 * secondary weight of a post is what makes a feed feel heavy. Boost, gift,
 * bookmark, fork and the view/analytics count all still work, but they moved
 * behind the overflow menu (and remain on the post-detail view) instead of
 * sitting in the row as five more icons.
 *
 * Counts are only rendered when they're greater than zero, so a fresh post
 * shows four quiet icons rather than "0 0 0 0".
 */
export function LoopCardActions({
  loop,
  rawLoop,
  isLiked,
  isSaved,
  likesCount,
  commentsCount,
  branchesCount,
  quotesCount = 0,
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
  onOpenAnalytics,
  onOpenStats,
}: LoopCardActionsProps) {
  const { user: currentUser } = useAuth()
  const { requireAuth } = useLoginGate()
  const isAuthor = Boolean(currentUser?.id && currentUser.id === loop.author_id)

  const viewsCount = Number(loop.stats?.views_count || 0)
  const engagementCount =
    Number(loop.stats?.views_count || 0) > 0
      ? Math.round(
          ((Number(loop.stats?.likes_count || 0) +
            Number(loop.stats?.comments_count || 0) +
            Number(loop.stats?.shares_count || 0) +
            Number(loop.stats?.saves_count || 0)) /
            Math.max(1, Number(loop.stats?.views_count || 0))) *
            100,
        )
      : null
  const giftsCount = Number(loop.gifts_received || 0)
  const isCode = isCodeLoop(loop) || isCodeLoop(rawLoop)
  const canFork = isCode && currentUser?.id !== loop.author_id
  const mediaUrl =
    (loop as any).content_media_url ||
    (loop as any).media_url ||
    ((loop as any).content_metadata?.media_urls as string[] | undefined)?.[0] ||
    ""

  // Shared X-like button styling: quiet by default, the hover tint lives on the
  // icon color only (never a filled pill), with a small press-in feedback.
  // 44px tap target with a 22px glyph; the row's own gap supplies the rest of
  // the separation so four actions still fit a 360px-wide screen.
  const action =
    "h-11 min-w-11 rounded-full px-1 font-normal text-muted-foreground transition-colors active:scale-[0.97]"
  // `.loop-action-count` is hidden below 361px: four 44px targets plus counts
  // cannot share a 320px row without clipping, and the tap target wins.
  const count = "loop-action-count text-mini tabular-nums font-medium"

  /** Counts only earn space when they're actually non-zero. */
  const Count = ({ value }: { value: unknown }) =>
    shouldShowCount(value) ? <span className={count}>{Number(value)}</span> : null

  return (
    <div data-loop-card-actions="" className="mt-1.5 flex items-center justify-between gap-1">
      {/* Primary engagement — the four things people do from the feed. */}
      <div className="loop-action-row flex min-w-0 items-center sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label={isLiked ? "Unlike this loop" : "Like this loop"}
          className={`${action} relative -ml-2 gap-1.5 ${
            isLiked ? "text-rose-500" : "hover:text-rose-500"
          }`}
          onClick={onLike}
          disabled={activeInteracting === `${loop.id}-like`}
        >
          {isAnimating && (
            <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-60" />
          )}
          {activeInteracting === `${loop.id}-like` ? (
            <Spinner className="h-[22px] w-[22px]" />
          ) : (
            <AnimatedIconView component={HeartIcon} size={22} className={isLiked ? "scale-105" : ""} />
          )}
          <Count value={likesCount} />
        </Button>

        <Link href={`/loop/${loop.id}`} aria-label="View comments on this loop">
          <Button
            variant="ghost"
            size="sm"
            className={`${action} gap-1.5 hover:text-sky-500`}
          >
            {loop.comments_disabled ? (
              <Lock className="h-[22px] w-[22px] text-amber-500" />
            ) : (
              <AnimatedIconView component={MessageCircleIcon} size={22} />
            )}
            <Count value={commentsCount} />
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${action} gap-1.5 hover:text-emerald-500`}
              title={`${branchesCount} branch${branchesCount === 1 ? "" : "es"}${
                quotesCount ? ` · ${quotesCount} rebranch${quotesCount === 1 ? "" : "es"}` : ""
              }`}
              aria-label="Branch this loop or view the chain"
            >
              <GitBranch className="h-[22px] w-[22px]" />
              {/* Rebranches count with branches — a quote is still a rebranch
                  of the original, so the post's stat tracks both. */}
              <Count value={Number(branchesCount) + Number(quotesCount)} />
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
              <AnimatedIconView component={SendHorizontalIcon} size={22} />
              <Count value={sharesCount} />
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
              <span>Share to community</span>
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
            {mediaUrl && (
              <DropdownMenuItem asChild className="cursor-pointer py-0">
                <SaveToDevice
                  mediaUrl={mediaUrl}
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

      {/* Compact stats: reach on the right, actions on the left. Tapping the
          view count opens analytics for the author and the public stat sheet
          for everyone else. */}
      <div className="flex shrink-0 items-center gap-0.5">
        {shouldShowCount(viewsCount) && (
          <button
            type="button"
            onClick={onOpenStats}
            className="inline-flex h-11 items-center gap-1 rounded-full px-1 text-mini font-medium tabular-nums text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground"
            title={
              isAuthor
                ? `${viewsCount.toLocaleString()} views · open analytics`
                : `${viewsCount.toLocaleString()} views · engagement ${engagementCount ?? 0}%`
            }
            aria-label={isAuthor ? "Open post analytics" : "View post stats"}
          >
            <Eye className="h-[18px] w-[18px]" aria-hidden />
            {viewsCount >= 1000 ? `${(viewsCount / 1000).toFixed(viewsCount >= 10_000 ? 0 : 1)}K` : viewsCount}
            {isAuthor && engagementCount !== null ? (
              <span className="ml-0.5 hidden text-micro text-muted-foreground/80 sm:inline">
                {engagementCount}%
              </span>
            ) : null}
          </button>
        )}

      {/* Everything else — one overflow menu instead of five more icons. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`${action} hover:text-foreground`}
            title="More actions"
            aria-label="More actions for this loop"
          >
            <MoreHorizontal className="h-[22px] w-[22px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl bg-card border-border shadow-xl">
          <DropdownMenuItem
            onClick={onBookmark}
            disabled={activeInteracting === `${loop.id}-save`}
            className="cursor-pointer gap-2 py-2 text-xs"
          >
            <AnimatedIconView component={BookmarkIcon} size={16} color={isSaved ? "hsl(var(--primary))" : "currentColor"} />
            <span>{isSaved ? "Remove bookmark" : "Bookmark"}</span>
          </DropdownMenuItem>

          <AddLoopToCollectionItem loopId={loop.id} />

          <DropdownMenuItem onClick={onBoost} className="cursor-pointer gap-2 py-2 text-xs">
            <Rocket className="h-4 w-4 text-[var(--theme-primary)]" />
            <span>Boost with coins</span>
            {shouldShowCount(boostCoinsCurrent) && (
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                {Number(boostCoinsCurrent).toLocaleString()}
              </span>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              if (!requireAuth("gift")) return
              onGift()
            }}
            className="cursor-pointer gap-2 py-2 text-xs"
          >
            <Gift className="h-4 w-4 text-fuchsia-500" />
            <span>Send a gift</span>
            {shouldShowCount(giftsCount) && (
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                {giftsCount}
              </span>
            )}
          </DropdownMenuItem>

          {canFork && (
            <DropdownMenuItem
              onClick={onFork}
              disabled={forking}
              className="cursor-pointer gap-2 py-2 text-xs"
            >
              {forking ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <GitFork className="h-4 w-4 text-violet-500" />
              )}
              <span>Fork this code</span>
            </DropdownMenuItem>
          )}

          {(isBoosted || (isAuthor && onOpenAnalytics)) && <DropdownMenuSeparator />}
          {isAuthor && onOpenAnalytics && (
            <DropdownMenuItem
              onClick={onOpenAnalytics}
              className="cursor-pointer gap-2 py-2 text-xs"
            >
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span>Post analytics</span>
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                {viewsCount >= 1000
                  ? `${(viewsCount / 1000).toFixed(viewsCount >= 10_000 ? 0 : 1)}K views`
                  : `${viewsCount} views`}
              </span>
            </DropdownMenuItem>
          )}
          {isBoosted && (
            <DropdownMenuItem className="cursor-pointer gap-2 py-2 text-xs text-cyan-400" disabled>
              <Rocket className="h-4 w-4" />
              <span>Boosted</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </div>
  )
}
