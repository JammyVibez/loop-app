"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Phone, Video, MoreHorizontal, Wallpaper, Search, Bell, BellOff } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ChatHeaderProps {
  displayName: string
  avatarUrl?: string
  videoAvatarUrl?: string | null
  username?: string
  peerOnline: boolean
  typingPeer: boolean
  isGroup?: boolean
  onBack: () => void
  onStartCall: (mode: "video" | "audio") => void
  onOpenWallpaper: () => void
  onToggleSearch: () => void
  pushEnabled?: boolean | null
  onTogglePush?: () => void
  startingCall?: "video" | "audio" | null
}

export function ChatHeader({
  displayName,
  avatarUrl,
  videoAvatarUrl,
  username,
  peerOnline,
  typingPeer,
  isGroup,
  onBack,
  onStartCall,
  onOpenWallpaper,
  onToggleSearch,
  pushEnabled,
  onTogglePush,
  startingCall,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border bg-background/80 backdrop-blur-md">
      {/* Back button (mobile) */}
      <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden shrink-0" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Avatar + info */}
      <Link href={username ? `/profile/${username}` : "#"} className="flex items-center gap-2.5 shrink-0 min-w-0">
        {videoAvatarUrl ? (
          <VideoAvatar
            src={avatarUrl}
            videoSrc={videoAvatarUrl}
            alt={displayName}
            fallback={displayName.charAt(0)}
            size="sm"
            className="h-9 w-9"
          />
        ) : (
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-xs font-bold">{displayName.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate max-w-[180px] sm:max-w-[260px]">
            {displayName}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {typingPeer ? (
              <span className="text-primary font-medium animate-pulse">typing...</span>
            ) : peerOnline ? (
              <span className="text-emerald-500">Online</span>
            ) : (
              <span>Last seen recently</span>
            )}
          </p>
        </div>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onStartCall("audio")}
          disabled={!!startingCall}
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onStartCall("video")}
          disabled={!!startingCall}
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleSearch}>
          <Search className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem onClick={onOpenWallpaper}>
              <Wallpaper className="h-4 w-4 mr-2" /> Chat Wallpaper
            </DropdownMenuItem>
            {username && (
              <DropdownMenuItem asChild>
                <Link href={`/profile/${username}`}>
                  <Avatar className="h-4 w-4 mr-2" />
                  View Profile
                </Link>
              </DropdownMenuItem>
            )}
            {onTogglePush && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onTogglePush}>
                  {pushEnabled ? (
                    <>
                      <BellOff className="h-4 w-4 mr-2" /> Mute Notifications
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 mr-2" /> Enable Notifications
                    </>
                  )}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
