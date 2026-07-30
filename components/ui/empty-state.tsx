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
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-white/15 bg-gradient-to-b from-white/[0.03] to-transparent px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mx-auto mb-5 max-w-md text-sm text-slate-400">{description}</p>}
      {actionLabel && actionHref && (
        <Button asChild className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button onClick={onAction} className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
