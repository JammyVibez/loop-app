"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CornerUpRight, Search, Send } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

interface ForwardConversation {
  id: string
  is_group?: boolean
  name?: string | null
  other_user?: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
  } | null
}

interface ForwardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversations: ForwardConversation[]
  forwardingId: string | null
  onForward: (conversationId: string) => void
  onForwardNew: (username: string) => Promise<void>
}

const AVATAR_COLORS = [
  "bg-emerald-600", "bg-sky-600", "bg-violet-600", "bg-rose-600",
  "bg-amber-600", "bg-teal-600", "bg-indigo-600", "bg-pink-600",
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function ForwardDialog({
  open,
  onOpenChange,
  conversations,
  forwardingId,
  onForward,
  onForwardNew,
}: ForwardDialogProps) {
  const [query, setQuery] = useState("")
  const [busyNew, setBusyNew] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const name = c.is_group
        ? c.name || "Group"
        : `${c.other_user?.display_name || ""} ${c.other_user?.username || ""}`.trim()
      return name.toLowerCase().includes(q)
    })
  }, [conversations, query])

  const forwardToNew = async () => {
    if (!query.trim() || busyNew) return
    setBusyNew(true)
    try {
      await onForwardNew(query.trim())
      setQuery("")
    } finally {
      setBusyNew(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerUpRight className="h-4 w-4 text-sky-500" />
            Forward message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats or type a username…"
              className="rounded-full border-border bg-muted pl-9 text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim() && filtered.length === 0) void forwardToNew()
              }}
              autoFocus
            />
          </div>

          <div className="max-h-72 min-h-24 space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {query.trim()
                    ? `No existing chat for “${query.trim().replace(/^@/, "")}”.`
                    : "No chats yet."}
                </p>
                {query.trim() && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void forwardToNew()}
                    disabled={busyNew}
                  >
                    {busyNew ? (
                      <Spinner className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Forward to @{query.trim().replace(/^@/, "")}
                  </Button>
                )}
              </div>
            ) : (
              filtered.map((conversation) => {
                const displayName = conversation.is_group
                  ? conversation.name || "Group"
                  : conversation.other_user?.display_name || `@${conversation.other_user?.username || "user"}`
                const username = conversation.is_group
                  ? "Group chat"
                  : `@${conversation.other_user?.username || "user"}`
                const busy = forwardingId === conversation.id
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    disabled={Boolean(forwardingId)}
                    onClick={() => onForward(conversation.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted disabled:opacity-60"
                  >
                    <VideoAvatar src={conversation.other_user?.avatar_url} className="h-10 w-10 shrink-0" fallback="
                        {displayName.charAt(0).toUpperCase()}
                      " />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{username}</p>
                    </div>
                    {busy ? (
                      <Spinner className="h-4 w-4 shrink-0 text-sky-500" />
                    ) : (
                      <CornerUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
