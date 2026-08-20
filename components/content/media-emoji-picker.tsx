"use client"

import React, { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Smile, Image as ImageIcon, Zap, Search } from "lucide-react"

interface MediaEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void
  onSelectGif?: (url: string) => void
  onSelectSticker?: (url: string) => void
  triggerClassName?: string
  isPro?: boolean
}

const EMOJI_CATEGORIES = [
  {
    name: "Popular",
    emojis: ["😀", "😂", "😍", "🔥", "🚀", "✨", "❤️", "👍", "🙌", "💯", "🎉", "😎", "🥳", "⚡"],
  },
  {
    name: "Reactions",
    emojis: ["👏", "🤔", "🤯", "😭", "😴", "👀", "🙈", "💀", "💩", "🤮", "🤩", "💖", "🙏", "💪"],
  },
  {
    name: "Objects & Tech",
    emojis: ["💻", "📱", "🎮", "🪙", "🎨", "🎵", "🏆", "💎", "⭐", "🔮", "💡", "🛠️", "🚀", "🌐"],
  },
  {
    name: "Nature & Animals",
    emojis: ["🐱", "🐶", "🦊", "🦁", "🦄", "🌈", "🌸", "🍕", "🍔", "☕", "🍩", "🍷", "🍀", "🌿"],
  },
]

