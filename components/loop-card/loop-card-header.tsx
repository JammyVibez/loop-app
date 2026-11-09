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
  Link2,
  Link2Off,
  SlidersHorizontal,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { NoteChip } from "@/components/notes/note-chip"

interface LoopCardHeaderProps {
  loop: any
  isCoLoop: boolean
  coAuthors: any[]
  isHovered: boolean
  boostCoinsCurrent: number
  isBoosted: boolean
  togglingPin: boolean
  onTogglePin: () => void
  onToggleLinkPreview: () => void
  togglingLinkPreview?: boolean
  onOpenBranchSettings: () => void
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
  onToggleLinkPreview,
  togglingLinkPreview = false,
  onOpenBranchSettings,
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

  // Status pills are the exception, not the rule: a normal post has none, so
  // the author row stays a single line. Level and the Pro crown were moved to
  // the profile and post-detail views — they showed on every card before.
  const showStatusRow =
    Boolean(loop.comments_disabled) ||
    Number(loop.engagement_score) > 80 ||
    Boolean(loop.is_featured) ||
    isBoosted ||
    boostCoinsCurrent >= 100 ||
    (Array.isArray(loop.media_urls) && loop.media_urls.length > 1)

  return (
    <div data-loop-card-header="" className="flex flex-col gap-1 px-4 pb-2 pt-4 sm:px-5">
      {LoginGateDialog}

      {/* Branch origin banner — always name the author we branched from (@username + badge when verified) */}
      {loop.parent_loop_id && (
        <Link
          href={`/loop/${loop.parent_loop?.id || loop.parent_loop_id}`}
          className="mb-1 flex items-center gap-2 rounded-lg bg-emerald-500/[0.08] px-3 py-2 text-micro text-muted-foreground transition-colors hover:bg-emerald-500/15 hover:text-foreground"
          title={`View the original loop this was branched from`}
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="truncate">
            Branch from{" "}
            {parentAuthorName ? (
              <span className="inline-flex items-center gap-1 align-baseline font-semibold text-foreground">
                @{parentAuthorName}
                {parentAuthor?.is_verified && <VerifiedSeal size={17} title="Verified Creator" />}
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
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5">
          <Badge className="bg-primary text-primary-foreground font-bold text-caption px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
            <Zap className="h-3 w-3 animate-pulse text-cyan-200" />
            Co-Loop Collaboration
          </Badge>
          <button
            type="button"
            onClick={() => onSetRosterOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-micro font-bold text-cyan-400 transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
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
                  size={44}
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
                <div className="-ml-3 relative z-0 flex h-9 w-9 items-center justify-center rounded-full bg-cyan-950 text-caption font-bold text-cyan-300 ring-2 ring-cyan-400">
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
                size={44}
                alt={loop.author.display_name}
                className={getAvatarStyle()}
              />
            </Link>
          )}

          {/* Author line — name, check, handle and timestamp on one row. */}
          <div className="min-w-0 flex-1">
            {/* Wrap the handle/timestamp on narrow phones instead of letting a
                long display name collapse to an unreadable ellipsis. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-regular leading-tight">
              {isCoLoop ? (
                <div className="flex min-w-0 items-center gap-1 truncate font-semibold">
                  <Link
                    href={`/profile/${loop.author.username}`}
                    className="truncate hover:underline text-cyan-400"
                  >
                    @{loop.author.username}
                  </Link>
                  {coAuthors.map((ca: any) => (
                    <span key={ca.id || ca.username} className="flex shrink-0 items-center gap-1">
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
                    className="block truncate font-semibold hover:underline"
                    style={fontStyle(
                      (loop.author.cosmetics || loop.author.active_cosmetics)?.font
                    )}
                  >
                    {loop.author.display_name}
                  </span>
                </Link>
              )}

              {/* Pro crown is intentionally omitted here — it lives on the
                  profile and post-detail views now. */}
              <UserBadges
                is_verified={loop.author.is_verified}
                is_team_member={loop.author.is_team_member}
                is_sponsor={loop.author.is_sponsor}
                is_organization={loop.author.is_organization}
                organization_badge_url={loop.author.organization_badge_url}
                organization_name={loop.author.organization_name}
                badge={authorBadge}
                username={loop.author.username}
                size="sm"
              />

              {/* The co-loop branch above already prints every @handle. */}
              {!isCoLoop && (
                <span className="min-w-0 truncate text-mini text-muted-foreground">
                  @{loop.author.username}
                </span>
              )}
              <span className="shrink-0 text-muted-foreground">&middot;</span>
              <FreshnessTimestamp date={loop.created_at} className="shrink-0" />
            </div>

            {/* The author's live note — a floating bubble tucked under the
                author line, only when they chose to show it on posts. */}
            <NoteChip
              userId={loop.author_id || loop.author?.id}
              username={loop.author.username}
              surface="posts"
              className="mt-1"
            />

            {/* Secondary/status badges render on their own line only when the
                post actually has one — most posts show none. */}
            {showStatusRow && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-mini text-muted-foreground">
                {Boolean(loop.comments_disabled) && (
                  <span className="inline-flex items-center gap-0.5 text-amber-500" title="Comments locked">
                    <Lock className="h-3 w-3" />
                  </span>
                )}
                {Number(loop.engagement_score) > 80 && (
                  <Badge className="border-0 bg-orange-500/12 text-caption font-semibold text-orange-400 px-2 py-0.5 shadow-none">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    Hot
                  </Badge>
                )}
                {Boolean(loop.is_featured) && (
                  <Badge className="border-0 bg-amber-400/12 text-caption font-semibold text-amber-400 px-2 py-0.5 shadow-none">
                    <Star className="h-2.5 w-2.5 mr-0.5" />
                    Featured
                  </Badge>
                )}
                {(isBoosted || boostCoinsCurrent >= 100) && (
                  <Badge className="border-0 bg-cyan-500/12 text-caption font-semibold text-cyan-400 px-2 py-0.5 shadow-none">
                    <Rocket className="h-2.5 w-2.5 mr-0.5" />
                    Boosted{" "}
                    {boostCoinsCurrent >= 2000
                      ? "(Tier 3)"
                      : boostCoinsCurrent >= 500
                      ? "(Tier 2)"
                      : "(Tier 1)"}
                  </Badge>
                )}
                {Array.isArray(loop.media_urls) && loop.media_urls.length > 1 && (
                  <Badge className="border-0 bg-purple-500/12 text-caption font-semibold text-purple-400 px-2 py-0.5 shadow-none">
                    {loop.media_urls.length} files
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-9 w-9 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
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
                  onClick={onToggleLinkPreview}
                  disabled={togglingLinkPreview}
                >
                  {loop.link_preview_disabled ? (
                    <><Link2 className="h-4 w-4 mr-2" /> Show Link Preview</>
                  ) : (
                    <><Link2Off className="h-4 w-4 mr-2" /> Hide Link Preview</>
                  )}
                </DropdownMenuItem>
                {/* Branch limits belong to the root post of a tree, so a
                    branch only shows this when it has no parent. */}
                {!loop.parent_loop_id && (
                  <DropdownMenuItem onClick={onOpenBranchSettings}>
                    <SlidersHorizontal className="h-4 w-4 mr-2" /> Branch Settings
                  </DropdownMenuItem>
                )}
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
    </div>
  )
}
