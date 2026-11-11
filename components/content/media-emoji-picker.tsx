"use client"

import { useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Smile } from "@/components/icons/lucide-compat"
import { EmojiPicker } from "@/components/emoji/emoji-picker"
import { GifPicker } from "@/components/emoji/gif-picker"

interface MediaEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void
  onSelectGif?: (url: string) => void
  onSelectSticker?: (url: string) => void
  triggerClassName?: string
  isPro?: boolean
}

const STICKER_PACKS = [
  {
    packName: "Loop Mascot",
    stickers: [
      { name: "Loop Wave", url: "https://api.dicebear.com/7.x/bottts/svg?seed=LoopWave" },
      { name: "Loop Hype", url: "https://api.dicebear.com/7.x/bottts/svg?seed=LoopHype" },
      { name: "Loop Cool", url: "https://api.dicebear.com/7.x/bottts/svg?seed=LoopCool" },
      { name: "Loop Love", url: "https://api.dicebear.com/7.x/bottts/svg?seed=LoopLove" },
    ],
  },
  {
    packName: "Cyberpunk Badges",
    stickers: [
      { name: "Pro Gamer", url: "https://api.dicebear.com/7.x/shapes/svg?seed=CyberGamer" },
      { name: "Neon Glow", url: "https://api.dicebear.com/7.x/shapes/svg?seed=NeonGlow" },
      { name: "Code Wizard", url: "https://api.dicebear.com/7.x/shapes/svg?seed=CodeWizard" },
      { name: "Co-Loop Hero", url: "https://api.dicebear.com/7.x/shapes/svg?seed=CoLoopHero" },
    ],
  },
]

export function MediaEmojiPicker({
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  triggerClassName = "",
  isPro = false,
}: MediaEmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("emojis")
  const [curatedEmojis, setCuratedEmojis] = useState<Array<{ shortcode: string; url: string; category?: string }>>([])
  const [loadingCurated, setLoadingCurated] = useState(false)

  // Load curated emojis when picker opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingCurated(true)
    fetch("/api/curated-emojis", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.emojis) setCuratedEmojis(data.emojis)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCurated(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const insertEmoji = (emoji: string) => {
    onSelectEmoji(emoji)
    setOpen(false)
  }

  // Every surface can render markdown media, so a GIF falls back to that when
  // the caller doesn't have a dedicated attachment slot.
  const insertGif = (url: string) => {
    if (onSelectGif) onSelectGif(url)
    else onSelectEmoji(` ![GIF](${url}) `)
    setOpen(false)
  }

  const insertSticker = (url: string) => {
    if (onSelectSticker) onSelectSticker(url)
    else onSelectEmoji(` ![Sticker](${url}) `)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 rounded-full p-0 text-muted-foreground hover:text-primary hover:bg-muted ${triggerClassName}`}
          title="Add Emoji, GIF or Sticker"
          aria-label="Add emoji, GIF or sticker"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 border border-border bg-card p-0 text-foreground shadow-2xl backdrop-blur-md">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border px-2 pt-2 pb-1">
            <TabsList className="h-8 w-full justify-start gap-0.5 bg-muted p-0.5">
              <TabsTrigger value="emojis" className="h-7 flex-1 px-1 text-[11px]">
                Emoji
              </TabsTrigger>
              <TabsTrigger value="animated" className="h-7 flex-1 px-1 text-[11px]">
                Animated
              </TabsTrigger>
              <TabsTrigger value="gifs" className="h-7 flex-1 px-1 text-[11px]">
                GIF
              </TabsTrigger>
              <TabsTrigger value="stickers" className="h-7 flex-1 px-1 text-[11px]" disabled={!isPro}>
                Sticker
              </TabsTrigger>
              <TabsTrigger value="custom" className="h-7 flex-1 px-1 text-[11px]" disabled={!isPro}>
                More
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="emojis" className="m-0 p-3">
            <EmojiPicker mode="standard" onSelect={insertEmoji} />
          </TabsContent>

          <TabsContent value="animated" className="m-0 p-3">
            <EmojiPicker mode="animated" onSelect={insertEmoji} />
          </TabsContent>

          <TabsContent value="gifs" className="m-0 p-3">
            <GifPicker onSelect={(gif) => insertGif(gif.url)} />
          </TabsContent>

          <TabsContent value="custom" className="m-0 space-y-3 p-3">
            {loadingCurated ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Loading custom emojis...</p>
            ) : curatedEmojis.length === 0 ? (
              <div className="space-y-2 py-6 text-center">
                <p className="text-xs text-muted-foreground">No custom emojis yet</p>
                <p className="text-[10px] text-muted-foreground/60">Pro users can request custom emojis from admin</p>
              </div>
            ) : (
              <div className="grid max-h-60 grid-cols-5 gap-2 overflow-y-auto pr-1">
                {curatedEmojis.map((emoji) => (
                  <button
                    key={emoji.shortcode}
                    type="button"
                    onClick={() => insertSticker(emoji.url)}
                    className="group flex flex-col items-center justify-center rounded-xl border border-border p-2 transition-all hover:border-primary hover:bg-primary/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={emoji.url} alt={emoji.shortcode} className="h-8 w-8 object-contain transition-transform group-hover:scale-110" />
                    <span className="mt-1 w-full truncate text-center text-[8px] text-muted-foreground">:{emoji.shortcode}:</span>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stickers" className="m-0 space-y-3 p-3">
            <div className="max-h-60 space-y-4 overflow-y-auto pr-1">
              {STICKER_PACKS.map((pack) => (
                <div key={pack.packName}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">{pack.packName}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {pack.stickers.map((sticker) => (
                      <button
                        key={sticker.name}
                        type="button"
                        onClick={() => insertSticker(sticker.url)}
                        className="group flex flex-col items-center justify-center rounded-xl border border-border p-2 transition-all hover:border-primary hover:bg-cyan-500/10"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sticker.url} alt={sticker.name} className="h-10 w-10 object-contain transition-transform group-hover:scale-110" />
                        <span className="mt-1 w-full truncate text-center text-[9px] text-muted-foreground">{sticker.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
