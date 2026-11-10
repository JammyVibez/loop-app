"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ProxyImg } from "@/components/ui/proxy-img"
import { CheckCheck, Check, Reply, CornerUpRight, Trash2, Pencil, MoreHorizontal, Copy, Pin } from "@/components/icons/lucide-compat"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface MessageBubbleProps {
  message: {
    id: string
    content: string
    sender_id?: string
    author_id?: string
    created_at: string
    edited_at?: string | null
    is_deleted?: boolean
    media_url?: string | null
    media_type?: string | null
    message_type?: string
    reply_to_id?: string | null
    reply_to?: any | null
    reactions?: Array<{ emoji: string; count: number; users?: string[] }>
    sender?: { id?: string; username?: string; display_name?: string; avatar_url?: string } | null
    forwarded_from?: string | null
    is_read?: boolean
  }
  isOwn: boolean
  isFresh: boolean
  peerReadAt?: string | null
  onReply: (msg: any) => void
  onEdit: (msg: any) => void
  onDelete: (msg: any) => void
  onReaction?: (messageId: string, emoji: string) => void
  onPin?: (msg: any) => void
  canAdminDelete?: boolean
  QUICK_REACTIONS?: readonly string[]
}

export function MessageBubble({
  message,
  isOwn,
  isFresh,
  peerReadAt,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onPin,
  canAdminDelete = false,
  QUICK_REACTIONS = ["❤️", "😂", "👍", "🔥", "😮", "👏"],
}: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false)
  const [copied, setCopied] = useState(false)

  // System messages (join, leave, remove, lock, etc.) render centered
  if (message.message_type === "system") {
    return (
      <div className="flex w-full justify-center my-1.5">
        <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-full px-3 py-1">
          {message.content}
        </p>
      </div>
    )
  }

  if (message.is_deleted) {
    return (
      <div className={cn("flex w-full mb-1", isOwn ? "justify-end" : "justify-start")}>
        <div className="text-xs text-muted-foreground italic px-3 py-1.5 bg-muted/30 rounded-xl">
          Message deleted
        </div>
      </div>
    )
  }

  const isVideo = message.media_type === "video" || message.media_url?.match(/\.(mp4|webm|ogg|mov)$/i)
  const isVoice = message.message_type === "voice" || message.media_type === "voice"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* noop */ }
  }

  const readByPeer = isOwn && peerReadAt && message.created_at <= peerReadAt

  const timeStr = (() => {
    try {
      return new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch {
      return ""
    }
  })()

  return (
    <div className={cn("group relative flex w-full mb-1", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[75%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 text-sm transition-all",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md",
          isFresh && "animate-in slide-in-from-bottom-2 fade-in duration-300",
        )}
        onMouseEnter={() => setShowReactions(true)}
        onMouseLeave={() => setShowReactions(false)}
      >
        {/* Pinned badge */}
        {(message as any).is_pinned && (
          <div className="text-[9px] font-semibold text-amber-500 mb-1 flex items-center gap-1">
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
            Pinned
          </div>
        )}
        {/* Reply preview */}
        {message.reply_to && (
          <div className={cn(
            "mb-1.5 rounded-lg px-2.5 py-1.5 text-[11px] border-l-2",
            isOwn ? "bg-primary/20 border-primary-foreground/40" : "bg-background/60 border-primary/40",
          )}>
            <div className="flex items-center gap-1 font-semibold text-[10px] mb-0.5">
              <CornerUpRight className="h-2.5 w-2.5" />
              {message.reply_to.sender?.display_name || message.reply_to.sender?.username || "Reply"}
            </div>
            <p className="text-[11px] opacity-80 line-clamp-2">{message.reply_to.content || "Media"}</p>
          </div>
        )}

        {/* Forwarded indicator */}
        {message.forwarded_from && (
          <div className="text-[10px] text-muted-foreground mb-1 italic flex items-center gap-1">
            <CornerUpRight className="h-2.5 w-2.5" /> Forwarded
          </div>
        )}

        {/* Media */}
        {message.media_url && !isVoice && (
          <div className="mb-1.5 rounded-xl overflow-hidden">
            {isVideo ? (
              <video src={message.media_url} controls playsInline className="max-h-[300px] rounded-xl" />
            ) : (
              <ProxyImg src={message.media_url} alt="Media" className="max-h-[300px] rounded-xl object-cover" />
            )}
          </div>
        )}

        {/* Voice message */}
        {isVoice && message.media_url && (
          <div className="mb-1.5">
            <audio src={message.media_url} controls className="w-full h-8" />
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        )}

        {/* Time + read receipts */}
        <div className={cn("flex items-center gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
          <span className="text-[10px] opacity-60">{timeStr}</span>
          {message.edited_at && <span className="text-[9px] opacity-50 italic">(edited)</span>}
          {isOwn && (
            readByPeer ? (
              <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
            ) : (
              <Check className="h-3.5 w-3.5 opacity-50" />
            )
          )}
        </div>

        {/* Quick reactions (on hover) */}
        {showReactions && onReaction && (
          <div className={cn(
            "absolute -top-8 flex items-center gap-0.5 bg-popover border border-border rounded-full px-1.5 py-0.5 shadow-lg z-10",
            isOwn ? "right-0" : "left-0",
          )}>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaction(message.id, emoji)}
                className="text-sm hover:scale-125 transition-transform px-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Reactions display */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((r, i) => (
              <span key={`${r.emoji}-${i}`} className="text-xs bg-background/60 rounded-full px-1.5 py-0.5 border border-border/40">
                {r.emoji} {r.count > 1 ? r.count : ""}
              </span>
            ))}
          </div>
        )}

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity",
              isOwn ? "-left-7" : "-right-7",
            )}>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? "end" : "start"} className="bg-popover border-border">
            <DropdownMenuItem onClick={() => onReply(message)}>
              <Reply className="h-3.5 w-3.5 mr-2" /> Reply
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5 mr-2" /> {copied ? "Copied!" : "Copy"}
            </DropdownMenuItem>
            {(onPin || (message as any).onPin) && (
              <DropdownMenuItem onClick={() => onPin ? onPin(message) : (message as any).onPin?.(message)}>
                <Pin className="h-3.5 w-3.5 mr-2" /> Pin
              </DropdownMenuItem>
            )}
            {(isOwn || canAdminDelete) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(message)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(message)} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
