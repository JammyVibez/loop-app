"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/skeletons"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check, Coins, ExternalLink, Globe, Link2, Rocket, UserPlus } from "@/components/icons/lucide-compat"
import { MAX_CO_AUTHORS, initialsOf, type StudioParticipant } from "./studio-types"

export interface StudioDialogsProps {
  invite: {
    open: boolean
    onOpenChange: (open: boolean) => void
    url: string
    linkCopied: boolean
    onCopyLink: () => void
    query: string
    onQueryChange: (value: string) => void
    results: any[]
    searching: boolean
    sending: boolean
    onSend: (user: any) => void
  }
  gift: {
    open: boolean
    onOpenChange: (open: boolean) => void
    coAuthorCount: number
    sending: boolean
    onSend: (amount: number) => void
  }
  openInvite: {
    open: boolean
    onOpenChange: (open: boolean) => void
    topic: string
    onTopicChange: (value: string) => void
    max: number
    onMaxChange: (value: number) => void
    publishing: boolean
    onPublish: () => void
  }
  ceremony: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    authors: number
    self: { username?: string; display_name?: string; avatar_url?: string | null; video_avatar_url?: string | null; is_premium?: boolean }
    roster: StudioParticipant[]
    onViewFeed: () => void
    onStartNew: () => void
  }
}

export function StudioDialogs({ invite, gift, openInvite, ceremony }: StudioDialogsProps) {
  return (
    <>
      {/* ── Invite ─────────────────────────────────────────────────── */}
      <Dialog open={invite.open} onOpenChange={invite.onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Invite a co-author
            </DialogTitle>
            <DialogDescription>
              Share the join link or send a direct invite. Up to {MAX_CO_AUTHORS} co-authors can write with you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Join link</label>
              <div className="flex items-center gap-2">
                <Input readOnly value={invite.url} className="font-mono text-xs" />
                <Button onClick={invite.onCopyLink} className="shrink-0">
                  {invite.linkCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Invite by username</label>
              <Input
                value={invite.query}
                onChange={(e) => invite.onQueryChange(e.target.value)}
                placeholder="Search @username…"
              />
              {invite.searching && <p className="text-[11px] text-muted-foreground">Searching…</p>}
              {invite.results.length > 0 && (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
                  {invite.results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between gap-2 rounded-lg p-1.5 hover:bg-muted/60"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <VideoAvatar
                          src={result.avatar_url}
                          videoSrc={result.video_avatar_url}
                          isPremium={result.is_premium}
                          fallback={initialsOf(result)}
                          size="sm"
                          className="h-7 w-7 rounded-full"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{result.display_name || result.username}</p>
                          <p className="truncate text-[10px] text-muted-foreground">@{result.username}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={invite.sending}
                        onClick={() => invite.onSend(result)}
                        className="h-7 text-[11px]"
                      >
                        {invite.sending ? <Spinner className="h-3 w-3" /> : "Send"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Split gift ─────────────────────────────────────────────── */}
      <Dialog open={gift.open} onOpenChange={gift.onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              Split a coin gift
            </DialogTitle>
            <DialogDescription>
              Gift Loop Coins to the room. The amount is split evenly across{" "}
              {Math.max(1, gift.coAuthorCount)} co-author{gift.coAuthorCount === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            {[100, 500, 1000, 5000].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                disabled={gift.sending}
                onClick={() => gift.onSend(amount)}
                className="flex h-20 flex-col gap-0.5"
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <Coins className="h-3.5 w-3.5 text-amber-500" />
                  {amount}
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {Math.floor(amount / Math.max(1, gift.coAuthorCount))} each
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Open invite ────────────────────────────────────────────── */}
      <Dialog open={openInvite.open} onOpenChange={openInvite.onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Publish an open invite
            </DialogTitle>
            <DialogDescription>
              Post an open call to the feed. Anyone on Loop can join this room until it is full.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">What are you creating?</label>
              <Textarea
                value={openInvite.topic}
                onChange={(e) => openInvite.onTopicChange(e.target.value)}
                rows={3}
                placeholder="A short prompt for people who want to join…"
                className="resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Maximum collaborators</label>
              <div className="flex gap-2">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => openInvite.onMaxChange(count)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      openInvite.max === count
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={openInvite.onPublish}
              disabled={openInvite.publishing || !openInvite.topic.trim()}
              className="w-full gap-1.5"
            >
              {openInvite.publishing ? <Spinner className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              Publish to the feed
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Publish ceremony ───────────────────────────────────────── */}
      <Dialog open={ceremony.open} onOpenChange={ceremony.onOpenChange}>
        <DialogContent className="overflow-hidden sm:max-w-lg">
          <DialogHeader className="space-y-3 text-center">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Rocket className="h-8 w-8" />
            </motion.div>
            <DialogTitle className="text-xl font-semibold tracking-tight">Published to Loop</DialogTitle>
            <DialogDescription>
              Your collaboration is live on the feed with stacked co-author credit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="rounded-xl border border-border bg-muted/40 p-3.5">
              <p className="text-xs font-medium text-foreground">{ceremony.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {ceremony.authors} credited author{ceremony.authors === 1 ? "" : "s"} · +50 Loop Coins each
              </p>
            </div>

            <div className="flex -space-x-3">
              <VideoAvatar
                src={ceremony.self.avatar_url}
                videoSrc={ceremony.self.video_avatar_url}
                isPremium={ceremony.self.is_premium}
                fallback={initialsOf(ceremony.self)}
                size="sm"
                className="h-9 w-9 rounded-full ring-2 ring-card"
              />
              {ceremony.roster.map((author) => (
                <VideoAvatar
                  key={author.id}
                  src={author.avatar_url}
                  videoSrc={author.video_avatar_url}
                  isPremium={author.is_premium}
                  fallback={initialsOf(author)}
                  size="sm"
                  className="h-9 w-9 rounded-full ring-2 ring-card"
                />
              ))}
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Button onClick={ceremony.onViewFeed} className="w-full gap-1.5">
                View it on the feed <ExternalLink className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={ceremony.onStartNew} className="w-full">
                Start a new Co-Loop
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
