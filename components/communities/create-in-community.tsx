"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DeviceMediaPicker, type PickedMedia } from "@/components/communities/device-media-picker"
import { CreateDuelDialog } from "@/components/duels/create-duel-dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Globe2, Loader2, MessageSquare, Send, Sparkles, Swords, Users } from "lucide-react"

type Mode = "discussion" | "coloop" | "duel"

const MODES: Array<{ id: Mode; label: string; hint: string; icon: typeof MessageSquare }> = [
  { id: "discussion", label: "Discussion", hint: "Ask, share, decide — with replies", icon: MessageSquare },
  { id: "coloop", label: "Co-Loop", hint: "Create something together, live", icon: Users },
  { id: "duel", label: "Duel", hint: "Two sides, the community votes", icon: Swords },
]

/**
 * The one "Create in this community" action.
 *
 * A member can open a normal discussion, start an existing Loop feature
 * (Co-Loop / Duel), and in every case the community discussion remains the
 * place where the community follows the idea and replies. Nothing here
 * publishes to the global Loop feed unless the member ticks that box.
 */
export function CreateInCommunity({
  open,
  onOpenChange,
  communityId,
  spaces,
  canShareToFeed,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  spaces: any[]
  canShareToFeed: boolean
  onCreated?: () => void
}) {
  const router = useRouter()
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>("discussion")

  // Discussion
  const [content, setContent] = useState("")
  const [topicId, setTopicId] = useState("general")
  const [media, setMedia] = useState<PickedMedia[]>([])
  const [shareToFeed, setShareToFeed] = useState(false)
  const [saving, setSaving] = useState(false)

  // Co-Loop
  const [coloopTitle, setColoopTitle] = useState("")
  const [coloopBrief, setColoopBrief] = useState("")
  const [coloopShare, setColoopShare] = useState(false)

  // Duel
  const [duelOpen, setDuelOpen] = useState(false)
  const [duelShare, setDuelShare] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode("discussion")
    setContent("")
    setTopicId("general")
    setMedia([])
    setShareToFeed(false)
    setColoopTitle("")
    setColoopBrief("")
    setColoopShare(false)
  }, [open])

  const createDiscussion = async () => {
    if (!content.trim() && media.length === 0) {
      toast({ title: "Write something to start the discussion", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/circles/${communityId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          content: content.trim(),
          post_type: "discussion",
          space_id: topicId === "general" ? undefined : Number(topicId),
          media_urls: media.map((m) => m.url),
          media_type: media.some((m) => m.kind === "video") ? "video" : media.length ? "image" : undefined,
          share_to_feed: canShareToFeed ? shareToFeed : false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't start the discussion")
      toast({
        title: data.post?.status === "pending" ? "Sent for review" : "Discussion started",
        description:
          data.post?.status === "pending"
            ? "A moderator will approve it before it appears."
            : shareToFeed && data.post?.shared_to_feed
              ? "It is in this community and on the Loop feed."
              : "It lives in this community — reply to keep it going.",
      })
      onOpenChange(false)
      onCreated?.()
    } catch (e: any) {
      toast({ title: "Couldn't start the discussion", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const startCoLoop = async () => {
    if (coloopTitle.trim().length < 3) {
      toast({ title: "Give the Co-Loop a title", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      // 1. Open the room row inside the community.
      const roomRes = await fetch(`/api/circles/${communityId}/coloop`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: coloopTitle.trim(),
          description: coloopBrief.trim() || null,
        }),
      })
      const room = await roomRes.json()
      if (!roomRes.ok) throw new Error(room.error || "Couldn't start the Co-Loop")
      const sessionId: string | null = room.session?.session_id || null

      onOpenChange(false)
      onCreated?.()

      // 2. Enter the existing Co-Loop studio (no second implementation) with
      //    the community in the URL so the publish lands in this community.
      //    The published Co-Loop becomes the discussion — it carries the
      //    community id and shows up in the community list with real replies.
      const params = new URLSearchParams({ circle: communityId })
      if (sessionId) params.set("session", sessionId)
      if (!canShareToFeed || !coloopShare) params.set("community_only", "1")
      router.push(`/co-loop/studio?${params.toString()}`)
    } catch (e: any) {
      toast({ title: "Couldn't start the Co-Loop", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create in this community</DialogTitle>
            <DialogDescription>
              Start a discussion, or launch an existing Loop feature. The community thread stays the place to
              follow it.
            </DialogDescription>
          </DialogHeader>

          {/* Mode picker */}
          <div className="grid grid-cols-3 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (m.id === "duel") {
                    setDuelOpen(true)
                    return
                  }
                  setMode(m.id)
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left transition-colors",
                  mode === m.id ? "border-foreground/30 bg-muted" : "border-border bg-background hover:bg-muted/50",
                )}
              >
                <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">{m.label}</span>
                <span className="text-[10px] leading-snug text-muted-foreground">{m.hint}</span>
              </button>
            ))}
          </div>

          {mode === "discussion" ? (
            <div className="space-y-3">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you want the community to talk about?"
                rows={4}
                autoFocus
                className="resize-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                {spaces.length > 0 ? (
                  <Select value={topicId} onValueChange={setTopicId}>
                    <SelectTrigger className="h-8 w-[190px] rounded-full text-xs">
                      <SelectValue placeholder="Topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      {spaces.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <DeviceMediaPicker items={media} onChange={setMedia} maxItems={4} folder="community-discussions" />
              </div>
              <FeedShareChoice
                visible={canShareToFeed}
                checked={shareToFeed}
                onCheckedChange={setShareToFeed}
                label="Also share this to the Loop feed"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                value={coloopTitle}
                onChange={(e) => setColoopTitle(e.target.value)}
                placeholder="What are you making together?"
                maxLength={120}
                autoFocus
              />
              <Textarea
                value={coloopBrief}
                onChange={(e) => setColoopBrief(e.target.value)}
                placeholder="The brief — what should collaborators know before they join?"
                rows={3}
                maxLength={600}
                className="resize-none"
              />
              <FeedShareChoice
                visible={canShareToFeed}
                checked={coloopShare}
                onCheckedChange={setColoopShare}
                label="Share the finished Co-Loop to the Loop feed"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {mode === "discussion" ? (
              <Button onClick={() => void createDiscussion()} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Start discussion
              </Button>
            ) : (
              <Button onClick={() => void startCoLoop()} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Open Co-Loop studio
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duels are the existing feature dialog, just bound to this community. */}
      <CreateDuelDialog
        open={duelOpen}
        onOpenChange={(next) => {
          setDuelOpen(next)
          if (!next) onOpenChange(false)
        }}
        circleId={communityId}
        canShareToFeed={canShareToFeed}
        onDuelCreated={() => {
          setDuelOpen(false)
          onOpenChange(false)
          onCreated?.()
        }}
      />
    </>
  )
}

function FeedShareChoice({
  visible,
  checked,
  onCheckedChange,
  label,
}: {
  visible: boolean
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label: string
}) {
  if (!visible) {
    return (
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Globe2 className="mt-px h-3 w-3 shrink-0" />
        This community is private, so it stays here. Nothing from it can go to the public Loop feed.
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "flex w-full items-start gap-2 rounded-xl border p-2.5 text-left transition-colors",
        checked ? "border-indigo-500/40 bg-indigo-500/5" : "border-border bg-muted/30 hover:bg-muted/50",
      )}
    >
      <Checkbox checked={checked} className="pointer-events-none mt-0.5" />
      <span>
        <span className="block text-xs font-semibold">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
          Off by default. Community discussions stay community-only until you choose this.
        </span>
      </span>
    </button>
  )
}
