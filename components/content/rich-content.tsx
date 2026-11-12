"use client"

import Link from "next/link"
import { ExternalLink, Users, Tag } from "@/components/icons/lucide-compat"
import { MENTION_RE } from "@/lib/mentions-shared"
import { cn } from "@/lib/utils"
import { UrlPreviewCard } from "./url-preview-card"
import { MarkdownContent } from "./markdown-content"
import { openInAppBrowser } from "@/components/in-app-browser/in-app-browser"
import { EmojiText } from "@/components/emoji/animated-emoji"
import { CommunityShareCard } from "@/components/communities/community-share-card"

const HASHTAG_RE = /#([a-zA-Z0-9_]{1,50})\b/g
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g
const MARKDOWN_IMG_RE = /^!\[([^\]]*)\]\((https?:\/\/[^\s<]+|\/[^\s<]+)\)$/i
const CIRCLE_TOKEN_RE = /^\[\[c:([a-zA-Z0-9_-]{1,64})(?:\|([^\]]{1,80}))?\]\]$/i
const COMMUNITY_CARD_TOKEN_RE = /^\[\[cc:([a-zA-Z0-9_-]{1,64})\]\]$/i
const COMBINED_RE = /(\[\[cc:[a-zA-Z0-9_-]{1,64}\]\]|\[\[c:[a-zA-Z0-9_-]{1,64}(?:\|[^\]]{1,80})?\]\]|!\[[^\]]*\]\((?:https?:\/\/[^\s<]+|\/[^\s<]+)\)|@[a-zA-Z0-9_]{3,30}\b|#[a-zA-Z0-9_]{1,50}\b|https?:\/\/[^\s<]+|www\.[^\s<]+)/g

type Props = {
  text: string
  className?: string
  as?: "p" | "span" | "div"
  showPreviewCard?: boolean
}

// Attribution footer appended by rebranch: renders smaller + muted so the
// quote and original post keep visual hierarchy (never full post size).
const REBRANCH_ATTRIBUTION_RE = /\n?— Rebranched from @[a-zA-Z0-9_]{3,30}\s*$/

/**
 * Checks if a URL or alt tag corresponds to a sticker or GIF asset.
 */
