"use client"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/skeletons"
import { Search, X } from "@/components/icons/lucide-compat"

interface GifPickerProps {
  open: boolean
  onClose: () => void
  search: string
  onSearchChange: (value: string) => void
  onSearchDebounced: (value: string) => void
  results: any[]
  loading: boolean
  onSelect: (gifUrl: string) => void
}

/**
 * GIF picker popover for the message composer — extracted from messages-workspace.
 * Search debounce timer is owned by the parent via onSearchDebounced.
 */
export function GifPicker({
  open,
  onClose,
  search,
  onSearchChange,
  onSearchDebounced,
  results,
  loading,
  onSelect,
}: GifPickerProps) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 cursor-default"
        aria-label="Close GIF picker"
        onClick={onClose}
      />
      <div className="absolute bottom-full left-2 z-40 mb-2 w-[340px] max-w-[calc(100%-1rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value)
              onSearchDebounced(e.target.value)
            }}
            placeholder="Search GIFs…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid max-h-64 grid-cols-3 gap-1 overflow-y-auto p-2">
          {loading ? (
            <div className="col-span-3 flex items-center justify-center py-8 text-muted-foreground">
              <Spinner className="h-5 w-5" />
            </div>
          ) : results.length === 0 ? (
            <p className="col-span-3 py-8 text-center text-xs text-muted-foreground">
              No GIFs yet — an admin can add some from the admin panel.
            </p>
          ) : (
            results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                className="group relative aspect-video overflow-hidden rounded-lg bg-muted"
                onClick={() => onSelect(gif.gif_url || gif.url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.preview_url || gif.gif_url || gif.url}
                  alt={gif.title || "GIF"}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
