"use client"

import { useState, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Copy,
  Check,
  MessageSquare,
  Users,
  ExternalLink,
  Link2,
  Share2,
  Mail,
  Send,
  Loader2,
} from "lucide-react"
import { shareContent, absoluteAppUrl } from "@/lib/share"

interface ShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The item being shared */
  item: {
    id: string
    type: "loop" | "reel" | "event" | "circle" | "profile"
    title?: string
    text?: string
    authorName?: string
    mediaUrl?: string
    mediaType?: string
    /** URL path to share (e.g., /loop/abc123) */
    sharePath?: string
  }
  /** Callback when DM share is clicked */
  onDmShare?: () => void
  /** Callback when circle share is clicked */
  onCircleShare?: () => void
}

interface SocialPlatform {
  id: string
  name: string
  icon: string
  color: string
  getUrl: (url: string, text?: string) => string
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "twitter",
    name: "X / Twitter",
    icon: "𝕏",
    color: "bg-black text-white",
    getUrl: (url, text) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || "Check this out!")}`,
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "f",
    color: "bg-blue-600 text-white",
    getUrl: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "📱",
    color: "bg-green-500 text-white",
    getUrl: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text || "Check this out!"} ${url}`)}`,
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
    color: "bg-sky-500 text-white",
    getUrl: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || "Check this out!")}`,
  },
  {
    id: "email",
    name: "Email",
    icon: "✉️",
    color: "bg-gray-600 text-white",
    getUrl: (url, text) =>
      `mailto:?subject=${encodeURIComponent(text || "Shared from loopapp.me")}&body=${encodeURIComponent(`Check this out: ${url}`)}`,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "in",
    color: "bg-blue-700 text-white",
    getUrl: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
]

export function EnhancedShareSheet({
  open,
  onOpenChange,
  item,
  onDmShare,
  onCircleShare,
}: ShareSheetProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareUrl = absoluteAppUrl(item.sharePath || `/${item.type}/${item.id}`)
  const shareText = item.title || item.text?.slice(0, 120) || `Check out this ${item.type} on loopapp.me`

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast({ title: "Link copied!", description: "Share it wherever you want" })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" })
    }
  }, [shareUrl, toast])

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.share) return
    setSharing(true)
    try {
      await navigator.share({
        title: shareText,
        text: item.text?.slice(0, 200) || "",
        url: shareUrl,
      })
      onOpenChange(false)
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({ title: "Share failed", variant: "destructive" })
      }
    } finally {
      setSharing(false)
    }
  }, [shareText, shareUrl, item.text, onOpenChange, toast])

  const handleSocialShare = useCallback(
    (platform: SocialPlatform) => {
      const url = platform.getUrl(shareUrl, shareText)
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=500")
      onOpenChange(false)
    },
    [shareUrl, shareText, onOpenChange]
  )

  const handleDmShare = useCallback(() => {
    onOpenChange(false)
    onDmShare?.()
  }, [onOpenChange, onDmShare])

  const handleCircleShare = useCallback(() => {
    onOpenChange(false)
    onCircleShare?.()
  }, [onOpenChange, onCircleShare])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </SheetTitle>
          <SheetDescription className="sr-only">Share this content</SheetDescription>
        </SheetHeader>

        {/* Link Preview Card */}
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 mb-4">
          {item.mediaUrl && (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
              {item.mediaType === "video" ? (
                <div className="h-full w-full flex items-center justify-center bg-black/50 text-white text-xs">▶</div>
              ) : (
                <img
                  src={item.mediaUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{item.title || shareText}</p>
            <p className="text-xs text-muted-foreground truncate">{shareUrl}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {/* Native Share */}
          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <button
              onClick={handleNativeShare}
              disabled={sharing}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-white">
                {sharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
              </div>
              <span className="text-[11px] text-muted-foreground">Share</span>
            </button>
          )}

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground">
              {copied ? <Check className="h-5 w-5 text-emerald-500" /> : <Link2 className="h-5 w-5" />}
            </div>
            <span className="text-[11px] text-muted-foreground">{copied ? "Copied!" : "Copy link"}</span>
          </button>

          {/* Send to DM */}
          {onDmShare && (
            <button
              onClick={handleDmShare}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">Message</span>
            </button>
          )}

          {/* Share to Circle */}
          {onCircleShare && (
            <button
              onClick={handleCircleShare}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">Circle</span>
            </button>
          )}
        </div>

        {/* Social Platforms */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">Share to</p>
          <div className="grid grid-cols-3 gap-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handleSocialShare(platform)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl p-2.5 hover:bg-muted/50 transition-colors",
                  "border border-border/50"
                )}
              >
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold", platform.color)}>
                  {platform.icon}
                </div>
                <span className="text-xs font-medium">{platform.name}</span>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
