"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { MENTION_RE } from "@/lib/mentions"
import { cn } from "@/lib/utils"
import { UrlPreviewCard } from "./url-preview-card"

const HASHTAG_RE = /#([a-zA-Z0-9_]{1,50})\b/g
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g
const COMBINED_RE = /(@[a-zA-Z0-9_]{3,30}\b|#[a-zA-Z0-9_]{1,50}\b|https?:\/\/[^\s<]+|www\.[^\s<]+)/g

type Props = {
  text: string
  className?: string
  as?: "p" | "span" | "div"
  showPreviewCard?: boolean
}

/**
 * Renders post/comment text with clickable @mentions, #hashtags, highlighted URLs,
 * and auto-expanding URL detail preview cards.
 */
export function RichContent({
  text,
  className,
  as: Tag = "p",
  showPreviewCard = true,
}: Props) {
  const content = String(text || "")
  if (!content) return null

  const parts = content.split(COMBINED_RE)
  const detectedUrls: string[] = []

  return (
    <div className="space-y-1.5 min-w-0">
      <Tag className={cn("whitespace-pre-wrap break-words", className)}>
        {parts.map((part, i) => {
          if (!part) return null

          // 1. Mentions (@username)
          const mention = part.match(/^@([a-zA-Z0-9_]{3,30})$/)
          if (mention) {
            return (
              <Link
                key={`${i}-${part}`}
                href={`/profile/${mention[1].toLowerCase()}`}
                className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
                onClick={(e) => e.stopPropagation()}
              >
                @{mention[1]}
              </Link>
            )
          }

          // 2. Hashtags (#tag)
          const hashtag = part.match(/^#([a-zA-Z0-9_]{1,50})$/)
          if (hashtag) {
            return (
              <Link
                key={`${i}-${part}`}
                href={`/hashtag/${hashtag[1].toLowerCase()}`}
                className="font-semibold text-[var(--theme-primary,#0ea5e9)] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                #{hashtag[1]}
              </Link>
            )
          }

          // 3. URLs (https://... or www....)
          const isUrl = part.match(/^(https?:\/\/[^\s<]+|www\.[^\s<]+)$/i)
          if (isUrl) {
            const rawUrl = part
            const fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`
            if (!detectedUrls.includes(fullUrl)) {
              detectedUrls.push(fullUrl)
            }
            return (
              <a
                key={`${i}-${part}`}
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 font-medium text-sky-500 hover:text-sky-400 underline underline-offset-2 transition-colors break-all"
              >
                <span>{rawUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </a>
            )
          }

          return <span key={`${i}-${part}`}>{part}</span>
        })}
      </Tag>

      {/* Render URL preview expansion card for detected URLs */}
      {showPreviewCard && detectedUrls.length > 0 && (
        <div className="pt-1">
          {detectedUrls.slice(0, 2).map((url) => (
            <UrlPreviewCard key={url} url={url} />
          ))}
        </div>
      )}
    </div>
  )
}

export function extractInlineHashtags(text: string) {
  const tags = new Set<string>()
  const re = new RegExp(HASHTAG_RE.source, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) tags.add(m[1].toLowerCase())
  return Array.from(tags)
}

export function extractInlineMentions(text: string) {
  const users = new Set<string>()
  const re = new RegExp(MENTION_RE.source, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) users.add(m[1].toLowerCase())
  return Array.from(users)
}
