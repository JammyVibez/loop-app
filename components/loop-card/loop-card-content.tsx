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
      <div className="space-y-2">
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
                // X sets post copy at 15px with tight leading — dense but
                // readable, and it keeps more of a post above the fold.
                className="text-[15px] leading-[1.45]"
                // The post author controls whether the rich link card shows
                // for everyone viewing the post.
                showPreviewCard={!loop.link_preview_disabled}
              />
              {content.length > 200 && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto text-[var(--theme-primary)] hover:text-[var(--theme-secondary)] text-[13px]"
                  onClick={() => setShowFullContent(!showFullContent)}
                >
                  {showFullContent ? "Show less" : "Show more"}
                </Button>
              )}
            </>
          )}
        </div>

        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.slice(0, 3).map((tag: string) => (
              <Link key={tag} href={`/hashtag/${tag}`}>
                {/* Borderless chips — X renders tags as plain tinted text. */}
                <Badge className="border-0 bg-[var(--theme-primary)]/12 text-[12px] font-medium text-[var(--theme-primary)] shadow-none transition-colors hover:bg-[var(--theme-primary)]/20">
                  #{tag}
                </Badge>
              </Link>
            ))}
            {hashtags.length > 3 && (
              <Badge className="border-0 bg-foreground/[0.06] text-[12px] font-medium text-muted-foreground shadow-none">
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
