"use client"

import Link from "next/link"
import { MENTION_RE } from "@/lib/mentions"
import { cn } from "@/lib/utils"

const HASHTAG_RE = /#([a-zA-Z0-9_]{1,50})\b/g
const COMBINED_RE = /(@[a-zA-Z0-9_]{3,30}\b|#[a-zA-Z0-9_]{1,50}\b)/g

type Props = {
  text: string
  className?: string
  as?: "p" | "span" | "div"
}

/**
 * Renders post/comment text with clickable @mentions and #hashtags.
 */
export function RichContent({ text, className, as: Tag = "p" }: Props) {
  const content = String(text || "")
  if (!content) return null

  const parts = content.split(COMBINED_RE)

  return (
    <Tag className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, i) => {
        if (!part) return null

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

        return <span key={`${i}-${part}`}>{part}</span>
      })}
    </Tag>
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
