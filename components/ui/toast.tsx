"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider

/**
 * Where notifications land.
 *
 * A gutter is kept on every edge so a toast is always a floating card rather
 * than a bar welded to the screen: full-width strips covering the page were
 * exactly what this replaced. Phones get the top (clear of the bottom nav),
 * larger screens the bottom-right corner.
 */
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed inset-x-0 top-0 z-[100] flex max-h-[100dvh] w-full flex-col items-center gap-2 p-3 sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:max-w-[400px] sm:items-end sm:p-5",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  cn(
    "group pointer-events-auto relative flex w-full max-w-[420px] items-start gap-3 overflow-hidden rounded-2xl border p-3.5 pr-9",
    "shadow-lg shadow-black/10 backdrop-blur-xl transition-all dark:shadow-black/40",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-4",
    "data-[state=open]:sm:slide-in-from-bottom-4 data-[state=closed]:sm:slide-out-to-bottom-4"
  ),
  {
    variants: {
      variant: {
        default: "border-border bg-card/95 text-card-foreground",
        // Soft tints from the palette rather than a flat block of red: the icon
        // and the tint carry the meaning together, never colour alone.
        success: "border-emerald-500/30 bg-card/95 text-card-foreground",
        error: "border-rose-500/30 bg-card/95 text-card-foreground",
        warning: "border-amber-500/30 bg-card/95 text-card-foreground",
        info: "border-sky-500/30 bg-card/95 text-card-foreground",
        // Kept so older call sites keep compiling and keep looking right.
        destructive: "border-rose-500/30 bg-card/95 text-card-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

type ToastVariant = NonNullable<VariantProps<typeof toastVariants>["variant"]>

/**
 * Icon, tint and accent per kind of notice.
 *
 * `default` deliberately uses a neutral bell rather than the old violet
 * sparkles: a generic notice that borrows the "AI/feature" sparkle reads as
 * something it isn't, and it made every untinted toast in the app look the
 * same. Callers that want a subject-specific mark (coins, gifts, live) pass
 * `icon` to `toast()` and override this.
 */
const TONE: Record<ToastVariant, { icon: LucideIcon; chip: string; ring: string }> = {
  default: { icon: Bell, chip: "bg-muted text-foreground", ring: "text-foreground" },
  success: { icon: CheckCircle2, chip: "bg-emerald-500/15 text-emerald-500", ring: "text-emerald-500" },
  error: { icon: XCircle, chip: "bg-rose-500/15 text-rose-500", ring: "text-rose-500" },
  destructive: { icon: XCircle, chip: "bg-rose-500/15 text-rose-500", ring: "text-rose-500" },
  warning: { icon: AlertTriangle, chip: "bg-amber-500/15 text-amber-500", ring: "text-amber-500" },
  info: { icon: Info, chip: "bg-sky-500/15 text-sky-500", ring: "text-sky-500" },
}

export function toastTone(variant?: ToastVariant | null) {
  return TONE[(variant || "default") as ToastVariant] ?? TONE.default
}

/** The mark that says what kind of notice this is before a word is read. */
export function ToastIcon({
  variant,
  icon,
}: {
  variant?: ToastVariant | null
  /** Call-site override — lets a specific notice say what it is about. */
  icon?: LucideIcon | null
}) {
  const tone = toastTone(variant)
  const Icon = icon || tone.icon
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        tone.chip
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-border bg-transparent px-3 text-xs font-semibold ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-full p-1 text-muted-foreground/70 opacity-0 transition-opacity hover:bg-foreground/5 hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-snug", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("mt-0.5 text-xs leading-relaxed text-muted-foreground", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  type ToastVariant,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
