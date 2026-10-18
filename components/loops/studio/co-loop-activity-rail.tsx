"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { timeAgo } from "@/lib/community-engine"
import {
  Coins,
  Crown,
  History,
  Link2,
  Lock,
  MessageSquare,
  PenLine,
  RotateCcw,
  Rocket,
  Save,
  Send,
  SmilePlus,
  Unlock,
  UserPlus,
  UserMinus,
  Users,
  Loader2,
  type LucideIcon,
} from "lucide-react"
import {
  MAX_CO_AUTHORS,
  initialsOf,
  type StudioActivityAction,
  type StudioActivityEntry,
  type StudioChatMessage,
  type StudioParticipant,
} from "./studio-types"

/** One icon + phrasing per thing that can happen in a room. */
const ACTIVITY_META: Record<
  StudioActivityAction,
  { icon: LucideIcon; verb: string; chip: string }
> = {
  edited: { icon: PenLine, verb: "edited the draft", chip: "bg-sky-500/15 text-sky-500" },
  version_saved: { icon: Save, verb: "saved a version", chip: "bg-emerald-500/15 text-emerald-500" },
  version_restored: { icon: RotateCcw, verb: "restored a version", chip: "bg-amber-500/15 text-amber-500" },
  published: { icon: Rocket, verb: "published the Co-Loop", chip: "bg-primary/15 text-primary" },
  locked: { icon: Lock, verb: "locked the room", chip: "bg-rose-500/15 text-rose-500" },
  unlocked: { icon: Unlock, verb: "unlocked the room", chip: "bg-emerald-500/15 text-emerald-500" },
  gifted: { icon: Coins, verb: "sent a coin gift", chip: "bg-amber-500/15 text-amber-500" },
  invite_sent: { icon: UserPlus, verb: "invited a co-author", chip: "bg-violet-500/15 text-violet-500" },
  kicked: { icon: UserMinus, verb: "removed a co-author", chip: "bg-rose-500/15 text-rose-500" },
}

interface CoLoopActivityRailProps {
  participants: StudioParticipant[]
  selfId: string
  chatMessages: StudioChatMessage[]
  activity: StudioActivityEntry[]
  activityLoading?: boolean
  onSendChat: (text: string) => void
  /** Toggle an emoji reaction; the message carries its own reaction map. */
  onReact?: (messageId: string, emoji: string) => void
  onInvite: () => void
  onCopyLink: () => void
  linkCopied: boolean
  coAuthorCount: number
  /** The host can remove co-authors from the room. */
  canKick?: boolean
  onKick?: (participant: StudioParticipant) => void
  kickingId?: string | null
}

