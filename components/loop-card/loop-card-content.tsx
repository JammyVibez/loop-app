"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { GitBranch, Zap } from "@/components/icons/lucide-compat"
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
import { ChannelShareCard, channelShareFromMetadata } from "@/components/channels/channel-share-card"

interface LoopCardContentProps {
  loop: any
  rawLoop: any
  content: string
  contentPreview: string
  /** Kept for callers; the inline renderer reads tags from the post text. */
  hashtags: string[]
  onLike: (opts?: { fromDoubleTap?: boolean }) => void
  onFork: () => void
  forking: boolean
}

/** Tags already typed inline in the body so we never repeat them as chips. */
function escapeTag(tag: string) {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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
  // Movie/show shares carry canonical title details from the server and render
  // as a cinematic preview canvas instead of an ordinary link card.
  const channelShare = channelShareFromMetadata(
    loop.content_metadata ?? rawLoop?.content_metadata,
  )

  // Tags added through the composer's hashtag field live in the post's
  // `hashtags` array — not in the body text — so RichContent can't render
  // them. Show the ones that aren't already visible inline as chips.
  const chipTags = useMemo(() => {
    if (!Array.isArray(hashtags) || hashtags.length === 0) return []
    const body = String(content || "")
    return hashtags
      .map((t) => String(t).replace(/^#/, "").trim())
      .filter(Boolean)
      .filter((t) => !new RegExp(`#${escapeTag(t)}\\b`, "i").test(body))
  }, [hashtags, content])

  return (
    <>
      {LoginGateDialog}
      <div data-loop-card-content="" className="space-y-2">
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
                <Badge variant="outline" className="text-caption">
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
                // Body copy sits at the 16px regular token with tight leading —
                // dense but readable, and still keeps a post above the fold.
                className="text-regular leading-[1.5]"
                // The post author controls whether the rich link card shows
                // for everyone viewing the post.
                showPreviewCard={!loop.link_preview_disabled}
              />
              {content.length > 200 && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto text-[var(--theme-primary)] hover:text-[var(--theme-secondary)] text-mini"
                  onClick={() => setShowFullContent(!showFullContent)}
                >
                  {showFullContent ? "Show less" : "Show more"}
                </Button>
              )}
            </>
          )}
        </div>

        {channelShare ? <ChannelShareCard share={channelShare} /> : null}

        {/* Hashtags added via the composer's tag field (not written inline in
            the body) render here as tappable chips — otherwise they'd be
            invisible, since RichContent only tints #tags that are in the text. */}
        {chipTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {chipTags.map((tag) => (
              <Link
                key={tag}
                href={`/hashtag/${encodeURIComponent(tag.toLowerCase())}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full bg-[var(--theme-primary,#0ea5e9)]/10 px-3 py-1 text-caption font-semibold text-[var(--theme-primary,#0ea5e9)] ring-1 ring-inset ring-[var(--theme-primary,#0ea5e9)]/20 transition hover:bg-[var(--theme-primary,#0ea5e9)]/20"
              >
                #{tag}
              </Link>
            ))}
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
