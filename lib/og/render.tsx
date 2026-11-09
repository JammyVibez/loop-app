/**
 * Entry point for the OG route: parse → inline media → pick a template.
 *
 * Every image is fetched once, in parallel, and best-effort: a missing avatar
 * or a deleted upload degrades to a monogram or a hatched panel instead of
 * failing the card. Nothing here reads private data — the route only ever
 * receives what a page's `generateMetadata` decided to publish.
 */

import type { ReactElement } from "react"
import { loadImageDataUri, loadLogoDataUri } from "./media"
import { type OgType, parseOgParams } from "./params"
import { parseBool } from "./text"
import { accentFor, accentFromHex } from "./theme"
import {
  type OgPayload,
  ChallengeTemplate,
  CoLoopTemplate,
  CommunityTemplate,
  DuelTemplate,
  EventTemplate,
  FallbackTemplate,
  HomeTemplate,
  PostTemplate,
  ProfileTemplate,
  ProjectTemplate,
  ReelTemplate,
  SpaceTemplate,
} from "./templates"

export interface RenderedOg {
  type: OgType
  element: ReactElement
}

export async function renderOgImage(searchParams: URLSearchParams, origin: string): Promise<RenderedOg> {
  const draft = parseOgParams(searchParams)
  // A profile sharing its theme paints that theme's accent; everything else
  // keeps the per-type colour.
  const accent = accentFromHex(draft.accentHex, draft.accentSecondHex) || accentFor(draft.type)
  const rawType = String(searchParams.get("type") || "").toLowerCase()

  const [logo, avatar, media, background, peopleAvatars, sideAvatars] = await Promise.all([
    loadLogoDataUri(origin),
    loadImageDataUri(draft.avatar, origin),
    loadImageDataUri(draft.media, origin),
    loadImageDataUri(draft.background, origin),
    Promise.all(draft.people.map((person) => loadImageDataUri(person.avatar, origin))),
    Promise.all(draft.sides.map((person) => loadImageDataUri(person.avatar, origin))),
  ])

  const payload: OgPayload = {
    accent,
    title: draft.title,
    description: draft.description,
    body: draft.body,
    name: draft.name,
    username: draft.username,
    avatar,
    media,
    background,
    theme: draft.theme,
    date: draft.date,
    category: draft.category,
    url: draft.url,
    stat: draft.stat || undefined,
    statLabel: draft.statLabel,
    verified: draft.verified,
    premium: draft.premium,
    badgeColors: draft.badgeColors,
    progress: draft.progress,
    dateBlock: draft.dateBlock,
    extraStats: draft.extraStats,
    logo,
    people: draft.people.map((person, i) => ({ ...person, avatar: peopleAvatars[i] })),
    sides: draft.sides.map((person, i) => ({ ...person, avatar: sideAvatars[i] })),
  }

  return { type: draft.type, element: templateFor(draft.type, payload, rawType, searchParams) }
}

function templateFor(
  type: OgType,
  payload: OgPayload,
  rawType: string,
  searchParams: URLSearchParams,
): ReactElement {
  const isCode = rawType === "developer" || parseBool(searchParams.get("code"))

  switch (type) {
    case "home":
      return <HomeTemplate p={payload} />
    case "post":
      return <PostTemplate p={payload} kicker={isCode ? "Code" : "Post"} />
    case "profile":
      return <ProfileTemplate p={payload} />
    case "community":
      return <CommunityTemplate p={payload} />
    case "space":
      return <SpaceTemplate p={payload} />
    case "duel":
      return <DuelTemplate p={payload} />
    case "coloop":
      return <CoLoopTemplate p={payload} />
    case "reel":
      return <ReelTemplate p={payload} />
    case "project":
      return <ProjectTemplate p={payload} />
    case "event":
      return <EventTemplate p={payload} />
    case "challenge":
      return <ChallengeTemplate p={payload} />
    default:
      return <FallbackTemplate p={payload} />
  }
}