export function CoLoopActivityRail({
  participants,
  selfId,
  chatMessages,
  activity,
  activityLoading,
  onSendChat,
  onReact,
  onInvite,
  onCopyLink,
  linkCopied,
  coAuthorCount,
  canKick = false,
  onKick,
  kickingId = null,
}: CoLoopActivityRailProps) {
  const [tab, setTab] = useState("chat")
  const [draft, setDraft] = useState("")
  const [reactingTo, setReactingTo] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tab === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [chatMessages.length, tab])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSendChat(text)
    setDraft("")
  }

  const atLimit = coAuthorCount >= MAX_CO_AUTHORS

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-3 pt-3">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="people" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Room
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {participants.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Chat ─────────────────────────────────────────────────── */}
        <TabsContent value="chat" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1 px-3 py-3">
            {chatMessages.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-1.5 px-4 text-center">
                <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">No messages yet</p>
                <p className="text-[11px] text-muted-foreground">
                  Talk through the draft with everyone in the room while you write.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {chatMessages.map((message) => {
                  const isMe = message.sender_id === selfId
                  const reactions = Object.entries(message.reactions || {}).filter(
                    ([, users]) => Array.isArray(users) && users.length > 0,
                  )
                  return (
                    <div
                      key={message.id}
                      className={`group/msg flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                    >
                      <VideoAvatar
                        src={message.sender_avatar}
                        videoSrc={message.sender_video_avatar_url}
                        isPremium={message.sender_is_premium}
                        fallback={initialsOf({ display_name: message.sender_name })}
                        size="sm"
                        className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
                      />
                      <div className={`relative max-w-[82%] ${isMe ? "items-end text-right" : ""}`}>
                        <div
                          className={`flex items-center gap-1.5 text-[10px] text-muted-foreground ${
                            isMe ? "flex-row-reverse" : ""
                          }`}
                        >
                          <span className="font-medium">{isMe ? "You" : message.sender_name}</span>
                          <span>{message.timestamp}</span>
                          {message.pending && <span className="italic opacity-70">sending…</span>}
                          {onReact && !message.pending && (
                            <button
                              type="button"
                              onClick={() =>
                                setReactingTo((prev) => (prev === message.id ? null : message.id))
                              }
                              className="rounded-full p-0.5 text-muted-foreground opacity-100 transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover/msg:opacity-100"
                              aria-label="React to message"
                            >
                              <SmilePlus className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <p
                          className={`mt-0.5 inline-block rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                            isMe
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          } ${message.pending ? "opacity-70" : ""}`}
                        >
                          {message.text}
                        </p>

                        {reactingTo === message.id && onReact && (
                          <div
                            className={`mt-1 flex items-center gap-0.5 rounded-full border border-border bg-popover px-1.5 py-0.5 shadow-sm ${
                              isMe ? "ml-auto w-fit" : "w-fit"
                            }`}
                          >
                            {["👍", "❤️", "😂", "🔥", "🎉"].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  onReact(message.id, emoji)
                                  setReactingTo(null)
                                }}
                                className="px-0.5 text-sm transition-transform hover:scale-125"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {reactions.length > 0 && (
                          <div
                            className={`mt-1 flex flex-wrap gap-1 ${isMe ? "justify-end" : ""}`}
                          >
                            {reactions.map(([emoji, users]) => {
                              const mine = users.includes(selfId)
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  disabled={!onReact || message.pending}
                                  onClick={() => onReact?.(message.id, emoji)}
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset transition-transform active:scale-95 ${
                                    mine
                                      ? "bg-primary/15 text-primary ring-primary/30"
                                      : "bg-muted text-muted-foreground ring-border/60"
                                  }`}
                                >
                                  {emoji} {users.length}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>
            )}
          </ScrollArea>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the room…"
              className="h-9 text-xs"
            />
            <Button type="submit" size="icon" disabled={!draft.trim()} className="h-9 w-9 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </TabsContent>

        {/* ── Activity ─────────────────────────────────────────────── */}
        <TabsContent value="activity" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1 px-3 py-3">
            {activityLoading && activity.length === 0 ? (
              <div className="space-y-2 px-1 py-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-10 animate-pulse rounded-xl bg-muted/60" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-1.5 px-4 text-center">
                <History className="h-7 w-7 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">Nothing yet</p>
                <p className="text-[11px] text-muted-foreground">
                  Versions, gifts, edits and invites all show up here so the room has a paper trail.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
                {activity.map((entry) => {
                  const meta = ACTIVITY_META[entry.action] || ACTIVITY_META.edited
                  const Icon = meta.icon
                  const isMe = entry.actor_id && entry.actor_id === selfId
                  return (
                    <motion.li
                      key={entry.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative flex gap-2.5 rounded-xl px-1 py-1.5"
                    >
                      <span
                        className={`relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ring-2 ring-card ${meta.chip}`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] leading-snug text-foreground">
                          <span className="font-semibold">{isMe ? "You" : entry.actor_name}</span>{" "}
                          {meta.verb}
                        </p>
                        {entry.summary && (
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{entry.summary}</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                          {timeAgo(entry.created_at)}
                        </p>
                      </div>
                    </motion.li>
                  )
                })}
              </ol>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── People ───────────────────────────────────────────────── */}
        <TabsContent value="people" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1 px-3 py-3">
            <ul className="space-y-1.5">
              {participants.map((participant) => {
                const isCreator = participant.role === "Primary Creator"
                return (
                  <motion.li
                    key={participant.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/50"
                  >
                    <div className="relative">
                      <VideoAvatar
                        src={participant.avatar_url}
                        videoSrc={participant.video_avatar_url}
                        isPremium={participant.is_premium}
                        fallback={initialsOf(participant)}
                        size="sm"
                        className="h-8 w-8 rounded-full"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {participant.display_name}
                        {participant.id === selfId && (
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {participant.editing ? (
                          <span className="inline-flex items-center gap-1 font-medium text-primary">
                            <PenLine className="h-2.5 w-2.5" />
                            writing the {participant.editing}
                          </span>
                        ) : (
                          `@${participant.username}`
                        )}
                      </p>
                    </div>
                    {isCreator ? (
                      <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                        <Crown className="h-3 w-3 text-amber-500" /> Host
                      </Badge>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          Co-author
                        </Badge>
                        {canKick && participant.id !== selfId && onKick && (
                          <button
                            type="button"
                            onClick={() => onKick(participant)}
                            disabled={kickingId === participant.id}
                            title={`Remove ${participant.display_name} from the room`}
                            aria-label={`Remove ${participant.display_name} from the room`}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
                          >
                            {kickingId === participant.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </motion.li>
                )
              })}
            </ul>
          </ScrollArea>

          <div className="space-y-2 border-t border-border p-3">
            <Button
              type="button"
              onClick={onInvite}
              disabled={atLimit}
              className="w-full gap-1.5 text-xs"
              size="sm"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {atLimit ? `Room full (${MAX_CO_AUTHORS} co-authors)` : "Invite a co-author"}
            </Button>
            <Button type="button" onClick={onCopyLink} variant="outline" size="sm" className="w-full gap-1.5 text-xs">
              <Link2 className="h-3.5 w-3.5" />
              {linkCopied ? "Link copied" : "Copy join link"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
