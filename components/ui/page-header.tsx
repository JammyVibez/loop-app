import type { ComponentType, ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared page chrome.
 *
 * The app had grown a different, louder hero on every surface (gradient
 * headlines, 30px radii, three accent colours per screen). These primitives
 * keep the heading, supporting copy and actions on the same grid so pages read
 * as one product: one eyebrow, one title, one line of context, actions right.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** Small metric block used in page summaries and post analytics. */
export function StatTile({
  label,
  value,
  hint,
  progress,
  icon: Icon,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** 0–100; renders a hairline progress track under the hint. */
  progress?: number
  icon?: ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
      </div>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      {typeof progress === "number" ? (
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground/75 transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Surface — the one card treatment.
 *
 * Use this instead of hand-rolling `rounded-2xl border border-border/40
 * bg-slate-900/60 shadow-xl`. Radius, border, background and padding all come
 * from the token layer, so every panel on every page matches.
 */
export function Surface({
  as: Tag = "div",
  tone = "default",
  padded = true,
  id,
  className,
  children,
}: {
  as?: "div" | "section" | "article" | "aside" | "li"
  tone?: "default" | "muted" | "plain"
  padded?: boolean
  id?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "rounded-xl border border-border/70",
        tone === "default" && "bg-card",
        tone === "muted" && "bg-muted/40",
        tone === "plain" && "bg-transparent",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </Tag>
  )
}

/**
 * EmptyState — specific, product-native copy instead of “Nothing here yet”.
 * Every empty state names the surface, what will appear, and the next action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </span>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Section label inside a page body. */
export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
