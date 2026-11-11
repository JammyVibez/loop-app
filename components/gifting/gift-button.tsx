"use client"

import { useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Gift } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GiftModal } from "@/components/gifting/gift-modal"
import type { GiftPanelContext } from "@/components/gifting/gift-panel"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

export interface GiftRecipient {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  video_avatar_url?: string | null
  is_premium?: boolean
}

interface GiftButtonProps {
  /**
   * Everyone who could receive the gift. The viewer is removed automatically,
   * so a profile page can pass the profile and a group chat can pass its
   * participants without extra filtering at the call site.
   */
  recipients: Array<GiftRecipient | null | undefined>
  /** Context attached to the gift (post, circle post, profile, …). */
  context?: GiftPanelContext
  /** Per-recipient context, for surfaces that gift more than one person. */
  contextFor?: (recipient: GiftRecipient) => GiftPanelContext | undefined
  className?: string
  title?: string
  children?: ReactNode
  label?: string
}

function displayName(recipient: GiftRecipient) {
  return recipient.display_name || recipient.username || "this member"
}

/**
 * One reusable gifting entry point for every surface (profile, DMs, Circle
 * posts, feed cards). It owns the auth check, the modal and — for group chats,
 * where a gift must name one person — the recipient picker, so gifting is never
 * wired only into the feed.
 */
export function GiftButton({
  recipients,
  context,
  contextFor,
  className,
  title = "Send a gift",
  children,
  label,
}: GiftButtonProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [picked, setPicked] = useState<GiftRecipient | null>(null)

  const options: GiftRecipient[] = []
  const seen = new Set<string>()
  for (const recipient of recipients) {
    const id = recipient?.id ? String(recipient.id) : ""
    if (!id || id === String(user?.id || "")) continue
    if (seen.has(id)) continue
    seen.add(id)
    options.push(recipient as GiftRecipient)
  }

  if (options.length === 0) return null

  const target = picked && options.some((option) => option.id === picked.id)
    ? picked
    : options.length === 1
      ? options[0]
      : null

  const start = () => {
    if (!user) {
      toast({ title: "Sign in to send gifts", description: "You need a Loop account to send a gift." })
      router.push(`/auth?returnTo=${encodeURIComponent(pathname || "/")}`)
      return
    }
    if (options.length > 1 && !target) {
      setPickerOpen(true)
      return
    }
    setOpen(true)
  }

  const choose = (recipient: GiftRecipient) => {
    setPicked(recipient)
    setPickerOpen(false)
    setOpen(true)
  }

  const resolvedContext: GiftPanelContext | undefined = target
    ? (contextFor ? contextFor(target) : context) ?? { type: "profile", id: String(target.id) }
    : undefined

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={label ? "sm" : "icon"}
        className={className}
        title={title}
        aria-label={title}
        onClick={start}
      >
        {children || (
          <>
            <Gift className="h-4 w-4" />
            {label ? <span className="ml-1.5">{label}</span> : null}
          </>
        )}
      </Button>

      {pickerOpen && (
        <Dialog open onOpenChange={(next) => { if (!next) setPickerOpen(false) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Who is this gift for?</DialogTitle>
              <DialogDescription>Pick the person who should receive it.</DialogDescription>
            </DialogHeader>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {options.map((recipient) => (
                <button
                  key={recipient.id}
                  type="button"
                  onClick={() => choose(recipient)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={recipient.avatar_url || undefined} alt="" />
                    <AvatarFallback>{(displayName(recipient) || "L").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{displayName(recipient)}</span>
                    {recipient.username ? (
                      <span className="block truncate text-xs text-muted-foreground">@{recipient.username}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {target ? (
        <GiftModal
          open={open}
          onOpenChange={setOpen}
          recipient={{
            id: String(target.id),
            username: target.username || "user",
            display_name: displayName(target),
            avatar_url: target.avatar_url || undefined,
            video_avatar_url: target.video_avatar_url || null,
            is_premium: target.is_premium,
          }}
          context={resolvedContext}
        />
      ) : null}
    </>
  )
}
