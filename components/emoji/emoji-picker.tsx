"use client"

import { useMemo, useState } from "react"
import { Search } from "@/components/icons/lucide-compat"
import { Input } from "@/components/ui/input"
import { AnimatedEmoji } from "@/components/emoji/animated-emoji"
import { ANIMATED_EMOJI_ASSETS, ANIMATED_EMOJI_CATEGORIES, searchAnimatedEmoji } from "@/lib/emoji/animated-emoji"
import { cn } from "@/lib/utils"

const STANDARD_CATEGORIES = [
  {
    id: "popular",
    label: "Popular",
    emojis: ["😀", "😂", "😍", "🔥", "🚀", "✨", "❤️", "👍", "🙌", "💯", "🎉", "😎", "🥳", "⚡", "🙏", "👀"],
  },
  {
    id: "smileys",
    label: "Smileys",
    emojis: ["😊", "🥰", "😘", "😇", "🙃", "😉", "🤣", "😅", "🤔", "🤨", "😐", "😴", "😭", "😤", "😡", "🤯", "🥺", "😱"],
  },
  {
    id: "gestures",
    label: "Gestures",
    emojis: ["👋", "🤝", "👏", "🙌", "💪", "🤞", "✌️", "🫶", "👎", "👉", "👈", "☝️", "🤙", "🖐️"],
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💔", "💕", "💞", "💯"],
  },
  {
    id: "objects",
    label: "Objects",
    emojis: ["💻", "📱", "🎮", "🪙", "🎨", "🎵", "🏆", "💎", "⭐", "🔮", "💡", "🛠️", "🚀", "🌐", "📸", "🎬"],
  },
  {
    id: "nature",
    label: "Nature",
    emojis: ["🐱", "🐶", "🦊", "🦁", "🦄", "🌈", "🌸", "🍕", "🍔", "☕", "🍩", "🍷", "🍀", "🌿", "🌙", "☀️"],
  },
] as const

type Mode = "animated" | "standard"

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  className?: string
  /** Hide the animated/standard switch (used where only animations make sense). */
  animatedOnly?: boolean
  maxHeightClassName?: string
}

/**
 * Categorized, searchable emoji picker that shows Telegram-style animated
 * emoji next to the normal ones. One component serves the composer, comments,
 * DMs and Circles, so every surface behaves the same.
 */
export function EmojiPicker({
  onSelect,
  className,
  animatedOnly = false,
  maxHeightClassName = "max-h-56",
}: EmojiPickerProps) {
  const [mode, setMode] = useState<Mode>("animated")
  const [category, setCategory] = useState(ANIMATED_EMOJI_CATEGORIES[0]?.id || "smileys")
  const [search, setSearch] = useState("")
  const [preview, setPreview] = useState<string | null>(null)

  const term = search.trim().toLowerCase()

  const animated = useMemo(() => {
    if (term) return searchAnimatedEmoji(term)
    return ANIMATED_EMOJI_CATEGORIES.find((item) => item.id === category)?.emojis || []
  }, [term, category])

  const standard = useMemo(() => {
    if (term) {
      const all = STANDARD_CATEGORIES.flatMap((item) => item.emojis)
      // Emoji have no text to match, so a query matches the plain character
      // only; anything else falls back to the whole set.
      return all.filter((emoji) => emoji.includes(term))
    }
    return STANDARD_CATEGORIES.find((item) => item.id === category)?.emojis || STANDARD_CATEGORIES[0].emojis
  }, [term, category])

  const activeMode: Mode = animatedOnly ? "animated" : mode
  const categories = activeMode === "animated" ? ANIMATED_EMOJI_CATEGORIES : STANDARD_CATEGORIES

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={activeMode === "animated" ? "Search animated emoji…" : "Search emoji…"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 rounded-lg border-border bg-muted pl-8 text-xs"
          />
        </div>
        {!animatedOnly && (
          <div className="flex shrink-0 rounded-lg border border-border bg-muted p-0.5">
            {(["animated", "standard"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value)
                  setSearch("")
                  setCategory(value === "animated" ? ANIMATED_EMOJI_CATEGORIES[0]?.id || "smileys" : "popular")
                }}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors",
                  activeMode === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeMode === "animated" && (
        <div className="flex h-10 items-center gap-2 rounded-lg bg-muted/60 px-2">
          {(() => {
            const shown = preview || animated[0]
            if (!shown) return <span className="text-[10px] text-muted-foreground">Hover an emoji to preview</span>
            return (
              <>
                <AnimatedEmoji emoji={shown} size={30} format="lottie" eager />
                <span className="truncate text-[10px] font-medium text-muted-foreground">
                  {ANIMATED_EMOJI_ASSETS[shown]?.name || shown}
                </span>
              </>
            )
          })()}
        </div>
      )}

      {!term && (
        <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                category === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className={cn(maxHeightClassName, "overflow-y-auto pr-1")}>
        {activeMode === "animated" ? (
          animated.length ? (
            <div className="grid grid-cols-7 gap-1">
              {animated.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  onMouseEnter={() => setPreview(emoji)}
                  onFocus={() => setPreview(emoji)}
                  aria-label={`Insert ${emoji}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform hover:scale-110 hover:bg-muted"
                >
                  <AnimatedEmoji emoji={emoji} size={26} />
                </button>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">No animated emoji match that.</p>
          )
        ) : standard.length ? (
          <div className="grid grid-cols-7 gap-1">
            {standard.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelect(emoji)}
                aria-label={`Insert ${emoji}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">No emoji match that.</p>
        )}
      </div>
    </div>
  )
}
