"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Reply, Send, MessageCircle, X } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

type QuickReplyTarget = { kind: "dm" | "comment"; key: string }

/**
 * Lets you answer straight from the notification — no navigation needed.
 *  - message notifications → quick DM back to that conversation
 *  - comment / reply notifications → quick comment on the loop (threaded
 *    when the notification was itself a reply)
 * Everything posts through the normal authenticated APIs, so privacy rules,
 * blocking and real-time delivery all still apply.
 */
export function NotificationQuickReply({ notification, compact }: { notification: any; compact?: boolean }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  if (!user) return null

  const data = notification?.data || {}
  const type = notification?.type || ""

  let target: QuickReplyTarget | null = null
  if (type === "message" && data.conversation_id) {
    target = { kind: "dm", key: String(data.conversation_id) }
  } else if ((type === "comment" || type === "reply") && data.loop_id) {
    target = { kind: "comment", key: String(data.loop_id) }
  }
  if (!target) return null

  const send = async () => {
    const content = text.trim()
    if (!content) return
    setSending(true)
    try {
      const res = await fetch(target!.kind === "dm" ? "/api/messages" : `/api/loops/${target!.key}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          target!.kind === "dm"
            ? { conversation_id: target!.key, content }
            : {
                content,
                parent_comment_id: type === "reply" && data.parent_comment_id ? String(data.parent_comment_id) : undefined,
              }
        ),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || "Couldn't send")
      toast({ title: target!.kind === "dm" ? "Message sent" : "Reply posted" })
      setText("")
      setOpen(false)
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e.message || "Please try again", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const placeholder =
    target.kind === "dm" ? "Reply to this message…" : type === "reply" ? "Reply to this comment…" : "Comment on this loop…"

  return (
    <div className={compact ? "" : "mt-1.5"}>
      {open ? (
        <div className="mt-1.5 flex items-end gap-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage src={user.avatar_url || ""} alt="" />
            <AvatarFallback className="text-[9px]">{(user.display_name || user.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            autoFocus
            rows={1}
            className="max-h-24 min-h-[34px] flex-1 resize-none rounded-xl text-xs"
            onKeyDown={(e) => {
              // The composer lives inside a dropdown menu; keep its typeahead
              // keyboard handling from swallowing normal typing.
              e.stopPropagation()
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <Button size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={() => void send()} disabled={sending || !text.trim()} title="Send">
            {sending ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-full" onClick={() => setOpen(false)} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 gap-1 rounded-full px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground ${compact ? "" : "mt-0.5"}`}
          onClick={() => setOpen(true)}
        >
          {target.kind === "dm" ? <Reply className="h-2.5 w-2.5" /> : <MessageCircle className="h-2.5 w-2.5" />}
          Quick reply
        </Button>
      )}
    </div>
  )
}
