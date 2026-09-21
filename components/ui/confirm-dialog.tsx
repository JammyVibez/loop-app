"use client"

/**
 * The app's confirmation sheet, in two shapes.
 *
 * `ConfirmDialog` is the controlled component for callers that already track
 * their own open state. `confirmDialog()` is the imperative one for the far
 * more common case — a delete handler deep inside a menu — and replaces
 * `window.confirm`, which is unbranded, unstyleable, shows the origin URL on
 * iOS and is blocked outright by some in-app browsers.
 *
 *   if (!(await confirmDialog({ title: "Delete this?", destructive: true }))) return
 *
 * The imperative host is mounted once in the root layout, which is why no
 * component in between has to become a provider.
 */

import { useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-popover text-foreground sm:max-w-md">
        <AlertDialogHeader className="gap-3">
          <div className="flex items-center gap-2.5">
            {destructive ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
                <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden />
              </span>
            ) : null}
            <AlertDialogTitle className="text-base leading-snug">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="rounded-full border-border bg-muted text-foreground">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn("rounded-full", destructive ? "bg-rose-600 hover:bg-rose-500" : "bg-violet-600 hover:bg-violet-500")}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ── Imperative form ────────────────────────────────────────────────────── */

export interface ConfirmOptions {
  /** The question, in the imperative: "Delete this thread?" */
  title: string
  /** What will happen, in plain words. */
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Colour the confirm button as a destructive action. */
  destructive?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  id: number
  resolve: (value: boolean) => void
}

let pending: PendingConfirm | null = null
const listeners = new Set<(state: PendingConfirm | null) => void>()
let counter = 0

function publish() {
  for (const listener of listeners) listener(pending)
}

/**
 * Ask the user to confirm something. Resolves `true` only when they accept —
 * dismissing with Escape or the backdrop counts as a no.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // A second question while one is open would leave the first promise hanging
  // forever, so the older one is answered "no".
  pending?.resolve(false)

  return new Promise<boolean>((resolve) => {
    counter += 1
    pending = { ...options, id: counter, resolve }
    publish()
  })
}

function settle(value: boolean) {
  const current = pending
  pending = null
  publish()
  current?.resolve(value)
}

/** Mounted once, in the root layout. */
export function ConfirmDialogHost() {
  const [state, setState] = useState<PendingConfirm | null>(pending)

  useEffect(() => {
    listeners.add(setState)
    setState(pending)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return (
    <AlertDialog
      open={Boolean(state)}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
    >
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-card text-card-foreground sm:max-w-md">
        <AlertDialogHeader className="gap-3">
          <div className="flex items-center gap-2.5">
            {state?.destructive ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
                <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden />
              </span>
            ) : null}
            <AlertDialogTitle className="text-base leading-snug">{state?.title}</AlertDialogTitle>
          </div>
          {state?.description ? (
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {state.description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel
            className="rounded-full"
            onClick={(event) => {
              event.preventDefault()
              settle(false)
            }}
          >
            {state?.cancelLabel || "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              "rounded-full",
              state?.destructive && "bg-rose-600 text-white hover:bg-rose-500",
            )}
            onClick={(event) => {
              event.preventDefault()
              settle(true)
            }}
          >
            {state?.confirmLabel || (state?.destructive ? "Delete" : "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
