/**
 * OG Image Router — lightweight entry point that delegates to per-type templates.
 *
 * Rendered via `next/og` ImageResponse at /api/og.
 * The actual rendering logic lives in lib/og-templates/.
 */
import type { ReactElement } from "react"
import { loadOgFonts } from "./og-tokens"
import { HomepageOG, type HomepageOgProps } from "./og-templates/homepage"
import { CommunityOG, type CommunityOgProps } from "./og-templates/community"
import { ProfileOG, type ProfileOgProps } from "./og-templates/profile"
import { LoopOG, type LoopOgProps } from "./og-templates/loop"
import { CoLoopOG, type CoLoopOgProps } from "./og-templates/coloop"
import { DuelOG, type DuelOgProps } from "./og-templates/duel"
import { ReelOG, type ReelOgProps } from "./og-templates/reel"
import { LiveOG, type LiveOgProps } from "./og-templates/live"
import { ProjectOG, type ProjectOgProps } from "./og-templates/project"
import { EventOG, type EventOgProps } from "./og-templates/event"
import { ChallengeOG, type ChallengeOgProps } from "./og-templates/challenge"

export { loadOgFonts } from "./og-tokens"

// Re-export types for backward compat
export type { OgType } from "./og-templates"

export interface OgImageProps {
  title?: string
  description?: string
  type?: string
  username?: string
  avatar?: string
  verified?: boolean
  stat?: string
  statLabel?: string
  // Extended props from DB data
  category?: string
  banner?: string
  memberCount?: number
  activeCount?: number
  isPrivate?: boolean
  followersCount?: number
  isPremium?: boolean
  mediaUrl?: string
  contributorCount?: number
  contributorAvatars?: string[]
  voteCount?: number
  viewerCount?: number
  progress?: number
  status?: string
  startDate?: string
  endDate?: string
  endsAt?: string
  attendeeCount?: number
  participantCount?: number
  communityName?: string
}

/**
 * Routes to the correct OG template based on type.
 * Legacy aliases (circle, developer) map to their modern equivalents.
 */
export function OgImage(props: OgImageProps): ReactElement {
  const type = (props.type || "home").toLowerCase()

  switch (type) {
    case "community":
    case "circle":
      return (
        <CommunityOG
          name={props.title}
          description={props.description}
          category={props.category}
          avatar={props.avatar}
          banner={props.banner}
          memberCount={props.memberCount}
          activeCount={props.activeCount}
          isPrivate={props.isPrivate}
          isVerified={props.verified}
        />
      )

    case "profile":
      return (
        <ProfileOG
          displayName={props.title?.replace(/ — Profile.*$/, "").replace(/@\w+ on loopapp\.me$/, "").trim() || props.title}
          username={props.username}
          bio={props.description}
          avatar={props.avatar}
          isVerified={props.verified}
          followersCount={props.followersCount ? Number(props.followersCount) : undefined}
          isPremium={props.isPremium}
        />
      )

    case "loop":
    case "developer":
      return (
        <LoopOG
          title={props.title}
          description={props.description}
          username={props.username}
          avatar={props.avatar}
          verified={props.verified}
          stat={props.stat}
          statLabel={props.statLabel}
        />
      )

    case "coloop":
      return (
        <CoLoopOG
          title={props.title}
          description={props.description}
          username={props.username}
          avatar={props.avatar}
          verified={props.verified}
          contributorCount={props.contributorCount}
          contributorAvatars={props.contributorAvatars}
        />
      )

    case "duel":
      return (
        <DuelOG
          title={props.title}
          description={props.description}
          username={props.username}
          avatar={props.avatar}
          verified={props.verified}
          voteCount={props.voteCount}
        />
      )

    case "reel":
      return (
        <ReelOG
          title={props.title}
          description={props.description}
          username={props.username}
          avatar={props.avatar}
          verified={props.verified}
          mediaUrl={props.mediaUrl}
        />
      )

    case "live":
      return (
        <LiveOG
          title={props.title}
          description={props.description}
          username={props.username}
          viewerCount={props.viewerCount}
        />
      )

    case "project":
      return (
        <ProjectOG
          title={props.title}
          description={props.description}
          contributorCount={props.contributorCount}
          progress={props.progress}
          status={props.status}
        />
      )

    case "event":
      return (
        <EventOG
          title={props.title}
          description={props.description}
          startDate={props.startDate}
          attendeeCount={props.attendeeCount}
          communityName={props.communityName}
        />
      )

    case "challenge":
      return (
        <ChallengeOG
          title={props.title}
          description={props.description}
          endsAt={props.endsAt}
          participantCount={props.participantCount}
          communityName={props.communityName}
        />
      )

    case "home":
    default:
      return (
        <HomepageOG
          title={props.title}
          description={props.description}
          avatar={props.avatar}
          verified={props.verified}
          stat={props.stat}
          statLabel={props.statLabel}
        />
      )
  }
}
