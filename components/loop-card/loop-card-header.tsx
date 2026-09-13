"use client"

import Link from "next/link"
import {
  MoreHorizontal,
  GitBranch,
  Zap,
  Star,
  Gift,
  Edit,
  Trash2,
  Pin,
  PinOff,
  Lock,
  Unlock,
  Users,
  Rocket,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardHeader } from "@/components/ui/card"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { UserBadges } from "@/components/user-badge"
import { ReportContentButton } from "@/components/moderation/report-content-button"
import { fontStyle, type ActiveCosmetics } from "@/lib/cosmetics"
import { useAuth } from "@/hooks/use-auth"
import { useLoginGate } from "@/hooks/use-login-gate"
import { useVerificationBadges } from "@/hooks/use-verification-badges"
import { VerifiedSeal } from "@/components/ui/verified-seal"

interface LoopCardHeaderProps {
  loop: any
  isCoLoop: boolean
  coAuthors: any[]
  isHovered: boolean
  boostCoinsCurrent: number
  isBoosted: boolean
  togglingPin: boolean
  onTogglePin: () => void
  onEdit: () => void
  onDelete: () => void
  onGift: () => void
  onSetRosterOpen: (v: boolean) => void
  getAvatarStyle: () => string
}

export function LoopCardHeader({
  loop,
  isCoLoop,
  coAuthors,
  isHovered,
  boostCoinsCurrent,
  isBoosted,
  togglingPin,
  onTogglePin,
  onEdit,
  onDelete,
  onGift,
  onSetRosterOpen,
  getAvatarStyle,
}: LoopCardHeaderProps) {
  const { user: currentUser } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()
  const isAuthor = (user: any, loop: any) => user?.id === loop?.author_id
  const verificationBadges = useVerificationBadges()
  const authorBadge = loop.author?.badge_id
    ? verificationBadges[loop.author.badge_id] || null
    : null

  // The original loop this card branched from — prefer the real handle so the
  // banner reads “Branch from @handle” (with a verified badge) instead of a
  // generic placeholder when the author is present.
  const parentAuthor = loop.parent_loop?.author || null
  const parentAuthorName =
    parentAuthor?.username?.trim() || parentAuthor?.display_name?.trim() || ""

  return (
    <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
      {LoginGateDialog}

      {/* Branch origin banner — always name the author we branched from (@username + badge when verified) */}
      {loop.parent_loop_id && (
        <Link
          href={`/loop/${loop.parent_loop?.id || loop.parent_loop_id}`}
          className="mb-2 flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-foreground"
          title={`View the original loop this was branched from`}
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="truncate">
            Branch from{" "}
            {parentAuthorName ? (
              <span className="inline-flex items-center gap-1 align-baseline font-semibold text-foreground">
                @{parentAuthorName}
                {parentAuthor?.is_verified && <VerifiedSeal size={12} title="Verified Creator" />}
              </span>
            ) : (
              <span className="font-semibold text-foreground">the original post</span>
            )}
          </span>
          <span className="ml-auto shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-500">
            View original
          </span>
        </Link>
      )}

      {/* Co-loop collaboration banner */}
      {isCoLoop && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
          <Badge className="bg-primary text-primary-foreground font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
            <Zap className="h-3 w-3 animate-pulse text-cyan-200" />
            Co-Loop Collaboration
          </Badge>
          <button
            type="button"
            onClick={() => onSetRosterOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-400 transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <Users className="h-3 w-3" />
            See the collaboration &middot; {coAuthors.length + 1} creators
          </button>
        </div>
      )}

      {/* Author row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          {/* Avatar */}
          {isCoLoop ? (
            <div
              onClick={() => onSetRosterOpen(true)}
              className="flex items-center cursor-pointer group flex-shrink-0"
              title="Click to view Co-Authors roster"
            >
              <div className="relative z-10">
                <AvatarWithFrame
                  avatarUrl={loop.author.avatar_url}
                  videoAvatarUrl={loop.author.video_avatar_url || null}
                  frameId={loop.author.equipped_frame_id}
                  size={32}
                  alt={loop.author.display_name}
                  className="ring-2 ring-cyan-500 ring-offset-2 ring-offset-background group-hover:scale-105 transition-transform"
                />
              </div>
              {coAuthors.slice(0, 3).map((ca: any, i: number) => (
                <div
                  key={ca.id || i}
                  className="-ml-3 relative z-[9] transition-transform group-hover:scale-105"
                  style={{ zIndex: 8 - i }}
                >
                  <CosmeticAvatar
                    src={ca.avatar_url}
                    alt={ca.display_name || ca.username}
                    fallback={ca.display_name || ca.username}
                    size="sm"
                    className="ring-2 ring-cyan-400 ring-offset-2 ring-offset-background"
                  />
                </div>
              ))}
              {coAuthors.length > 3 && (
                <div className="-ml-3 relative z-0 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-950 text-[10px] font-bold text-cyan-300 ring-2 ring-cyan-400">
                  +{coAuthors.length - 3}
                </div>
              )}
            </div>
          ) : (
            <Link href={`/profile/${loop.author.username}`} className="flex-shrink-0">
              <AvatarWithFrame
                avatarUrl={loop.author.avatar_url}
                videoAvatarUrl={loop.author.video_avatar_url || null}
                frameId={loop.author.equipped_frame_id}
                size={32}
                alt={loop.author.display_name}
                className={getAvatarStyle()}
              />
            </Link>
          )}

          {/* Author name + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1 flex-wrap">
              {isCoLoop ? (
                <div className="flex items-center gap-1 flex-wrap font-semibold text-sm sm:text-base">
                  <Link
                    href={`/profile/${loop.author.username}`}
                    className="hover:underline text-cyan-400"
                  >
                    @{loop.author.username}
                  </Link>
                  {coAuthors.map((ca: any) => (
                    <span key={ca.id || ca.username} className="flex items-center gap-1">
                      <span className="text-muted-foreground font-normal">x</span>
                      <Link
                        href={`/profile/${ca.username}`}
                        className="hover:underline text-purple-400"
                      >
                        @{ca.username}
                      </Link>
                    </span>
                  ))}
                </div>
              ) : (
                <Link href={`/profile/${loop.author.username}`} className="min-w-0">
                  <span
                    className="font-semibold hover:underline text-sm sm:text-base truncate block max-w-[120px] sm:max-w-none"
                    style={fontStyle(
                      (loop.author.cosmetics || loop.author.active_cosmetics)?.font
                    )}
                  >
                    {loop.author.display_name}
                  </span>
                </Link>
              )}

              <UserBadges
                is_verified={loop.author.is_verified}
                is_team_member={loop.author.is_team_member}
                is_sponsor={loop.author.is_sponsor}
                is_premium={loop.author.is_premium}
                is_organization={loop.author.is_organization}
                organization_badge_url={loop.author.organization_badge_url}
                organization_name={loop.author.organization_name}
                badge={authorBadge}
                username={loop.author.username}
                size="sm"
              />

              {loop.author.level && loop.author.level > 1 && (
                <Badge variant="outline" className="text-[10px] sm:text-xs px-1 flex-shrink-0">
                  L{loop.author.level}
                </Badge>
              )}

              {loop.media_urls && loop.media_urls.length > 1 && (
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs px-1 flex-shrink-0 border-purple-500 text-purple-600"
                >
                  {loop.media_urls.length} files
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <span className="truncate max-w-[80px] sm:max-w-none">@{loop.author.username}</span>
              <span>&middot;</span>
              <FreshnessTimestamp date={loop.created_at} showIcon />
              {loop.comments_disabled && (
                <span className="inline-flex items-center gap-0.5 text-amber-500" title="Comments locked">
                  <Lock className="h-3 w-3" />
                </span>
              )}
              {loop.engagement_score && loop.engagement_score > 80 && (
                <>
                  <span>&middot;</span>
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    <Zap className="h-2 w-2 mr-1" />
                    Hot
                  </Badge>
                </>
              )}
              {loop.is_featured && (
                <>
                  <span>&middot;</span>
                  <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                    <Star className="h-2 w-2 mr-1" />
                    Featured
                  </Badge>
                </>
              )}
              {(isBoosted || boostCoinsCurrent >= 100) && (
                <>
                  <span>&middot;</span>
                  <Badge
                    variant="secondary"
                    className="text-xs bg-primary text-primary-foreground font-bold shadow-sm flex items-center gap-1 border border-cyan-400/30"
                  >
                    <Rocket className="h-3 w-3 text-cyan-200 animate-pulse" />
                    Boosted{" "}
                    {boostCoinsCurrent >= 2000
                      ? "(Tier 3)"
                      : boostCoinsCurrent >= 500
                      ? "(Tier 2)"
                      : "(Tier 1)"}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 sm:h-8 sm:w-8 p-0 flex-shrink-0"
            >
              <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {currentUser?.id === loop.author_id && (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Loop
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onTogglePin}
                  disabled={togglingPin}
                >
                  {loop.is_pinned ? (
                    <PinOff className="h-4 w-4 mr-2" />
                  ) : (
                    <Pin className="h-4 w-4 mr-2" />
                  )}
                  {loop.is_pinned ? "Unpin from Profile" : "Pin to Profile"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/loops/${loop.id}/toggle-comments`, { method: "POST" })
                      const data = await res.json()
                      if (data.success) {
                        loop.comments_disabled = data.comments_disabled
                      }
                    } catch { /* intentionally silent */ }
                  }}
                >
                  {loop.comments_disabled ? (
                    <><Unlock className="h-4 w-4 mr-2" /> Unlock Comments</>
                  ) : (
                    <><Lock className="h-4 w-4 mr-2" /> Lock Comments</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-500 focus:text-red-500"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Loop
                </DropdownMenuItem>
              </>
            )}
            {/* Admin/moderator override — visible even on other users' posts */}
            {currentUser && !isAuthor(currentUser, loop) && (currentUser.is_admin || currentUser.is_team_member) && (
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/loops/${loop.id}/toggle-comments`, { method: "POST" })
                    const data = await res.json()
                    if (data.success) {
                      loop.comments_disabled = data.comments_disabled
                    }
                  } catch { /* intentionally silent */ }
                }}
              >
                {loop.comments_disabled ? (
                  <><Unlock className="h-4 w-4 mr-2" /> Admin: Unlock Comments</>
                ) : (
                  <><Lock className="h-4 w-4 mr-2" /> Admin: Lock Comments</>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                if (!requireAuth("gift")) return
                onGift()
              }}
            >
              <Gift className="h-4 w-4 mr-2" />
              Send Gift
            </DropdownMenuItem>
            <ReportContentButton contentType="loop" contentId={loop.id} label="Report Loop" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardHeader>
  )
}
