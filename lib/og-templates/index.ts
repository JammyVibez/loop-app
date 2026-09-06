/**
 * OG Template Router — selects the correct template for each page type.
 */
export { HomepageOG, type HomepageOgProps } from "./homepage"
export { CommunityOG, type CommunityOgProps } from "./community"
export { ProfileOG, type ProfileOgProps } from "./profile"
export { LoopOG, type LoopOgProps } from "./loop"
export { CoLoopOG, type CoLoopOgProps } from "./coloop"
export { DuelOG, type DuelOgProps } from "./duel"
export { ReelOG, type ReelOgProps } from "./reel"
export { LiveOG, type LiveOgProps } from "./live"
export { ProjectOG, type ProjectOgProps } from "./project"
export { EventOG, type EventOgProps } from "./event"
export { ChallengeOG, type ChallengeOgProps } from "./challenge"

/** All supported OG types */
export type OgType =
  | "home"
  | "community"
  | "profile"
  | "loop"
  | "coloop"
  | "duel"
  | "reel"
  | "live"
  | "project"
  | "event"
  | "challenge"
  // Legacy aliases
  | "circle"
  | "developer"
