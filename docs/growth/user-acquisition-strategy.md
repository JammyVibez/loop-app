# User acquisition strategy — beyond the launch posts

`docs/growth/launch-posts.md` covers *what to say*. This covers *where else to say it,
what to fix first so it converts, and how to build a repeatable loop* — all $0-budget.

## 0. Fix the leaks before you drive traffic

No amount of posting matters if visitors bounce. Two things shipped in this session that
directly affect conversion:

- **Sitemap now lists real profiles/loops/circles** (`app/sitemap.ts`) — before this,
  Google could only ever find ~13 static pages. Submit the sitemap in
  [Google Search Console](https://search.google.com/search-console) once (free, 5 minutes) —
  this alone compounds for months with zero ongoing effort.
- **OG images are now per-type and real** (loop/profile/circle/developer) — every link you
  or a user shares on Twitter/Discord/Slack now renders a real preview card instead of a
  generic badge. This is a conversion lever you already have; use it (see §3).

Before spending effort on new traffic sources, walk your own signup funnel as a stranger
would (incognito window): landing → signup → onboarding → first post. Any point where you
hesitate or get confused is a point where a real visitor leaves for good. Fixing that is
worth more than any single Reddit post.

## 1. Ride the algorithm you already have: Co-Loop as a growth loop, not just a feature

Co-Loop is the one feature that *requires* a second person. That's a built-in invite
mechanic most social apps have to fake with "invite 3 friends for a badge" — yours is
structural:

- When a user starts a Co-Loop session, if their invitee isn't on Loop yet, the invite link
  should be the *easiest, most obvious* path to signup (confirm this is true today — check
  `app/co-loop/join/[session]/page.tsx`'s handling of a logged-out visitor).
- After you publish a Co-Loop, both authors' profiles now show it (fixed earlier this
  project) — encourage both people to share it, since it's credited to both and looks
  unusual/interesting to their followers who've never seen two authors on one post.
- Message creators directly: "Co-write a post with a friend, tag me, I'll boost it." This
  costs nothing and gives you real usage data on the feature you're proudest of.

## 2. Show Developer Hub work where developers already look for it

You already have real syntax highlighting, forking, and file attachments — that's honest
"portfolio" content, not filler. Developers actively search these channels for tools:

- **Show HN** (news.ycombinator.com) — post once you have a couple of real Developer Hub
  projects to point to as examples, not on day one. HN punishes anything that reads as
  generic; lead with the Co-Loop/syntax-highlighter engineering story from
  `docs/growth/launch-posts.md`'s r/webdev draft, adapted to HN's tone (drier, more
  technical, no emoji).
- **IndieHackers.com** — "I'm building" threads there reward transparent metrics and
  problems, not polish. Post your real numbers (even small ones) and what's broken — this
  audience trusts honesty over hype, which matches your product's whole ethos.
- **Coding bootcamp / CS club Discords and Slacks** — bootcamp grads need something to show
  off that isn't another to-do app clone. A DM to a bootcamp's community manager offering
  "post your capstone project on our Developer Hub, verified badge for the first 20" costs
  nothing and gets you real, high-quality developer content that then attracts more
  developers (content begets content).
- **Answer real questions, don't drop links.** On Stack Overflow, r/learnprogramming, or
  Discord help channels, when someone asks "where can I show off X and get feedback,"
  mention Loop's Developer Hub as one option among real ones. Link-dropping without context
  gets you banned; genuinely helping and mentioning it once in ten helpful answers builds
  trust that converts.

## 3. Make sharing look good by default (you just built the infrastructure for this)

Since OG images are now real and per-type, every place a user can share something is a
free ad, but only if the share flow actually points people to a public, indexable URL:

- Audit every "Share" button (loops, circles, developer projects) to confirm it copies a
  real public link (not a `/app/...` client-route that 404s for a logged-out visitor).
  The circle post share button was fixed this session — check reels and streams too.
- Add "Share to X/Twitter" as an explicit one-tap option (not just copy-link) on high-effort
  content — Co-Loop publishes, developer projects, and circle events are the most
  "interesting to an outsider" content types you have.

## 4. Turn your existing users into your sales team (community-led growth)

You already shipped custom roles/permissions for circle admins. Use that:

- Personally message your 5–10 most active circle owners: give them a real reason to invite
  people (e.g. "circles with 20+ active members get an early Verified Community badge").
  This is honest — no fake urgency, just a real incentive tied to real activity.
- Check `/invite` referral dashboard weekly. Whoever is actually bringing in users
  organically is worth a direct thank-you and maybe a first look at new features before
  anyone else. People who already believe in the product are your cheapest growth channel.

## 5. Product Hunt, but sequenced correctly

Product Hunt is free and can spike a few hundred visits in a day — but only if used at the
right time:

- Don't launch on Product Hunt until the core signup → first-post path has no dead ends
  (see §0) — a PH spike with a broken funnel wastes the one shot you get (re-launching the
  same product converts far worse).
- When you do launch: post at 12:01am PT (when the daily PH clock resets), have 5–10 people
  you know ready to upvote/comment genuinely in the first hour (early momentum decides PH's
  ranking algorithm), and answer every comment yourself within the day.

## 6. A lightweight weekly loop, not a one-time push

Growth from zero budget is about consistency more than any single channel. A sustainable
weekly cadence:

1. **Monday** — check `/invite` and Creator Studio for the past week's real numbers.
2. **Tuesday/Wednesday** — one piece of real content (a devlog post, a "here's a bug I
   fixed and why" writeup, or a feature walkthrough) posted to one channel from
   `launch-posts.md`, rotating channels week to week so you're not spamming the same
   audience.
3. **Thursday** — one genuine, non-promotional contribution to a community you're not
   trying to sell to yet (answer a question, comment thoughtfully on someone else's launch).
4. **Friday** — DM 2–3 people directly (a bootcamp grad with a good project, an active
   circle owner, a Co-Loop user) with something specific and personal, not a template.

This is slower than a viral post, but it compounds — and it matches the same principle the
rest of this project has followed: real, honest, and sustainable over hyped and hollow.
