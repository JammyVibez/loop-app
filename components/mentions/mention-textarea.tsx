"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { cn } from "@/lib/utils"
import { VerifiedSeal } from "@/components/ui/verified-seal"

type UserHit = {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  is_verified?: boolean
}

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  maxLength?: number
  rows?: number
  disabled?: boolean
  id?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

/**
 * Textarea that suggests users when typing @username.
 */
export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  maxLength,
  rows = 3,
  disabled,
  id,
  onKeyDown,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [hits, setHits] = useState<UserHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const mentionStart = useRef<number | null>(null)

  const detectMention = useCallback((text: string, caret: number) => {
    const before = text.slice(0, caret)
    const match = before.match(/(^|[\s([{])@([a-zA-Z0-9_]{0,30})$/)
    if (!match) {
      setQuery(null)
      setOpen(false)
      mentionStart.current = null
      return
    }
    const q = match[2] || ""
    mentionStart.current = before.length - q.length - 1
    setQuery(q)
    setOpen(true)
    setActive(0)
  }, [])

  useEffect(() => {
    if (query === null) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(query)}&limit=8`, {
          cache: "no-store",
        })
        const data = await res.json()
        if (!cancelled) setHits(data.users || [])
      } catch {
        if (!cancelled) setHits([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const t = setTimeout(run, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const insertMention = (username: string) => {
    const el = ref.current
    if (!el || mentionStart.current == null) return
    const start = mentionStart.current
    const caret = el.selectionStart
    const before = value.slice(0, start)
    const after = value.slice(caret)
    const next = `${before}@${username} ${after}`
    onChange(next)
    setOpen(false)
    setQuery(null)
    mentionStart.current = null
    requestAnimationFrame(() => {
      const pos = before.length + username.length + 2
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="relative">
      <Textarea
        id={id}
        ref={ref}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value)
          detectMention(e.target.value, e.target.selectionStart)
        }}
        onKeyUp={(e) => detectMention(value, (e.target as HTMLTextAreaElement).selectionStart)}
        onClick={(e) => detectMention(value, (e.target as HTMLTextAreaElement).selectionStart)}
        onKeyDown={(e) => {
          if (open && hits.length) {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((i) => (i + 1) % hits.length)
              return
            }
            if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => (i - 1 + hits.length) % hits.length)
              return
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault()
              insertMention(hits[active]?.username)
              return
            }
            if (e.key === "Escape") {
              setOpen(false)
              return
            }
          }
          onKeyDown?.(e)
        }}
      />

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {loading && !hits.length ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching people…</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {query ? `No users matching “${query}”` : "Type a username to tag"}
            </p>
          ) : (
            <ul className="max-h-56 overflow-auto py-1">
              {hits.map((user, i) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      i === active && "bg-muted",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      insertMention(user.username)
                    }}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>{(user.display_name || user.username || "?").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1">
                        <span className="block truncate font-medium">{user.display_name || user.username}</span>
                        {user.is_verified && <VerifiedSeal size={14} title="Verified Creator" />}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
