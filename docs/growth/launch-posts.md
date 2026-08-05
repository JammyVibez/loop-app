# Launch / invite posts — ready to copy-paste

These are honest, non-hyped drafts for announcing Loop on developer- and creator-facing
communities. They only describe features that actually ship today (see
`components/landing/landing-content.tsx` for the source of truth on what's real vs. roadmap).
Swap `https://loop-app-xi.vercel.app` for your real domain if it changes, and swap
`YOUR_USERNAME` in the invite links for your actual Loop username so referrals are tracked
(`/invite` dashboard shows who joined through your link).

Post one variant at a time, a few days apart, on the subreddits/servers where it's actually
on-topic — don't spam the same copy everywhere at once.

---

## 1. dev.to article

**Title:** I built a social app where developers can share code, fork each other's snippets, and co-write posts live

**Tags:** `webdev`, `opensource`, `showdev`, `nextjs`

```markdown
Most social platforms treat developers like everyone else — a text box and a like button.
I wanted a feed that actually understands code, so I built **Loop**.

## What it actually does today

- **Developer Hub** — post a project with a real syntax-highlighted code snippet, attach
  files, tag the language/framework, and let other devs fork or star it. No "code screenshot"
  workarounds.
- **Co-Loop** — invite someone into a live studio and co-author a post together in real time:
  shared cursor, shared chat, one publish button for both of you. Good for pair-writing a
  postmortem, a README, or just riffing on an idea with a friend.
- **Branchable Loops** — replying branches into a new post instead of flattening into a
  scroll, so long technical discussions stay readable as a tree.
- **Circles** — public or private communities with real-time chat, events, and roles. Private
  Circles require the owner to approve join requests before you can see or post anything
  inside — no silently public "private" groups.
- **Browser live streaming** — go live from the browser with camera or screen share, no
  install. Best for small-to-mid audiences right now (mesh/WebRTC under the hood); I'm
  honest about that limit in the product instead of pretending it scales infinitely.
- **Loop Coins** — a real Stripe-backed economy for tipping/gifting creators. No fake demo
  balances.

## What's next (not pretending it's done)

- A public developer API (OAuth apps, API keys) so people can build *on* Loop, not just
  share code inside it.
- Bigger live rooms via dedicated streaming infra once mesh WebRTC hits its ceiling.
- Deeper creator analytics in Creator Studio.

## Try it

https://loop-app-xi.vercel.app/signup?ref=YOUR_USERNAME

It's free to sign up. Would genuinely love feedback from other devs on the Developer Hub and
Co-Loop — that's the part I think is actually different from what's already out there.
```

---

## 2. Reddit — r/SideProject / r/InternetIsBeautiful

**Title:** Built a social app where two people can co-write a post live, and devs can fork each other's code snippets

```text
Hey r/SideProject — been heads-down on this for a while and wanted real feedback instead of
just shipping into the void.

Loop is a social app built around two things I couldn't find anywhere else:

1. **Co-Loop** — invite a friend into a live studio and write one post together in real
   time (shared cursor + chat), then publish it as a joint post credited to both of you.
2. **Developer Hub** — share code with actual syntax highlighting, attach files, and let
   other people fork/star your project like a lightweight GitHub-meets-Twitter.

It also has regular loops/reels, browser-based live streaming (camera or screen share, no
install), and Circles (communities with real-time chat + events — private ones require
approval to join, so they're actually private).

There's a Stripe-backed coin system for tipping creators, which was more work than the
whole rest of the app combined, but I didn't want another social app with fake "coins" that
don't do anything.

Link: https://loop-app-xi.vercel.app/signup?ref=YOUR_USERNAME

Genuinely want to know: does Co-Loop make sense as a feature, or is it a solution looking
for a problem? Roasting welcome.
```

---

## 3. Reddit — r/webdev (more technical angle)

**Title:** Shipped syntax-highlighted, forkable code posts + a live co-authoring mode in my Next.js social app

```text
Sharing this here because it's more of a "here's how I built X" than a straight launch post.

Stack: Next.js 15 App Router, TypeScript, Supabase (Postgres + Realtime + Auth), Cloudinary
for media, Stripe for payments, raw WebRTC for live streaming.

Two features I think are worth a look from a build perspective:

- **Real-time co-authoring (Co-Loop):** two users share a draft session — live presence,
  live text sync, single publish action that credits both authors. Built on Supabase
  Realtime channels rather than a dedicated CRDT lib, which was a fun set of tradeoffs
  around conflict resolution at small scale.
- **Developer Hub:** project posts with real Prism-based syntax highlighting (had to fight
  a nasty `tokenizePlaceholders` crash from mixing `prism-react-renderer` with manually
  loaded language grammars — switched to `react-syntax-highlighter`'s `PrismLight` build and
  it's been solid since), fork/star counts, and optional file attachments so you're not
  forced to paste code just to share a project.

It's live at https://loop-app-xi.vercel.app if anyone wants to poke at it or trade notes on
the realtime/Supabase side of things. Signup: https://loop-app-xi.vercel.app/signup?ref=YOUR_USERNAME
```

---

## 4. Twitter / X thread

```text
1/ Spent the last stretch building Loop — a social app where creators post loops/reels/live,
and developers actually get a real home for their code. Not another generic feed clone.

2/ The feature I'm most proud of: Co-Loop. Invite a friend into a live studio, write one
post together in real time (shared cursor, shared chat), publish it as a joint post credited
to both of you. Nobody else lets two people co-author a single post live.

3/ Developer Hub: real syntax-highlighted code posts, file attachments, fork + star — like a
lightweight GitHub feed built into a social app instead of a wall of screenshotted code.

4/ Circles: public or private communities with real-time chat, events, and custom member
roles. Private Circles actually stay private — join requests need owner approval before you
see anything inside.

5/ Browser live streaming, no install: camera or screen share, live chat, gifts. Built on
WebRTC — great for smaller rooms today, and I'm not going to pretend it scales to 10k
viewers until the infra actually does.

6/ Loop Coins: real Stripe checkout, real payouts to creators. No fake demo balances, no
"coming soon" wallet.

7/ It's free, it's live, and I'd love blunt feedback — especially on Co-Loop and the
Developer Hub since those are the parts I think are actually different.

https://loop-app-xi.vercel.app/signup?ref=YOUR_USERNAME
```

---

## 5. Discord (indie hacker / dev community servers)

**Short version — for #show-your-work / #self-promo channels:**

```text
👋 Been building **Loop** — a social app for creators *and* developers.

The two things that make it different from a generic feed clone:
• **Co-Loop** — write a post together with someone else, live, in a shared studio (one publish, joint credit)
• **Developer Hub** — real syntax-highlighted code posts, file attachments, fork/star — not just screenshots of code

Also has: circles/communities (private ones need owner approval to join), browser live streaming (no install), and a real Stripe-backed coin economy for tipping creators — no fake balances.

Free to try: https://loop-app-xi.vercel.app/signup?ref=YOUR_USERNAME
Would love feedback from this server specifically on the Developer Hub — that's the part built for people like us.
```

**Even shorter — for invite-link/self-promo threads with strict length limits:**

```text
Loop — social app with live co-authored posts (Co-Loop), a real Developer Hub (syntax
highlighting, forking, file attachments), and Stripe-backed creator tipping.
https://loop-app-xi.vercel.app/signup?ref=YOUR_USERNAME
```

---

## Notes on tracking results

- Every link above uses `?ref=YOUR_USERNAME`, which the signup flow captures into
  `profiles.invited_by_username`. Check `/invite` after posting to see who joined through
  your link — that's the same referral dashboard shipped earlier in this project.
- **Keep `ref` exactly equal to your real username.** The referral dashboard looks up
  `invited_by_username` with an exact (case-insensitive) match against your username, so a
  UTM-style suffix like `?ref=you-devto` will NOT match your profile and that signup will
  silently not be attributed to you at all. If you want per-platform attribution, stagger
  posts by a day or two and eyeball the `created_at` timestamps in `/invite` instead of
  encoding the channel into the link.
