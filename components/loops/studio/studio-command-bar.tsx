"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Copy,
  ExternalLink,
  Gift,
  Globe,
  History,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Power,
  Radio,
  RefreshCw,
  Trash2,
  Unlock,
  UserPlus,
  WifiOff,
} from "@/components/icons/lucide-compat"
import { initialsOf, type StudioConnectionState, type StudioParticipant } from "./studio-types"

function ConnectionPill({ state }: { state: StudioConnectionState }) {
  const config = {
    live: {
      label: "Live",
      dot: "bg-emerald-500 animate-pulse",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
    },
    connecting: {
      label: "Connecting",
      dot: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
    },
    reconnecting: {
      label: "Reconnecting",
      dot: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
    },
    offline: {
      label: "Offline",
      dot: "bg-muted-foreground",
      text: "text-muted-foreground",
      border: "border-border",
      bg: "bg-muted/60",
    },
  }[state]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${config.border} ${config.bg} ${config.text}`}
    >
      {state === "offline" ? <WifiOff className="h-3 w-3" /> : <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />}
      {config.label}
    </span>
  )
}

interface StudioCommandBarProps {
  sessionId: string
  isOwner: boolean
  ownerUsername?: string
  connection: StudioConnectionState
  participants: StudioParticipant[]
  versionCount: number
  unreadCount: number
  linkCopied: boolean
  /** The host froze the draft — non-hosts can read but not write. */
  locked: boolean
  onOpenHistory: () => void
  onOpenActivity: () => void
  onOpenGift: () => void
  onOpenInvite: () => void
  onCopyLink: () => void
  onRequestSync: () => void
  onOpenOpenInvite: () => void
  onToggleLock: () => void
  onDeleteRoom: () => void
  onEndSession: () => void
  onLeave: () => void
}

export function StudioCommandBar({
  sessionId,
  isOwner,
  ownerUsername,
  connection,
  participants,
  versionCount,
  unreadCount,
  linkCopied,
  locked,
  onOpenHistory,
  onOpenActivity,
  onOpenGift,
  onOpenInvite,
  onCopyLink,
  onRequestSync,
  onOpenOpenInvite,
  onToggleLock,
  onDeleteRoom,
  onEndSession,
  onLeave,
}: StudioCommandBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Radio className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">Co-Loop Studio</h1>
            <ConnectionPill state={connection} />
            {locked && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" />
                Locked by host
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {isOwner ? "You are hosting" : `Hosted by @${ownerUsername || "a collaborator"}`}
            {" · "}
            <span className="font-mono">{sessionId.slice(0, 26)}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center -space-x-2 pr-1">
          {participants.slice(0, 4).map((participant) => (
            <VideoAvatar
              key={participant.id}
              src={participant.avatar_url}
              videoSrc={participant.video_avatar_url}
              isPremium={participant.is_premium}
              fallback={initialsOf(participant)}
              size="sm"
              className="h-8 w-8 rounded-full ring-2 ring-card"
            />
          ))}
          {participants.length > 4 && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
              +{participants.length - 4}
            </span>
          )}
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenHistory}>
          <History className="h-3.5 w-3.5" />
          History
          {versionCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {versionCount}
            </Badge>
          )}
        </Button>

        <Button variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={onOpenActivity}>
          <MessageSquare className="h-3.5 w-3.5" />
          Room
          {unreadCount > 0 && <Badge className="h-4 px-1 text-[10px]">{unreadCount}</Badge>}
        </Button>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenGift}>
          <Gift className="h-3.5 w-3.5" />
          Gift
        </Button>

        <Button size="sm" className="gap-1.5" onClick={onOpenInvite}>
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More studio actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Session</DropdownMenuLabel>
            <DropdownMenuItem onClick={onCopyLink}>
              <Copy className="mr-2 h-4 w-4" /> {linkCopied ? "Link copied" : "Copy join link"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRequestSync}>
              <RefreshCw className="mr-2 h-4 w-4" /> Re-sync the document
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={onOpenOpenInvite}>
                <Globe className="mr-2 h-4 w-4" /> Publish open invite
              </DropdownMenuItem>
            )}
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Host controls</DropdownMenuLabel>
                <DropdownMenuItem onClick={onToggleLock}>
                  {locked ? (
                    <>
                      <Unlock className="mr-2 h-4 w-4" /> Unlock the room
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" /> Lock the room
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDeleteRoom} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete room after publishing
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {isOwner ? (
              <DropdownMenuItem onClick={onEndSession} className="text-destructive focus:text-destructive">
                <Power className="mr-2 h-4 w-4" /> End the session
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onLeave}>
                <ExternalLink className="mr-2 h-4 w-4" /> Leave the studio
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
