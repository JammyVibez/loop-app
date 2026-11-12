"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Smile } from "lucide-react"
import { EmojiPicker } from "@/components/emoji/emoji-picker"
import { GifPicker } from "@/components/emoji/gif-picker"
import { cn } from "@/lib/utils"

interface CommentMediaPickerProps {
  onSelectEmoji: (emoji: string) => void
  onSelectGif: (url: string) => void
  onSelectSticker: (url: string) => void
  triggerClassName?: string
  align?: "start" | "center" | "end"
}

const GIF_SOURCES = [
  { id: "all", label: "All" },
  { id: "giphy", label: "Giphy" },
  { id: "klipy", label: "Klipy" },
] as const

/**
 * One media picker for every comment surface: emoji (standard + animated),
 * GIF search across Giphy/Klipy/Tenor, and Klipy's sticker catalog.
 *
 * Selected media is inserted into the comment as markdown
 * (`![GIF](url)` / `![Sticker](url)`), which RichContent renders as real
 * animated media everywhere comments appear.
 */
export function CommentMediaPicker({
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  triggerClassName,
  align = "start",
}: CommentMediaPickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState("emojis")
  const [emojiMode, setEmojiMode] = useState<"standard" | "animated">("standard")
  const [gifSource, setGifSource] = useState<(typeof GIF_SOURCES)[number]["id"]>("all")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground", triggerClassName)}
          title="Add emoji, GIF or sticker"
          aria-label="Add emoji, GIF or sticker"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side="top"
        className="w-[min(92vw,20rem)] border border-border bg-popover p-0 text-foreground shadow-2xl"
      >
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="border-b border-border px-2 pb-1 pt-2">
            <TabsList className="h-8 w-full gap-0.5 bg-muted p-0.5">
              <TabsTrigger value="emojis" className="h-7 flex-1 text-[11px]">
                Emojis
              </TabsTrigger>
              <TabsTrigger value="gifs" className="h-7 flex-1 text-[11px]">
                GIFs
              </TabsTrigger>
              <TabsTrigger value="stickers" className="h-7 flex-1 text-[11px]">
                Stickers
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="emojis" className="m-0 p-3">
            <div className="mb-2 flex gap-1 rounded-lg bg-muted p-0.5">
              {(["standard", "animated"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setEmojiMode(mode)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors",
                    emojiMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <EmojiPicker
              mode={emojiMode}
              onSelect={(emoji) => {
                onSelectEmoji(emoji)
                setOpen(false)
              }}
            />
          </TabsContent>

          <TabsContent value="gifs" className="m-0 p-3">
            <div className="mb-2 flex gap-1">
              {GIF_SOURCES.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setGifSource(provider.id)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                    gifSource === provider.id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {provider.label}
                </button>
              ))}
            </div>
            <GifPicker
              source={gifSource}
              onSelect={(gif) => {
                onSelectGif(gif.url)
                setOpen(false)
              }}
            />
          </TabsContent>

          <TabsContent value="stickers" className="m-0 p-3">
            <GifPicker
              kind="sticker"
              source="klipy"
              onSelect={(sticker) => {
                onSelectSticker(sticker.url)
                setOpen(false)
              }}
            />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
