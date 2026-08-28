"use client"

import { useState } from "react"
import Link from "next/link"
import { GitBranch, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RichContent } from "@/components/content/rich-content"
import { PollCardWidget } from "@/components/polls/poll-card-widget"
import { LoopDuelCard } from "@/components/duels/loop-duel-card"
import { ClutchDuelCard } from "@/components/duels/clutch-duel-card"
import { CodeBlock } from "@/components/loops/code-block"
import { isCodeLoop } from "@/lib/pro-features"
import { useAuth } from "@/hooks/use-auth"
import { useLoginGate } from "@/hooks/use-login-gate"
import { useToast } from "@/components/ui/use-toast"

interface LoopCardContentProps {
  loop: any
  rawLoop: any
  content: string
  contentPreview: string
  hashtags: string[]
  onLike: (opts?: { fromDoubleTap?: boolean }) => void
  onFork: () => void
  forking: boolean
}

export function LoopCardContent({
  loop,
  rawLoop,
  content,
  contentPreview,
  hashtags,
  onLike,
  onFork,
  forking,
}: LoopCardContentProps) {
  const [showFullContent, setShowFullContent] = useState(false)
  const { user: currentUser } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()
  const { toast } = useToast()

  return (
    <>
      {LoginGateDialog}
      <div className="space-y-2 sm:space-y-3">
        <div
          onDoubleClick={() => onLike({ fromDoubleTap: true })}
          className="relative"
        >
          {isCodeLoop(loop) || isCodeLoop(rawLoop) ? (
            <div className="space-y-2">
              {(loop as any).content_title || rawLoop?.content_title ? (
                <p className="text-sm font-semibold">
                  {(loop as any).content_title || rawLoop?.content_title}
                </p>
              ) : null}
              {(loop as any).content_metadata?.forked_from ? (
                <Badge variant="outline" className="text-[10px]">
                  Forked loop
                </Badge>
              ) : null}
              <CodeBlock
                code={content}
                language={
                  (loop as any).content_metadata?.language ||
                  rawLoop?.content_metadata?.language ||
                  "other"
                }
                title={(loop as any).content_title || rawLoop?.content_title}
                forksCount={Number(
                  (loop as any).content_metadata?.forks_count ||
                    rawLoop?.content_metadata?.forks_count ||
                    0
                )}
                onFork={onFork}
                forking={forking}
                showFork={currentUser?.id !== loop.author_id}
              />
            </div>
          ) : (
            <>
              <RichContent
                text={showFullContent ? content : contentPreview}
                className="text-sm sm:text-base leading-relaxed"
              />
              {content.length > 200 && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto text-[var(--theme-primary)] hover:text-[var(--theme-secondary)] text-xs sm:text-sm"
                  onClick={() => setShowFullContent(!showFullContent)}
                >
                  {showFullContent ? "Show less" : "Show more"}
                </Button>
              )}
            </>
          )}
        </div>

        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.slice(0, 3).map((tag: string) => (
              <Link key={tag} href={`/hashtag/${tag}`}>
                <Badge
                  variant="outline"
                  className="text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 border-[var(--theme-primary)]/30 text-xs"
                >
                  #{tag}
                </Badge>
              </Link>
            ))}
            {hashtags.length > 3 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{hashtags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Render Poll Widget if loop is a poll */}
        {(loop.poll ||
          rawLoop?.poll ||
          loop.post_type === "poll" ||
          rawLoop?.post_type === "poll" ||
          loop.media_type === "poll" ||
          loop.category === "poll") && (
          <PollCardWidget poll={loop.poll || rawLoop?.poll} loopId={loop.id} />
        )}

        {/* Render Duel Card if loop is a duel */}
        {(loop.duel ||
          rawLoop?.duel ||
          loop.post_type === "duel" ||
          rawLoop?.post_type === "duel" ||
          loop.media_type === "duel" ||
          loop.category === "duel") &&
          (loop.duel?.duel_type === "clutch" ||
          rawLoop?.duel?.duel_type === "clutch" ? (
            <ClutchDuelCard duel={loop.duel || rawLoop?.duel} loopId={loop.id} />
          ) : (
            <LoopDuelCard duel={loop.duel || rawLoop?.duel} loopId={loop.id} />
          ))}
      </div>
    </>
  )
}
