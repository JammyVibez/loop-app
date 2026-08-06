"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { MENTION_RE } from "@/lib/mentions-shared"
import { cn } from "@/lib/utils"
import { UrlPreviewCard } from "./url-preview-card"

const HASHTAG_RE = /#([a-zA-Z0-9_]{1,50})\b/g
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g
const MARKDOWN_IMG_RE = /^!\[([^\]]*)\]\((https?:\/\/[^\s<]+|\/[^\s<]+)\)$/i
const CIRCLE_TOKEN_RE = /^\[\[c:([0-9a-f-]{36})\|([^\]]{1,80})\]\]$/i
const COMBINED_RE =
  /(\[\[[cC]:[0-9a-f-]{36}\|[^\]]{1,80}\]\]|!\[[^\]]*\]\((?:https?:\/\/[^\s<]+|\/[^\s<]+)\)|@[a-zA-Z0-9_]{3,30}\b|#[a-zA-Z0-9_]{1,50}\b|https?:\/\/[^\s<]+|www\.[^\s<]+)/g

type Props = {
  text: string
  className?: string
  as?: "p" | "span" | "div"
  showPreviewCard?: boolean
}

/**
 * Checks if a URL or alt tag corresponds to a sticker or GIF asset.
 */
function isStickerOrGif(url: string, alt: string = ""): boolean {
  const lowerUrl = url.toLowerCase()
  const lowerAlt = alt.toLowerCase()
  return (
    lowerAlt.includes("sticker") ||
    lowerAlt.includes("gif") ||
    lowerUrl.includes("dicebear.com") ||
    lowerUrl.includes("tenor.com") ||
    lowerUrl.includes("giphy.com") ||
    lowerUrl.includes("stickers/") ||
    lowerUrl.endsWith(".gif") ||
    lowerUrl.endsWith(".svg")
  )
}

/**
 * Renders post/comment/bio text with community tags, stickers, GIFs,
 * clickable @mentions, #hashtags, and auto-expanding URL preview cards.
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

          // 0. Community tags in bio/posts: [[c:uuid|Name]]
          const circleToken = part.match(CIRCLE_TOKEN_RE)
          if (circleToken) {
            return (
              <Link
                key={`${i}-${part}`}
                href={`/circles/${circleToken[1]}`}
                className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/20"
                onClick={(e) => e.stopPropagation()}
              >
                {circleToken[2]}
              </Link>
            )
          }

          // 1. Markdown Images: ![alt](url)
          const imgMatch = part.match(MARKDOWN_IMG_RE)
          if (imgMatch) {
            const alt = imgMatch[1] || ""
            const url = imgMatch[2]
            const isSticker = isStickerOrGif(url, alt)

            if (isSticker) {
              return (
                <span key={`${i}-${part}`} className="inline-block my-1 align-middle p-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={alt || "Sticker"}
                    className="h-20 w-20 sm:h-24 sm:w-24 object-contain transition-transform hover:scale-110 drop-shadow-md select-none"
                    loading="lazy"
                  />
                </span>
              )
            }

            return (
              <span key={`${i}-${part}`} className="block my-2 max-w-sm rounded-xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={alt || "Image"}
                  className="max-h-60 w-auto object-contain rounded-xl"
                  loading="lazy"
                />
              </span>
            )
          }

          // 2. Mentions (@username)
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

          // 3. Hashtags (#tag)
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

          // 4. URLs (https://... or www....)
          const isUrl = part.match(/^(https?:\/\/[^\s<]+|www\.[^\s<]+)$/i)
          if (isUrl) {
            const rawUrl = part
            const fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`

            // If the URL itself is a sticker or GIF image, render inline image and skip preview card!
            if (isStickerOrGif(fullUrl)) {
              return (
                <span key={`${i}-${part}`} className="inline-block my-1 align-middle p-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fullUrl}
                    alt="Sticker"
                    className="h-20 w-20 sm:h-24 sm:w-24 object-contain transition-transform hover:scale-110 drop-shadow-md select-none"
                    loading="lazy"
                  />
                </span>
              )
            }

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

      {/* Render URL preview expansion card ONLY for non-sticker detected URLs */}
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