function mediaKind(url: string, alt: string = ""): "emoji" | "sticker" | "gif" | "image" {
  const lowerUrl = url.toLowerCase()
  const lowerAlt = alt.toLowerCase()
  if (lowerAlt.includes("emoji")) return "emoji"
  if (
    lowerAlt.includes("sticker") ||
    lowerUrl.includes("stickers/") ||
    lowerUrl.includes("dicebear.com") ||
    (lowerUrl.endsWith(".svg") && !lowerUrl.includes("giphy"))
  ) {
    return "sticker"
  }
  if (
    lowerAlt.includes("gif") ||
    lowerUrl.endsWith(".gif") ||
    lowerUrl.includes("giphy.com") ||
    lowerUrl.includes("tenor.com") ||
    lowerUrl.includes("klipy.com")
  ) {
    return "gif"
  }
  return "image"
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

  // Split off the rebranch attribution footer so it renders in its own
  // smaller, muted line instead of full post text size.
  const attributionMatch = content.match(REBRANCH_ATTRIBUTION_RE)
  const bodyText = attributionMatch ? content.slice(0, content.length - attributionMatch[0].length) : content
  const attribution = attributionMatch ? attributionMatch[0].replace(/^\n+/, "").trim() : null

  const parts = bodyText.split(COMBINED_RE)
  const detectedUrls: string[] = []

  // GIF hosts serve their own optimized CDN assets; proxying them would break
  // caching and stream every animation through our server.
  const isCdnGif = (src: string) =>
    /(^|\/\/)([a-z0-9-]+\.)*(giphy\.com|tenor\.com|klipy\.com)\//i.test(src) || /\.gif($|\?)/i.test(src)

  // Route remote images through the image-proxy so browsers don't fetch unknown hosts directly.
  const proxied = (src?: string | null): string | undefined => {
    if (!src) return undefined
    if (!src.startsWith("http")) return src
    return isCdnGif(src) ? src : `/api/image-proxy?url=${encodeURIComponent(src)}`
  }

  return (
    <div className="space-y-1 min-w-0">
      <Tag className={cn("whitespace-pre-wrap break-words", className)}>
        {parts.map((part, i) => {
          if (!part) return null

          // 0. Shared community card: [[cc:uuid]]
          const cardToken = part.match(COMMUNITY_CARD_TOKEN_RE)
          if (cardToken) {
            return <CommunityShareCard key={`${i}-${part}`} communityId={cardToken[1]} />
          }

          // 0b. Community tags in bio/posts: [[c:uuid|Name]]
          const circleToken = part.match(CIRCLE_TOKEN_RE)
          if (circleToken) {
            const circleId = circleToken[1]
            const circleName = circleToken[2]?.trim() || "Community"
            return (
              <Link
                key={`${i}-${part}`}
                href={`/communities/${circleId}`}
                className="mx-0.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                onClick={(e) => e.stopPropagation()}
              >
                <Users className="h-3 w-3 shrink-0" />
                <span>{circleName}</span>
              </Link>
            )
          }

          // 1. Markdown Images: ![alt](url)
          const imgMatch = part.match(MARKDOWN_IMG_RE)
          if (imgMatch) {
            const alt = imgMatch[1] || ""
            const url = imgMatch[2]
            const kind = mediaKind(url, alt)

            if (kind === "emoji") {
              return (
                <span key={`${i}-${part}`} className="inline-block mx-0.5 align-middle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxied(url)}
                    alt={alt || "Emoji"}
                    className="h-4 w-4 sm:h-5 sm:w-5 object-contain inline-block align-middle select-none" style={{verticalAlign: "middle"}}
                    loading="lazy"
                  />
                </span>
              )
            }

            if (kind === "sticker") {
              return (
                <span key={`${i}-${part}`} className="inline-block my-1 align-middle p-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxied(url)}
                    alt={alt || "Sticker"}
                    className="h-20 w-20 select-none object-contain drop-shadow-md transition-transform hover:scale-110 sm:h-24 sm:w-24"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              )
            }

            if (kind === "gif") {
              return (
                <span key={`${i}-${part}`} className="my-2 block max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxied(url)}
                    alt={alt || "GIF"}
                    className="max-h-56 w-auto max-w-full rounded-xl object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              )
            }

            return (
              <span key={`${i}-${part}`} className="my-2 block max-w-sm overflow-hidden rounded-xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxied(url)}
                  alt={alt || "Image"}
                  className="max-h-60 w-auto rounded-xl object-contain"
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

            // If the URL itself is a sticker or GIF image, render inline media
            // and skip the link preview card.
            const bareKind = mediaKind(fullUrl)
            if (bareKind === "sticker" || bareKind === "gif") {
              return (
                <span key={`${i}-${part}`} className={bareKind === "gif" ? "my-1 block" : "my-1 inline-block align-middle p-0.5"}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxied(fullUrl)}
                    alt={bareKind === "gif" ? "GIF" : "Sticker"}
                    className={
                      bareKind === "gif"
                        ? "max-h-56 w-auto max-w-full rounded-xl border border-white/10 object-contain"
                        : "h-20 w-20 select-none object-contain drop-shadow-md transition-transform hover:scale-110 sm:h-24 sm:w-24"
                    }
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
                onClick={(e) => {
                  e.stopPropagation()
                  // Preview links inside Loop first — users can jump to their
                  // real browser from the sheet. Middle-click / cmd-click still
                  // opens a new tab (native fallback via href).
                  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault()
                    openInAppBrowser(fullUrl)
                  }
                }}
                className="inline-flex items-center gap-0.5 font-medium text-sky-500 hover:text-sky-400 underline underline-offset-2 transition-colors break-all"
              >
                <span>{rawUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </a>
            )
          }

          const containsMarkdown = /([*_~`#>]|---)/.test(part)
          if (containsMarkdown) {
            return <MarkdownContent key={`${i}-${part}`} content={part} />
          }

          return <EmojiText key={`${i}-${part}`} text={part} />
        })}
      </Tag>

      {/* Rebranch attribution — small, muted, sits tight under the post body */}
      {attribution && (
        <p className="text-xs text-muted-foreground mt-0.5">{attribution}</p>
      )}

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
