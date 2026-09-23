/**
 * Campaign presets for the admin broadcast composer.
 *
 * Selecting a preset auto-fills the composer (subject → title, preview →
 * preview text, cta/actionUrl → button, body → message). Every field stays
 * editable before sending, so presets are starting points, not locks.
 *
 * Kept in one small data file so copy can be tuned without touching the UI
 * or the API route.
 */

export type BroadcastTone =
  | "hype"
  | "warm"
  | "urgent"
  | "celebration"
  | "playful"
  | "reminder"
  | "reward"
  | "digest"

export type BroadcastPreset = {
  id:
    | "community_buzz"
    | "re_engagement"
    | "feature_launch"
    | "creator_spotlight"
    | "challenge"
    | "event_reminder"
    | "rewards"
    | "weekly_digest"
  label: string
  subtitle: string
  subject: string
  preview: string
  cta: string
  actionUrl: string
  tone: BroadcastTone
  body: string
}

export const BROADCAST_PRESETS: BroadcastPreset[] = [
  {
    id: "community_buzz",
    label: "Community Buzz",
    subtitle: "Ride a hot moment in the feed",
    subject: "This conversation on Loop is blowing up 🌀",
    preview: "Everyone's jumping in — don't miss the peak of the thread.",
    cta: "Join the conversation",
    actionUrl: "/explore",
    tone: "hype",
    body: `Something big is happening on Loop right now.

Creators are posting, threads are branching, and the best takes are rising fast. Pull up a seat and add your voice while the conversation is hot.

Open the feed to see what the community is talking about.`,
  },
  {
    id: "re_engagement",
    label: "Re-engagement",
    subtitle: "Win back quiet members",
    subject: "Your feed missed you 👀",
    preview: "New Loops, new faces, new drops — catch up in two minutes.",
    cta: "Jump back in",
    actionUrl: "/",
    tone: "warm",
    body: `It's been a minute.

Since your last visit, the community hasn't slowed down — new Circles, fresh Duels, and plenty of conversations worth reading.

Take two minutes to catch up. Your people are already here.`,
  },
  {
    id: "feature_launch",
    label: "Feature Launch",
    subtitle: "Ship a new capability",
    subject: "New on Loop: something you'll actually use daily 🚀",
    preview: "We just shipped a brand-new way to create and connect.",
    cta: "Try it now",
    actionUrl: "/",
    tone: "hype",
    body: `We just shipped something new.

It's built for the way you already use Loop — faster creation, smoother collaboration, and fewer taps between an idea and a post.

Be one of the first to try it. Open Loop and look for the new experience on your feed.`,
  },
  {
    id: "creator_spotlight",
    label: "Creator Spotlight",
    subtitle: "Celebrate a stand-out creator",
    subject: "This creator is having a moment ⭐",
    preview: "See the work the whole community is talking about.",
    cta: "See their work",
    actionUrl: "/explore",
    tone: "celebration",
    body: `Every week, one creator cuts through the noise.

This week, the community can't stop sharing, branching, and boosting their Loops. See what the buzz is about — and maybe drop a follow.

Great work deserves an audience. Let's give them one.`,
  },
  {
    id: "challenge",
    label: "Challenge",
    subtitle: "Kick off a community challenge",
    subject: "The Loop Challenge is LIVE — are you in? 🏆",
    preview: "Post your take, rally your Circle, and climb the board.",
    cta: "Enter the challenge",
    actionUrl: "/games",
    tone: "playful",
    body: `Challenge time.

Post your best take on the theme, rally your Circle to boost it, and climb the board before the clock runs out.

Top entries get featured on the feed and rewarded with coins. Hit the button to see the full rules and start your entry.`,
  },
  {
    id: "event_reminder",
    label: "Event Reminder",
    subtitle: "Drive attendance to an event",
    subject: "Starting soon — don't miss it ⏰",
    preview: "Your event is about to go live. Save your spot now.",
    cta: "Save my spot",
    actionUrl: "/events",
    tone: "urgent",
    body: `It's almost time.

The event you cared about is kicking off soon, and spots are filling up. Make sure you're in the room when it starts.

Tap through to confirm your spot and get a reminder the moment doors open.`,
  },
  {
    id: "rewards",
    label: "Rewards",
    subtitle: "Announce coins, perks, or drops",
    subject: "You've got rewards waiting 🎁",
    preview: "Coins, perks, and something extra — claim before they expire.",
    cta: "Claim your rewards",
    actionUrl: "/earnings",
    tone: "reward",
    body: `Good news — rewards are waiting for you.

Coins from your recent activity, plus a little extra from the platform, are ready to collect. They won't sit in your account forever, so claim them while they're live.

Open your earnings page to see exactly what's yours.`,
  },
  {
    id: "weekly_digest",
    label: "Weekly Digest",
    subtitle: "Summarize the week on Loop",
    subject: "Your week on Loop, in 60 seconds ⏡",
    preview: "The top Loops, biggest Duels, and best moments of the week.",
    cta: "Read the digest",
    actionUrl: "/explore",
    tone: "digest",
    body: `Here's your weekly recap.

The feed moved fast this week — trending Loops, surprise Duel results, new Circles worth joining, and creators on the rise.

Catch up in under a minute, then jump back in for the week ahead.`,
  },
]

export function getBroadcastPreset(id: string | null | undefined): BroadcastPreset | undefined {
  if (!id) return undefined
  return BROADCAST_PRESETS.find((p) => p.id === id)
}
