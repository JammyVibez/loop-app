"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "@/components/icons/lucide-compat"
import { Input } from "@/components/ui/input"
import { AnimatedEmoji } from "@/components/emoji/animated-emoji"
import { ANIMATED_EMOJI_ASSETS, ANIMATED_EMOJI_CATEGORIES, searchAnimatedEmoji } from "@/lib/emoji/animated-emoji"
import {
  loadStandardEmoji,
  searchStandardEmoji,
  type StandardEmoji,
  type StandardEmojiGroup,
} from "@/lib/emoji/standard-emoji"
import { cn } from "@/lib/utils"

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  /** Standard Unicode emoji or the Telegram-style animated collection. */
  mode?: "standard" | "animated"
  className?: string
  maxHeightClassName?: string
}

/**
 * Categorized, searchable emoji grid. The standard mode covers the full
 * Unicode set (fetched lazily), the animated mode covers the mirrored Telegram
 * collection.
 */
export function EmojiPicker({
  onSelect,
  mode = "standard",
  className,
  maxHeightClassName = "max-h-56",
}: EmojiPickerProps) {
  const [search, setSearch] = useState("")

  if (mode === "animated") {
    return (
      <AnimatedEmojiGrid
        onSelect={onSelect}
        search={search}
        setSearch={setSearch}
        className={className}
        maxHeightClassName={maxHeightClassName}
      />
    )
  }

  return (
    <StandardEmojiGrid
      onSelect={onSelect}
      search={search}
      setSearch={setSearch}
      className={className}
      maxHeightClassName={maxHeightClassName}
    />
  )
}

interface GridProps {
  onSelect: (emoji: string) => void
  search: string
  setSearch: (value: string) => void
  className?: string
  maxHeightClassName: string
}

function StandardEmojiGrid({ onSelect, search, setSearch, className, maxHeightClassName }: GridProps) {
  const [groups, setGroups] = useState<StandardEmojiGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    loadStandardEmoji()
      .then((loaded) => {
        if (cancelled) return
        setGroups(loaded)
        setCategory((current) => current || loaded[0]?.id || "")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const term = search.trim().toLowerCase()
  const results: StandardEmoji[] = useMemo(() => {
    if (term) return searchStandardEmoji(groups, term)
    return groups.find((group) => group.id === category)?.emojis || []
  }, [groups, term, category])

  return (
    <div className={cn("space-y-2", className)}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search 1,900+ emoji…" />

      {!term && groups.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setCategory(group.id)}
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                category === group.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}

      <div className={cn(maxHeightClassName, "overflow-y-auto pr-1")}>
        {loading && results.length === 0 ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }).map((_, index) => (
              <div key={`emoji-skeleton-${index}`} className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {term ? "No emoji match that." : "Loading emoji…"}
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {results.map(([emoji, name]) => (
              <button
                key={`${emoji}-${name}`}
                type="button"
                onClick={() => onSelect(emoji)}
                aria-label={name}
                title={name}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AnimatedEmojiGrid({ onSelect, search, setSearch, className, maxHeightClassName }: GridProps) {
  const [category, setCategory] = useState(ANIMATED_EMOJI_CATEGORIES[0]?.id || "smileys")
  const [preview, setPreview] = useState<string | null>(null)
  const term = search.trim().toLowerCase()

  const emojis = useMemo(() => {
    if (term) return searchAnimatedEmoji(term)
    return ANIMATED_EMOJI_CATEGORIES.find((item) => item.id === category)?.emojis || []
  }, [term, category])

  const shown = preview && !term ? preview : emojis[0]

  return (
    <div className={cn("space-y-2", className)}>
      <SearchInput value={search} onChange={setSearch} placeholder={`Search ${Object.keys(ANIMATED_EMOJI_ASSETS).length} animated emoji…`} />

      <div className="flex h-10 items-center gap-2 rounded-lg bg-muted/60 px-2">
        {shown ? (
          <>
            <AnimatedEmoji emoji={shown} size={30} format="lottie" eager />
            <span className="truncate text-[10px] font-medium capitalize text-muted-foreground">
              {ANIMATED_EMOJI_ASSETS[shown]?.name || shown}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">Hover an emoji to preview</span>
        )}
      </div>

      {!term && (
        <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ANIMATED_EMOJI_CATEGORIES.map((item) => (
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
        {emojis.length ? (
          <div className="grid grid-cols-7 gap-1">
            {emojis.map((emoji) => (
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
        )}
      </div>
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg border-border bg-muted pl-8 text-xs"
      />
    </div>
  )
}