const SAMPLE_GIFS = [
  { title: "Mind Blown", url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif" },
  { title: "Celebration", url: "https://media.giphy.com/media/l0AM41lC46985qEww/giphy.gif" },
  { title: "Applause", url: "https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif" },
  { title: "Cat Vibe", url: "https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif" },
  { title: "Dance", url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif" },
  { title: "High Five", url: "https://media.giphy.com/media/l0ErFaf42tKm055OM/giphy.gif" },
  { title: "Popcorn", url: "https://media.giphy.com/media/hVTouq08y8Rs54l13h/giphy.gif" },
  { title: "Coding", url: "https://media.giphy.com/media/13Hgw8T855CpYX/giphy.gif" },
]

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
  const [search, setSearch] = useState("")
  const [gifSearch, setGifSearch] = useState("")
  const [gifsList, setGifsList] = useState<any[]>(SAMPLE_GIFS)
  const [loadingGifs, setLoadingGifs] = useState(false)
  const [gifSource, setGifSource] = useState<"all" | "tenor" | "giphy">("all")
  const [limit, setLimit] = useState(24)
  const [curatedEmojis, setCuratedEmojis] = useState<Array<{ shortcode: string; url: string; category?: string }>>([])
  const [loadingCurated, setLoadingCurated] = useState(false)

  // Load curated emojis when picker opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingCurated(true)
    fetch('/api/curated-emojis', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.emojis) setCuratedEmojis(data.emojis)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingCurated(false) })
    return () => { cancelled = true }
  }, [open])

  // Load the admin-curated GIF library on mount + whenever the picker opens,
  // so new GIFs added from the admin panel show up without a page reload.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingGifs(true)
    fetch(`/api/gifs?limit=24`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.success && Array.isArray(data.results) && data.results.length) {
          setGifsList(
            data.results.map((r: any) => ({
              title: r.title || "GIF",
              url: r.gif_url || r.url || null,
              preview: r.preview_url || r.gif_url || r.url || null,
            })),
          )
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingGifs(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const proxied = (src?: string | null): string | undefined => {
    if (!src) return undefined
    return src.startsWith("http") ? `/api/image-proxy?url=${encodeURIComponent(src)}` : src
  }

  const searchGifs = async (query: string) => {
    setGifSearch(query)
    if (!query.trim()) {
      setGifsList(SAMPLE_GIFS)
      return
    }

    setLoadingGifs(true)
    try {
      const params = new URLSearchParams({ q: query, limit: String(limit) })
      if (gifSource && gifSource !== "all") params.set("source", gifSource)
      const res = await fetch(`/api/gifs?${params.toString()}`)
      if (!res.ok) throw new Error("GIF search failed")
      const data = await res.json()
      if (data?.success && Array.isArray(data.results) && data.results.length) {
        // Normalize results to { title, preview, url }
        const formatted = data.results.map((r: any) => ({
          title: r.title || r.id || "GIF",
          url: r.gif_url || r.gifUrl || r.preview_url || r.url || r.preview || null,
          preview: r.preview_url || r.preview || (r.gif_url ? r.gif_url : null),
        }))
        setGifsList(formatted)
        return
      }

      // Fallback local filter
      const filtered = SAMPLE_GIFS.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()))
      setGifsList(filtered.length ? filtered : SAMPLE_GIFS)
    } catch (err) {
      console.error("GIF search error:", err)
      // Fallback to sample gifs
      setGifsList(SAMPLE_GIFS)
    } finally {
      setLoadingGifs(false)
    }
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
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0 border border-border bg-card backdrop-blur-md text-foreground shadow-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between border-b border-border px-3 pt-2 pb-1">
            <TabsList className="bg-muted p-0.5 h-8">
              <TabsTrigger value="emojis" className="text-xs px-2.5 h-7">
                <Smile className="h-3.5 w-3.5 mr-1" /> Emoji
              </TabsTrigger>
              <TabsTrigger value="gifs" className="text-xs px-2.5 h-7">
                <ImageIcon className="h-3.5 w-3.5 mr-1" /> GIF
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs px-2.5 h-7" disabled={!isPro}>
                <Zap className="h-3.5 w-3.5 mr-1" /> Custom{!isPro && " (Pro)"}
              </TabsTrigger>
              <TabsTrigger value="stickers" className="text-xs px-2.5 h-7" disabled={!isPro}>
                <Zap className="h-3.5 w-3.5 mr-1" /> Sticker{!isPro && " (Pro)"}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Emojis Tab */}
          <TabsContent value="emojis" className="p-3 m-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search emojis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground rounded-lg"
              />
            </div>
            <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
              {EMOJI_CATEGORIES.map((cat) => {
                const filtered = cat.emojis.filter((e) => !search || e.includes(search))
                if (filtered.length === 0) return null
                return (
                  <div key={cat.name}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{cat.name}</p>
                    <div className="grid grid-cols-7 gap-1">
                      {filtered.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            onSelectEmoji(emoji)
                            setOpen(false)
                          }}
                          className="h-8 w-8 rounded-lg hover:bg-muted text-lg flex items-center justify-center transition-transform hover:scale-110"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          {/* GIFs Tab */}
          <TabsContent value="gifs" className="p-3 m-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search GIFs via Tenor/Giphy..."
                  value={gifSearch}
                  onChange={(e) => searchGifs(e.target.value)}
                  className="pl-8 h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground rounded-lg"
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setGifSource("all")}
                  className={`px-2 py-1 text-[11px] rounded ${gifSource === "all" ? "bg-muted" : "bg-transparent"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setGifSource("tenor")}
                  className={`px-2 py-1 text-[11px] rounded ${gifSource === "tenor" ? "bg-muted" : "bg-transparent"}`}
                >
                  Tenor
                </button>
                <button
                  type="button"
                  onClick={() => setGifSource("giphy")}
                  className={`px-2 py-1 text-[11px] rounded ${gifSource === "giphy" ? "bg-muted" : "bg-transparent"}`}
                >
                  Giphy
                </button>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
              {loadingGifs ? (
                <div className="col-span-2 py-8 text-center text-xs text-muted-foreground">Searching GIFs...</div>
              ) : (
                gifsList.map((gif, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const chosen = gif.url || gif.preview || gif.url
                      if (onSelectGif) {
                        onSelectGif(chosen)
                      } else {
                        onSelectEmoji(` ![GIF](${chosen}) `)
                      }
                      setOpen(false)
                    }}
                    className="relative group rounded-lg overflow-hidden border border-border hover:border-primary transition-all h-20 bg-slate-900"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={proxied(gif.preview || gif.url)} alt={gif.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white p-0.5 truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {gif.title}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-muted-foreground">Showing {gifsList.length} results</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLimit((l) => Math.max(6, l - 6))}
                  className="text-[11px] px-2 py-1 rounded bg-muted"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => setLimit((l) => Math.min(48, l + 6))}
                  className="text-[11px] px-2 py-1 rounded bg-muted"
                >
                  ▶
                </button>
              </div>
            </div>
          </TabsContent>

          {/* Custom Emojis Tab (Curated by admin) */}
          <TabsContent value="custom" className="p-3 m-0 space-y-3">
            {loadingCurated ? (
              <p className="text-xs text-center text-muted-foreground py-4">Loading custom emojis...</p>
            ) : curatedEmojis.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs text-muted-foreground">No custom emojis yet</p>
                <p className="text-[10px] text-muted-foreground/60">Pro users can request custom emojis from admin</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
                {curatedEmojis.filter(e => !search || e.shortcode.toLowerCase().includes(search.toLowerCase())).map((emoji) => (
                  <button
                    key={emoji.shortcode}
                    type="button"
                    onClick={() => {
                      onSelectGif ? onSelectGif(emoji.url) : onSelectEmoji(` ![Emoji](${emoji.url}) `)
                      setOpen(false)
                    }}
                    className="group flex flex-col items-center justify-center p-2 rounded-xl border border-border hover:border-primary hover:bg-primary/10 transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={emoji.url} alt={emoji.shortcode} className="h-8 w-8 object-contain group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] text-muted-foreground mt-1 truncate w-full text-center">:{emoji.shortcode}:</span>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Stickers Tab — Pro users only */}
          <TabsContent value="stickers" className="p-3 m-0 space-y-3">
            {/* Pro-only gate for stickers will be applied via CSS — full gate in actual prod */}
            <div className="max-h-60 overflow-y-auto space-y-4 pr-1">
              {STICKER_PACKS.map((pack) => (
                <div key={pack.packName}>
                  <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">{pack.packName}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {pack.stickers.map((sticker) => (
                      <button
                        key={sticker.name}
                        type="button"
                        onClick={() => {
                          if (onSelectSticker) {
                            onSelectSticker(sticker.url)
                          } else {
                            onSelectEmoji(` ![Sticker: ${sticker.name}](${sticker.url}) `)
                          }
                          setOpen(false)
                        }}
                        className="group flex flex-col items-center justify-center p-2 rounded-xl border border-border hover:border-primary hover:bg-cyan-500/10 transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sticker.url} alt={sticker.name} className="h-10 w-10 object-contain group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">{sticker.name}</span>
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
