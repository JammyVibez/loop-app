"use client"

import { Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
  /** Gradient theme for the CTA button */
  theme?: "primary" | "messaging" | "social" | "commerce" | "creative"
}

const themeGradients = {
  primary: "bg-gradient-to-r from-violet-600 to-teal-500",
  messaging: "bg-gradient-to-r from-sky-500 to-indigo-600",
  social: "bg-gradient-to-r from-rose-500 to-amber-500",
  commerce: "bg-gradient-to-r from-emerald-500 to-cyan-500",
  creative: "bg-gradient-to-r from-fuchsia-500 to-orange-500",
}

/**
 * Preset empty states with contextual copy.
 * Use these instead of hand-writing "No {thing} yet — add your first one above" everywhere.
 */
export const emptyPresets = {
  posts: {
    title: "Nothing here yet",
    description: "When posts show up, they'll appear right here.",
    icon: "post",
  },
  messages: {
    title: "Start a conversation",
    description: "Send a message to get things going.",
    icon: "message",
  },
  followers: {
    title: "No followers yet",
    description: "People who follow you will show up here.",
    icon: "users",
  },
  notifications: {
    title: "You're all caught up",
    description: "New activity will appear here.",
    icon: "bell",
  },
  search: {
    title: "No results found",
    description: "Try a different search term or browse instead.",
    icon: "search",
  },
  media: {
    title: "No media yet",
    description: "Photos and videos you share will show up here.",
    icon: "image",
  },
  comments: {
    title: "No comments yet",
    description: "Be the first to share your thoughts.",
    icon: "comment",
  },
  saved: {
    title: "Nothing saved yet",
    description: "Save posts to revisit them later.",
    icon: "bookmark",
  },
  communities: {
    title: "Discover communities",
    description: "Join communities to connect with people who share your interests.",
    icon: "group",
  },
  awards: {
    title: "No awards yet",
    description: "Awards you receive will appear here.",
    icon: "award",
  },
  drafts: {
    title: "No drafts saved",
    description: "Your unfinished posts will be stored here.",
    icon: "draft",
  },
} as const

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  actionHref,
  onAction,
  className,
  theme = "primary",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-white/15 bg-gradient-to-b from-white/[0.03] to-transparent px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mx-auto mb-5 max-w-md text-sm text-slate-400">{description}</p>}
      {actionLabel && actionHref && (
        <Button asChild className={cn("rounded-full text-white", themeGradients[theme])}>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button onClick={onAction} className={cn("rounded-full text-white", themeGradients[theme])}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
