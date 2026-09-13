"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import {
  Send,
  Image as ImageIcon,
  BarChart3,
  X,
  
} from "lucide-react"
import { DeviceMediaPicker, type PickedMedia } from "@/components/communities/device-media-picker"
import { getMediaLimit } from "@/lib/circle-limits"
import { Spinner } from "@/components/ui/skeletons"

interface StickyComposerProps {
  communityId: string
  spaces: Array<{ id: string | number; name: string; icon?: string }>
  currentUser?: {
    avatar_url?: string
    display_name?: string
    username?: string
  }
  onPostCreated?: (post: any) => void
}

export function StickyComposer({
  communityId,
  spaces,
  currentUser,
  onPostCreated,
}: StickyComposerProps) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState("")
  const [spaceId, setSpaceId] = useState<string>("")
  const [posting, setPosting] = useState(false)
  const [showPoll, setShowPoll] = useState(false)
  // Image polls: each option is { text, image_url? } — images upload from device.
  const [pollOptions, setPollOptions] = useState<Array<{ text: string; image_url?: string }>>([{ text: "" }, { text: "" }])
  const [mediaItems, setMediaItems] = useState<PickedMedia[]>([])
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mirror of the server-side caps (Free: 2 · Verified: 4 · Pro: 10).
  const maxMedia = getMediaLimit(user?.is_premium ?? false, user?.is_verified ?? false)

  const toggleMedia = () => {
    if (showPoll) {
      setShowPoll(false)
    }
    setMediaPanelOpen((v) => !v)
  }

  const togglePoll = () => {
    if (mediaItems.length > 0 || mediaPanelOpen) {
      setMediaPanelOpen(false)
    }
    setShowPoll((v) => !v)
  }

  const handlePost = async () => {
    if ((!content.trim() && mediaItems.length === 0) || posting) return
    setPosting(true)
    try {
      const payload: any = {
        content: content.trim(),
        space_id: spaceId || undefined,
        post_type: showPoll ? "poll" : "discussion",
        media_urls: mediaItems.map((m) => m.url),
        media_type: mediaItems.some((m) => m.kind === "video")
          ? "video"
          : mediaItems.length
            ? "image"
            : undefined,
      }

      if (showPoll) {
        const validOptions = pollOptions.filter((o) => o.text.trim())
        if (validOptions.length >= 2) {
          payload.poll = {
            question: content.trim(),
            options: validOptions.map((o) => ({ text: o.text.trim(), image_url: o.image_url || null })),
          }
        }
        delete payload.media_urls
        delete payload.media_type
      }

      const res = await fetch(`/api/circles/${communityId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const post = await res.json()
        setContent("")
        setSpaceId("")
        setShowPoll(false)
        setPollOptions([{ text: "" }, { text: "" }])
        setMediaItems([])
        setMediaPanelOpen(false)
        setExpanded(false)
        onPostCreated?.(post)
      }
    } catch { /* intentionally silent */ }
    setPosting(false)
  }

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, { text: "" }])
    }
  }

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index))
    }
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all",
        expanded && "shadow-lg"
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={currentUser?.avatar_url || ""} alt="" />
            <AvatarFallback className="text-xs font-bold">
              {(currentUser?.display_name || currentUser?.username || "U").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setExpanded(true)}
              placeholder="Share something with the community..."
              className="min-h-[44px] max-h-40 resize-none border-0 bg-muted/50 px-4 py-3 text-sm focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-2xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handlePost()
                }
              }}
            />

            {expanded && (
              <div className="mt-3 space-y-3">
                {/* Space selector */}
                {spaces.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Space:</span>
                    <select
                      value={spaceId}
                      onChange={(e) => setSpaceId(e.target.value)}
                      className="h-7 rounded-lg border border-input bg-background px-2 text-[11px]"
                    >
                      <option value="">No specific space</option>
                      {spaces.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Media upload — pick from device, preview, reorder, remove */}
                {(mediaItems.length > 0 || mediaPanelOpen) && !showPoll && (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-fuchsia-500" /> Media
                      </span>
                      {mediaItems.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => {
                            setMediaItems([])
                            setMediaPanelOpen(false)
                          }}
                        >
                          <X className="h-3 w-3 mr-1" /> Remove all
                        </Button>
                      )}
                    </div>
                    <DeviceMediaPicker
                      items={mediaItems}
                      onChange={setMediaItems}
                      maxItems={maxMedia}
                      folder="community-posts"
                    />
                  </div>
                )}

                {/* Poll options */}
                {showPoll && (
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Poll Options</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => setShowPoll(false)}
                      >
                        <X className="h-3 w-3 mr-1" /> Remove poll
                      </Button>
                    </div>
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                          <input
                            value={opt.text}
                            onChange={(e) => {
                              const next = [...pollOptions]
                              next[i] = { ...next[i], text: e.target.value }
                              setPollOptions(next)
                            }}
                            placeholder={`Option ${i + 1}`}
                            className="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 text-xs"
                          />
                          {pollOptions.length > 2 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removePollOption(i)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {/* Image polls: attach an image to this option */}
                        <DeviceMediaPicker
                          items={opt.image_url ? [{ url: opt.image_url, kind: "image" }] : []}
                          onChange={(items) => {
                            const next = [...pollOptions]
                            next[i] = { ...next[i], image_url: items[0]?.url || undefined }
                            setPollOptions(next)
                          }}
                          maxItems={1}
                          accept="image/*"
                          compact
                          folder="community-poll-media"
                        />
                      </div>
                    ))}
                    {pollOptions.length < 6 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] text-muted-foreground"
                        onClick={addPollOption}
                      >
                        + Add option
                      </Button>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-8 w-8", showPoll && "text-amber-500 bg-amber-500/10")}
                      onClick={togglePoll}
                      title="Add poll"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        (mediaItems.length > 0 || mediaPanelOpen) && "text-fuchsia-500 bg-fuchsia-500/10"
                      )}
                      onClick={toggleMedia}
                      title="Upload images or video from your device"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to post
                    </span>
                    <Button
                      size="sm"
                      className="rounded-full h-8 px-4"
                      disabled={(!content.trim() && mediaItems.length === 0) || posting}
                      onClick={handlePost}
                    >
                      {posting ? (
                        <Spinner className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Send className="h-3.5 w-3.5 mr-1" />
                      )}
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
