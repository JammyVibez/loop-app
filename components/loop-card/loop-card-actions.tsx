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
  Loader2,
  Rocket,
  Gift,
  Coins,
  Users,
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

  return (
    <div className="space-y-2">
      {/* Action buttons bar */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/20 px-1.5 py-1.5 sm:px-2.5">
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={isLiked ? "Unlike this loop" : "Like this loop"}
            className={`relative rounded-full px-2 sm:px-2.5 transition-all duration-300 ${
              isLiked
                ? "text-rose-500 bg-rose-500/10"
                : "hover:text-rose-500 hover:bg-rose-500/10"
            }`}
            onClick={onLike}
            disabled={activeInteracting === `${loop.id}-like`}
          >
            {isAnimating && (
              <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-60" />
            )}
            {activeInteracting === `${loop.id}-like` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart
                className={`h-4 w-4 transition-all duration-200 ${
                  isLiked ? "fill-current scale-110" : ""
                }`}
              />
            )}
            <span className="font-semibold text-xs">{likesCount}</span>
          </Button>

          {/* Comment button */}
          <Link href={`/loop/${loop.id}`} aria-label="View comments on this loop">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full px-2 sm:px-2.5 transition-all duration-200 hover:text-sky-500 hover:bg-sky-500/10"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="font-semibold text-xs">{commentsCount}</span>
            </Button>
          </Link>

          {/* Branch dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full px-2 sm:px-2.5 transition-all duration-200 hover:text-emerald-500 hover:bg-emerald-500/10"
                title="Branch / View Chain"
                aria-label="Branch this loop or view the chain"
              >
                <GitBranch className="h-4 w-4" />
                <span className="font-semibold text-xs">{branchesCount}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-popover border-border text-foreground">
              <DropdownMenuItem onClick={onBranch} className="cursor-pointer hover:bg-muted">
                <GitBranch className="h-4 w-4 mr-2 text-green-400" /> Branch this Loop
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Boost Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBoost}
            className="rounded-full px-2 sm:px-2.5 transition-all duration-200 text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10"
            title="Boost Loop with Coins"
            aria-label="Boost this loop with coins"
          >
            <Rocket className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {(isCodeLoop(loop) || isCodeLoop(rawLoop)) && currentUser?.id !== loop.author_id && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full px-2 sm:px-2.5 transition-all duration-200 hover:text-violet-500 hover:bg-violet-500/10"
              onClick={onFork}
              disabled={forking}
              title="Fork code"
              aria-label="Fork this code"
            >
              {forking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitFork className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Send a gift */}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full px-2 sm:px-2.5 transition-all duration-200 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10"
            onClick={onGift}
            title="Send a gift"
            aria-label="Send a gift for this loop"
          >
            <Gift className="h-4 w-4" />
          </Button>

          {/* Share dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full px-2 sm:px-2.5 transition-all duration-200 hover:text-sky-500 hover:bg-sky-500/10"
                title="Share options"
                aria-label="Share this loop"
              >
                <Share className="h-4 w-4" />
                <span className="hidden xs:inline font-semibold text-xs">{sharesCount}</span>
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

          <Button
            variant="ghost"
            size="sm"
            className={`rounded-full px-2 sm:px-2.5 transition-all duration-200 ${
              isSaved
                ? "text-sky-500 bg-sky-500/10"
                : "hover:text-sky-500 hover:bg-sky-500/10"
            }`}
            onClick={onBookmark}
            disabled={activeInteracting === `${loop.id}-save`}
            title="Bookmark"
            aria-label={isSaved ? "Remove bookmark" : "Bookmark this loop"}
          >
            {activeInteracting === `${loop.id}-save` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
            )}
          </Button>
        </div>
      </div>

      {/* Engagement meta strip */}
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center gap-1">
            {Number(loop.stats?.views_count || 0).toLocaleString()} views
          </span>
        </span>
        <span className="inline-flex items-center gap-3">
          {Number(loop.gifts_received || 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Gift className="h-3 w-3" /> {loop.gifts_received}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Share2 className="h-3 w-3" /> {sharesCount}
          </span>
        </span>
      </div>
    </div>
  )
}
