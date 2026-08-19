"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn, Zap, UserPlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { loginHref } from "@/lib/guest"
import { useAuth } from "@/hooks/use-auth"

type GateReason =
  | "like"
  | "save"
  | "comment"
  | "follow"
  | "gift"
  | "post"
  | "branch"
  | "message"
  | "claim"
  | "join"
  | "submit"
  | "default"

const REASON_COPY: Record<GateReason, { title: string; body: string }> = {
  like: { title: "Sign in to like", body: "Join Loop to like posts and build your feed." },
  save: { title: "Sign in to save", body: "Bookmarks stay with your account across devices." },
  comment: { title: "Sign in to reply", body: "Join the conversation — create a free account in seconds." },
  follow: { title: "Sign in to follow", body: "Follow creators so their loops show up in Following." },
  gift: { title: "Sign in to gift", body: "Send coins and gifts once you’re logged in." },
  post: { title: "Sign in to post", body: "Create loops, code posts, and share with the community." },
  branch: { title: "Sign in to branch", body: "Remix and fork loops after you create an account." },
  message: { title: "Sign in to message", body: "DMs are for members — log in to start chatting." },
  claim: { title: "Sign in to claim", body: "Daily coins and rewards need an account." },
  join: { title: "Sign in to join", body: "Communities and circles are ready after you log in." },
  submit: { title: "Sign in to submit", body: "Dev Quest entries are tied to your account so bounties land in your wallet." },
  default: { title: "Sign in to continue", body: "Browse freely as a guest — interact after you join." },
}

/**
 * Require auth for interactive actions. Opens an in-app login dialog (or returns false).
 */
export function useLoginGate() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<GateReason>("default")

  const requireAuth = useCallback(
    (gateReason: GateReason = "default") => {
      if (user) return true
      setReason(gateReason)
      setOpen(true)
      return false
    },
    [user],
  )

  const copy = REASON_COPY[reason] || REASON_COPY.default
  const href = loginHref(pathname, reason)

  const LoginGateDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md overflow-hidden border-border/70 sm:rounded-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sky-500/15 to-transparent" />
        <DialogHeader className="relative space-y-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-lg shadow-sky-500/20">
            <Zap className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {copy.body} You can keep browsing profiles, loops, and explore without an account.
          </DialogDescription>
        </DialogHeader>
        <div className="relative mt-2 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1 rounded-full">
            <Link href={href}>
              <LogIn className="mr-2 h-4 w-4" />
              Log in
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 rounded-full">
            <Link href={`/signup?redirect=${encodeURIComponent(pathname || "/")}`}>
              <UserPlus className="mr-2 h-4 w-4" />
              Sign up free
            </Link>
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-1 text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Keep exploring as guest
        </button>
      </DialogContent>
    </Dialog>
  )

  return { requireAuth, isGuest: !user, LoginGateDialog }
}
