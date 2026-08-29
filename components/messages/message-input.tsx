"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { MediaEmojiPicker } from "@/components/content/media-emoji-picker"
import {
  Send,
  Mic,
  Camera,
  ImagePlus,
  Smile,
  Gift,
  Sticker,
  CornerUpRight,
  X,
  Zap,
  Loader2,
} from "lucide-react"

interface MessageInputProps {
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  onSendMedia: (type: "image" | "video") => void
  onVoiceToggle: () => void
  onEmojiToggle: () => void
  onGifToggle: () => void
  onGiftToggle: () => void
  onCoLoopToggle?: () => void
  sending: boolean
  recording: boolean
  recordingDuration: number
  replyTo?: any | null
  onCancelReply?: () => void
  editingMessage?: any | null
  editDraft?: string
  onEditDraftChange?: (value: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  savingEdit?: boolean
  uploading?: boolean
  showCoLoop?: boolean
  fileRef?: React.RefObject<HTMLInputElement | null>
  cameraFileRef?: React.RefObject<HTMLInputElement | null>
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function MessageInput({
  draft,
  onDraftChange,
  onSend,
  onSendMedia,
  onVoiceToggle,
  onEmojiToggle,
  onGifToggle,
  onGiftToggle,
  onCoLoopToggle,
  sending,
  recording,
  recordingDuration,
  replyTo,
  onCancelReply,
  editingMessage,
  editDraft,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  savingEdit,
  uploading,
  showCoLoop,
  fileRef,
  cameraFileRef,
}: MessageInputProps) {
  const isEditing = !!editingMessage

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-md px-3 py-2 space-y-2">
      {/* Reply preview bar */}
      {replyTo && onCancelReply && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 text-xs">
          <CornerUpRight className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[10px] text-primary">
              Replying to {replyTo.sender?.display_name || "message"}
            </p>
            <p className="text-muted-foreground truncate">{replyTo.content || "Media"}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onCancelReply}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Edit mode */}
      {isEditing && onCancelEdit && (
        <div className="flex items-center gap-2 bg-amber-500/10 rounded-xl px-3 py-2 text-xs border border-amber-500/20">
          <p className="text-amber-600 font-semibold text-[10px]">Editing message</p>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onCancelEdit}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-6 text-[10px]"
            onClick={onSaveEdit}
            disabled={savingEdit}
          >
            {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Media buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onSendMedia(f.type.startsWith("video") ? "video" : "image")
              e.target.value = ""
            }}
          />
          <input
            ref={cameraFileRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onSendMedia(f.type.startsWith("video") ? "video" : "image")
              e.target.value = ""
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileRef?.current?.click()}
            disabled={uploading}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => cameraFileRef?.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          {isEditing ? (
            <Textarea
              value={editDraft || ""}
              onChange={(e) => onEditDraftChange?.(e.target.value)}
              placeholder="Edit message..."
              className="min-h-[38px] max-h-[120px] text-sm resize-none pr-20"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSaveEdit?.()
                }
                if (e.key === "Escape") onCancelEdit?.()
              }}
            />
          ) : (
            <MentionTextarea
              value={draft}
              onChange={onDraftChange}
              placeholder="Type a message..."
              className="min-h-[38px] max-h-[120px] text-sm resize-none"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSend()
                }
              }}
            />
          )}

          {/* Inside-input buttons */}
          <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEmojiToggle}>
              <Smile className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onGifToggle}>
              <Sticker className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onGiftToggle}>
            <Gift className="h-4 w-4 text-amber-500" />
          </Button>
          {onCoLoopToggle && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", showCoLoop && "text-cyan-500")}
              onClick={onCoLoopToggle}
            >
              <Zap className="h-4 w-4" />
            </Button>
          )}

          {/* Voice / Send */}
          {draft.trim() || isEditing ? (
            <Button
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={isEditing ? onSaveEdit : onSend}
              disabled={sending || (!isEditing && !draft.trim())}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", recording && "text-rose-500 animate-pulse")}
              onClick={onVoiceToggle}
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Recording indicator */}
      {recording && (
        <div className="flex items-center gap-2 text-rose-500 text-xs animate-pulse">
          <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="font-semibold">Recording {formatDuration(recordingDuration)}</span>
          <span className="text-muted-foreground text-[10px]">Tap mic to stop</span>
        </div>
      )}
    </div>
  )
}
