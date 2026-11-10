"use client"

import { useCallback, useEffect, useState } from "react"
import { Ban, ShieldOff } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

interface BlockUserButtonProps {
  targetUserId: string
  targetUsername?: string
  /** Server block status can be passed in to skip the status fetch. */
  initialBlocked?: boolean
  className?: string
  /** Called after a successful block/unblock so parents can refresh. */
  onChanged?: (blocked: boolean) => void
}

/**
 * Block / Unblock control for any user surface (profile header, chat header…).
 * Blocked users can't view your profile, follow you, or DM you — but public
 * interactions (liking/replying to comments) still work, per product rules.
 */
export function BlockUserButton({
  targetUserId,
  targetUsername,
  initialBlocked,
  className,
  onChanged,
}: BlockUserButtonProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [blocked, setBlocked] = useState<boolean | null>(initialBlocked ?? null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Resolve current status when not provided by the parent.
  useEffect(() => {
    if (initialBlocked !== undefined || !user || user.id === targetUserId) return
    let mounted = true
    fetch(`/api/users/blocks/status?target_user_id=${encodeURIComponent(targetUserId)}`, {
      headers: getAuthHeader(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data) setBlocked(Boolean(data.blocked))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [targetUserId, user?.id, user, initialBlocked, getAuthHeader])

  const toggleBlock = useCallback(async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to continue." })
      return
    }
    setBusy(true)
    const nextAction = blocked ? "unblock" : "block"
    try {
      const res = await fetch("/api/users/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: targetUserId, action: nextAction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      const nextBlocked = nextAction === "block"
      setBlocked(nextBlocked)
      toast({
        title: nextBlocked ? "User blocked" : "User unblocked",
        description: nextBlocked
          ? `@${targetUsername || "user"} can no longer view your profile, follow you, or message you.`
          : `@${targetUsername || "user"} can interact with you again.`,
      })
      setConfirmOpen(false)
      onChanged?.(nextBlocked)
    } catch (err: any) {
      toast({ title: `Couldn't ${nextAction}`, description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [blocked, getAuthHeader, onChanged, targetUserId, targetUsername, toast, user])

  // Don't render on your own profile or when signed out.
  if (!user || user.id === targetUserId) return null

  const label = blocked ? "Unblock" : "Block"

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("rounded-full", className)}
        onClick={() => {
          if (blocked) {
            // Unblocking is low-stakes — no confirmation needed.
            void toggleBlock()
          } else {
            setConfirmOpen(true)
          }
        }}
        disabled={busy || blocked === null}
        aria-label={label}
      >
        {blocked ? <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> : <Ban className="mr-1.5 h-3.5 w-3.5" />}
        {label}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Block @{targetUsername || "this user"}?</DialogTitle>
            <DialogDescription>
              They won't be able to view your profile, follow you, or send you messages. You'll also stop seeing them
              in search and your inbox. They can still reply to your comments and like them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void toggleBlock()} disabled={busy}>
              {busy ? "Blocking…" : "Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
