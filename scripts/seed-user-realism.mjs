// One-off data-quality pass: replace the templated seed users' bios and
// posts (which reused only ~10 stock sentences across 20 accounts, with
// verbatim duplicates and sequential loop_coins) with distinct, specific
// content per user so the platform doesn't read as obviously seeded.
//
// Usage: node scripts/seed-user-realism.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

// Each entry: username -> { bio, loop_coins, posts: [{ match (old content substring), content, hashtags }] }
const USERS = {
  avariver: {
    bio: "Solo-building Nudge, a tiny habit tracker, in public. No investors, no roadmap slides — just shipping and writing about what breaks.",
    loop_coins: 1840,
    posts: [
      { match: "Hot take: Circles", content: "Spent all weekend rewriting Nudge's streak logic because it was double-counting timezone changes. Found it because a beta tester in Auckland flagged their streak reset at the wrong hour. Small bug, real user, worth the Saturday.", hashtags: ["buildinpublic", "indiehacker"] },
      { match: "Branching this idea", content: "Someone in the Nudge Circle branched my onboarding copy and honestly their version is better than mine. That's the whole reason I post drafts instead of finished screens now.", hashtags: ["buildinpublic", "coloop"] },
      { match: "Shipping loops feels like planting trees", content: "47 people have Nudge installed. That's it, that's the update. Feels bigger than the number.", hashtags: ["buildinpublic", "milestone"] },
    ],
  },
  ninacole: {
    bio: "Write a weekly newsletter (Quiet Quitting the Grind) about remote work culture. 6k subscribers, still edit every issue by hand.",
    loop_coins: 2130,
    posts: [
      { match: "Just dropped a reel", content: "Recorded a 90-second reel on why 'always-on Slack' is a management failure, not a culture problem. Getting more replies from managers than I expected — some defensive, most relieved someone said it.", hashtags: ["remotework", "newsletter"] },
      { match: "Hot take: Circles", content: "Unpopular opinion for a newsletter writer: my Loop Circle gives me better feedback on drafts than my actual editor does. Nobody's being polite in there.", hashtags: ["remotework"] },
      { match: "Branching this idea", content: "Asked my Circle what 'quiet quitting' actually means to them before this week's issue goes out. Got 30 replies in an hour and completely rewrote my thesis. This is why I post drafts here first.", hashtags: ["remotework", "newsletter"] },
      { match: "Shipping loops feels like planting trees", content: "Issue #62 just went out — the one about async standups. Took three rewrites to stop sounding preachy. Grateful to the three people who told me draft two still sounded preachy.", hashtags: ["newsletter"] },
    ],
  },
  noahbloom: {
    bio: "Product designer at a 12-person fintech startup. Obsessed with onboarding flows — I redesign apps I don't work on just to see if I can cut a step.",
    loop_coins: 1975,
    posts: [
      { match: "Building in public on Loop hits different", content: "Redesigned Robinhood's deposit flow in Figma last night for fun. Cut it from 6 screens to 4 by combining the bank-linking and amount steps. Probably breaks some compliance requirement I don't know about, but it felt good.", hashtags: ["uxdesign", "fintech"] },
      { match: "Just dropped a reel", content: "Quick reel on why most signup forms ask for your name before they've earned the right to ask. Order of operations matters more than field count.", hashtags: ["uxdesign"] },
      { match: "Hot take: Circles", content: "Controversial in my design Circle: skeleton loaders are often worse than a plain spinner, because they set expectations about layout that then shift when real content loads.", hashtags: ["uxdesign"] },
      { match: "Branching this idea", content: "Branched off someone's empty-state redesign with a version that uses the user's own first action as the CTA copy instead of generic 'Get started'. Small change, converts better in every test I've run.", hashtags: ["uxdesign", "coloop"] },
    ],
  },
  theohart: {
    bio: "Design systems engineer. I care more about your focus states and color contrast ratios than your gradient. Screen reader tested everything I ship.",
    loop_coins: 1690,
    posts: [
      { match: "Who else is grinding Co-Loops today?", content: "Pairing with a co-author on a Loop about accessible form validation — turns out neither of us agreed on when error messages should announce to screen readers. Great argument to have in public.", hashtags: ["a11y", "coloop"] },
      { match: "Building in public on Loop hits different", content: "Audited our design system's button component for focus-visible states today. Found three variants that were completely unreachable by keyboard. Shipping the fix before anything else this sprint.", hashtags: ["a11y", "designsystems"] },
      { match: "Just dropped a reel", content: "Made a short reel comparing four popular component libraries' color contrast on disabled buttons. Two of them fail WCAG AA. Naming names in the comments if anyone asks.", hashtags: ["a11y"] },
      { match: "Hot take: Circles", content: "Hot take: 'we'll add accessibility later' always means never. Bake it into the component API on day one or it never happens.", hashtags: ["a11y", "designsystems"] },
      { match: "Branching this idea", content: "Someone branched my token-naming proposal and suggested semantic names over color names (surface-danger instead of red-500). Merging that into the system today — better call.", hashtags: ["designsystems", "coloop"] },
    ],
  },
  miastone: {
    bio: "Bedroom producer — lo-fi and ambient synths. Also write small Web Audio API tools because plugins never do exactly what I want.",
    loop_coins: 2210,
    posts: [
      { match: "Design tip: one job per section", content: "Built a tiny Web Audio API delay pedal in the browser last night instead of buying another plugin. Latency's a bit rough but the tone is exactly the murky thing I wanted for this track.", hashtags: ["musicproduction", "webaudio"] },
      { match: "Who else is grinding Co-Loops today?", content: "Dropping a 40-second loop of a pad chord progression I've been stuck on for a week. If anyone wants to branch it into something with drums, please do — I clearly can't finish it alone.", hashtags: ["lofi", "coloop"] },
      { match: "Building in public on Loop hits different", content: "Three failed mixdowns this week because my low end was fighting the kick. Finally just sidechained everything to the kick like a normal person instead of EQ-ing forever.", hashtags: ["musicproduction"] },
      { match: "Just dropped a reel", content: "New ambient track up — recorded the whole thing through a cassette deck for the tape hiss, then re-digitized it. Sounds like it's from an old VHS and I'm obsessed.", hashtags: ["ambient", "lofi"] },
      { match: "Hot take: Circles", content: "Hot take: most 'lo-fi' presets sound too clean now. The genre got so popular the imperfections became a preset instead of an accident.", hashtags: ["lofi", "musicproduction"] },
    ],
  },
  ariaquinn: {
    bio: "Beatmaker, mostly boom-bap and neo-soul samples. Teaching myself Python this year to build my own sample-chopping tool.",
    loop_coins: 1580,
    posts: [
      { match: "Building in public on Loop hits different", content: "Wrote my first working Python script that auto-detects BPM from a sample folder. Took four evenings and a lot of StackOverflow, but now I don't have to tap tempo by hand for 200 files.", hashtags: ["python", "beatmaking"] },
      { match: "Just dropped a reel", content: "New beat up — chopped a jazz record my dad gave me, sped it up 12%, added a boom-bap drum pattern. This one's for him.", hashtags: ["beatmaking", "neosoul"] },
      { match: "Hot take: Circles", content: "Hot take: sample clearance culture killed a whole style of hip-hop production. Everyone plays it too safe with royalty-free packs now.", hashtags: ["beatmaking"] },
    ],
  },
  leofrost: {
    bio: "Run a small 'Coffee & Co-Loops' morning writing group — we meet in a Circle, drink coffee, and co-author a Loop before anyone's fully awake.",
    loop_coins: 1420,
    posts: [
      { match: "Who else is grinding Co-Loops today?", content: "Coffee & Co-Loops this morning: eight of us, one shared doc, zero coffee left by the time we published. Today's Loop is about the worst advice we ever took seriously.", hashtags: ["coloop", "morningroutine"] },
      { match: "Building in public on Loop hits different", content: "Third-wave pour-over update: switched from a V60 to a Kalita Wave and my mornings got noticeably less bitter. Small change, real difference.", hashtags: ["coffee"] },
      { match: "Just dropped a reel", content: "Recorded this morning's Co-Loop session start to finish. Watching eight strangers argue about a single sentence for ten minutes is oddly satisfying content.", hashtags: ["coloop"] },
    ],
  },
  judebeck: {
    bio: "Barista at an independent roastery, building a coffee subscription side project on nights off. Will talk your ear off about water temperature.",
    loop_coins: 1350,
    posts: [
      { match: "Design tip: one job per section", content: "Redesigned the checkout page for my coffee subscription idea — one job per screen, no more asking for shipping and billing on the same page. Conversion in my head-canon test group of two (my roommates) is up.", hashtags: ["sidehustle", "coffee"] },
      { match: "Who else is grinding Co-Loops today?", content: "Slow morning at the roastery so I'm answering: yes, still grinding on the subscription box idea. Today's problem is figuring out shipping costs that don't eat the whole margin.", hashtags: ["coffee", "sidehustle"] },
      { match: "Building in public on Loop hits different", content: "192°F, not 200°F — that's the whole secret to why your pour-over tastes bitter. Water that's too hot over-extracts. Free brewing advice from a guy who's dialed in 40 different roasts this year.", hashtags: ["coffee"] },
      { match: "Just dropped a reel", content: "Filmed a reel behind the counter timing three pour-over methods side by side. Kalita won on consistency, V60 won on flavor clarity. Chemex is just for looking cool, fight me.", hashtags: ["coffee"] },
    ],
  },
  zoesky: {
    bio: "Collect and review Loop themes/skins — I've bought way too many marketplace cosmetics and now I just tell people which ones are worth it.",
    loop_coins: 1290,
    posts: [
      { match: "Realtime chat in circles is underrated", content: "The new Aurora theme pack looks incredible in screenshots but the particle effects tank scroll performance on my three-year-old phone. Sadly can't recommend until they optimize it.", hashtags: ["loopthemes"] },
      { match: "Design tip: one job per section", content: "Ranked every profile banner style in the shop by 'actually improves readability of your bio' vs 'just looks cool'. Half of them fail the first test.", hashtags: ["loopthemes"] },
      { match: "Who else is grinding Co-Loops today?", content: "Someone in my Circle asked which theme pairs best with a dark mode profile without washing out avatar colors — did a full side-by-side and posting results tonight.", hashtags: ["loopthemes"] },
      { match: "Building in public on Loop hits different", content: "Finally found a theme + cosmetic combo that doesn't clash with Co-Loop's cyan accent color. It only took me 340 Loop Coins and three weeks of trial and error.", hashtags: ["loopthemes"] },
    ],
  },
  siashaw: {
    bio: "New here — still figuring out which Circles fit me. So far: plant care, mediocre home cooking, and whatever this app's version of 'main character energy' is.",
    loop_coins: 980,
    posts: [
      { match: "Theme shopping then posting", content: "Joined a plant-care Circle today because my monstera has been judging me silently for weeks. Turns out I've been overwatering it, obviously.", hashtags: ["plants", "newhere"] },
      { match: "Realtime chat in circles is underrated", content: "Didn't expect a Circle full of strangers to help me talk through a decision about whether to move cities, but here we are, three hours deep in a group chat with people I met yesterday.", hashtags: ["newhere"] },
      { match: "Design tip: one job per section", content: "Trying to figure out this app's whole vibe still. Posted a rambly loop about my week and got more genuine replies than I ever got on other platforms. Okay, I get it now.", hashtags: ["newhere"] },
      { match: "Who else is grinding Co-Loops today?", content: "First Co-Loop attempt tonight — invited a friend to write with me and we couldn't stop laughing at how bad our first draft was. Publishing anyway.", hashtags: ["coloop", "newhere"] },
      { match: "Building in public on Loop hits different", content: "Cooked something that was supposed to be risotto and became, generously, 'rice soup'. Posting it anyway because the plant Circle told me to normalize kitchen failures.", hashtags: ["cooking"] },
    ],
  },
  kailane: {
    bio: "PM at a seed-stage startup. I write about the product decisions nobody tweets about — the boring backlog triage, not the launch day.",
    loop_coins: 2050,
    posts: [
      { match: "Morning check-in: streak still alive", content: "Killed a feature today that took us six weeks to build. Usage was under 2% after three months. The hardest part of this job isn't shipping — it's admitting something you built shouldn't exist anymore.", hashtags: ["productmanagement"] },
      { match: "Theme shopping then posting — aesthetic unlocked", content: "Spent this morning's standup arguing about whether 'engagement' is even a real metric or just a number that goes up. We didn't resolve it. Backlog grooming continues tomorrow.", hashtags: ["productmanagement"] },
      { match: "Realtime chat in circles is underrated", content: "Our onboarding funnel has a 40% drop at step 3 and nobody can agree if it's the copy or the form length. Running an A/B test this week — will report back with actual numbers, not vibes.", hashtags: ["productmanagement"] },
      { match: "Design tip: one job per section", content: "Best PM advice I got this year, from an engineer, not a PM: 'ship the boring version first, then decide if the exciting version is worth the risk.' Saved us a month.", hashtags: ["productmanagement"] },
      { match: "Who else is grinding Co-Loops today?", content: "Wrote our Q3 roadmap doc as a Co-Loop with two engineers instead of a solo doc I hand off. They caught two things that would've broken in production. Doing this every quarter now.", hashtags: ["productmanagement", "coloop"] },
    ],
  },
  rexray: {
    bio: "Growth analyst who thinks retention curves are more interesting than acquisition funnels. Will judge your cohort chart's axis labels.",
    loop_coins: 1740,
    posts: [
      { match: "Realtime chat in circles is underrated", content: "Pulled our week-4 retention curve today and it's flattening at 22% instead of the usual cliff to near-zero. Something in the last onboarding change actually worked — now I have to figure out which part.", hashtags: ["growth", "analytics"] },
      { match: "Design tip: one job per section", content: "Reminder that a cohort chart without a clearly labeled y-axis is just abstract art. Seen three internal decks this month make that mistake.", hashtags: ["analytics"] },
      { match: "Who else is grinding Co-Loops today?", content: "Debugging why our activation metric jumped 15% overnight — turns out someone changed the event definition and didn't tell analytics. Classic.", hashtags: ["analytics", "growth"] },
    ],
  },
  ivycruz: {
    bio: "Street photographer, mostly film. Started turning contact sheets into short Loop stories instead of just posting the 'best' single frame.",
    loop_coins: 1610,
    posts: [
      { match: "Theme shopping then posting — aesthetic unlocked", content: "Shot a full roll of Portra 400 on a rainy Tuesday because rainy Tuesdays have the best reflections downtown. Developing tonight, posting the contact sheet either way — good or bad.", hashtags: ["streetphotography", "film"] },
      { match: "Realtime chat in circles is underrated", content: "Posting the sequence instead of the single 'hero shot' this time — six frames from one subway platform, five minutes apart. The story's in the gaps between them.", hashtags: ["streetphotography"] },
      { match: "Design tip: one job per section", content: "Someone in my photo Circle pointed out I always shoot from eye level. Spent today shooting from the hip and low angles instead. Half the roll is garbage but the good half is genuinely different.", hashtags: ["streetphotography", "film"] },
    ],
  },
  noafox: {
    bio: "Portrait photographer. Using Loop to post the messy behind-the-scenes stuff Instagram's algorithm never rewarded — bad light, awkward poses, real process.",
    loop_coins: 1875,
    posts: [
      { match: "Morning check-in: streak still alive", content: "Posting the outtakes from yesterday's shoot, not the final images — the ones where my subject is mid-laugh and I fumbled the focus. These are usually my favorite frames anyway.", hashtags: ["portraitphotography", "bts"] },
      { match: "Theme shopping then posting — aesthetic unlocked", content: "Client wanted 'golden hour but moody' which is basically an oxymoron in lighting terms. Took me three failed setups to figure out they meant underexposed and warm, not overcast.", hashtags: ["portraitphotography"] },
      { match: "Realtime chat in circles is underrated", content: "A stranger in a photography Circle talked me through fixing a lighting ratio problem I'd been stuck on for a week, over voice, for free, at 11pm. This app is weirdly good for that.", hashtags: ["portraitphotography"] },
      { match: "Design tip: one job per section", content: "Reminder to myself and anyone starting out: the 'ring light look' is not a personality. Learn one off-camera flash setup and your portraits will look ten times more intentional.", hashtags: ["portraitphotography"] },
    ],
  },
  ezravale: {
    bio: "Backend dev on the night shift (literally — I work nights). Most active in Loop's late-night circles between 1-4am when the good arguments happen.",
    loop_coins: 1520,
    posts: [
      { match: "Branching this idea with the community tonight", content: "3am and a stranger in a backend Circle just talked me out of adding a caching layer I didn't need. Saved me two days of work I would've spent on a problem I don't actually have yet.", hashtags: ["backend", "nightowl"] },
      { match: "Shipping loops feels like planting trees", content: "Deployed a fix for a race condition that only happened once every few thousand requests. Took a week to reproduce locally. Nobody but me will ever know it existed, and that's fine.", hashtags: ["backend"] },
      { match: "Morning check-in: streak still alive", content: "My 'morning' is everyone else's 2am. Just wrapped a shift, the late-night Circle is somehow still active, and someone's debugging a Postgres deadlock in real time. Love this timezone.", hashtags: ["nightowl", "backend"] },
      { match: "Theme shopping then posting — aesthetic unlocked", content: "Switched my whole setup to the darkest theme option because staring at a bright screen at 3am was wrecking my eyes. Should've done this months ago.", hashtags: ["nightowl"] },
      { match: "Realtime chat in circles is underrated", content: "The late-night dev Circle solved a deployment issue in twelve minutes that would've taken me until my next shift to figure out alone. Real-time chat when everyone else is asleep is underrated.", hashtags: ["backend", "nightowl"] },
    ],
  },
  elidawn: {
    bio: "Insomniac, mostly write short fiction between midnight and sunrise. Post the unfinished drafts because finished feels like it never happens.",
    loop_coins: 1460,
    posts: [
      { match: "Branching this idea with the community tonight", content: "Posted the opening paragraph of a story I've been stuck on for two weeks. Someone branched it with a twist I never would've thought of — continuing from their version now instead of mine.", hashtags: ["fiction", "coloop"] },
      { match: "Shipping loops feels like planting trees", content: "2am and I just finished a 500-word short piece about a lighthouse keeper who forgot why the light mattered. No idea if it's good. Posting it anyway because 2am me is more honest than daytime me.", hashtags: ["fiction", "nightowl"] },
      { match: "Morning check-in: streak still alive", content: "Technically still awake from last night, not up early. Wrote for three hours straight and have nothing coherent to show for it except forty pages of notes I'll probably never use.", hashtags: ["fiction", "nightowl"] },
      { match: "Theme shopping then posting — aesthetic unlocked", content: "The dark theme with the subtle particle effects is exactly the vibe for writing at 3am. Aesthetic definitely helps the words come out weirder, in a good way.", hashtags: ["nightowl"] },
      { match: "Realtime chat in circles is underrated", content: "Found a writing Circle that's somehow always active at 3am. Traded drafts with a stranger for an hour tonight and it's the most honest feedback I've gotten on my writing in months.", hashtags: ["fiction", "nightowl"] },
    ],
  },
  lunapark: {
    bio: "On a 140-day daily writing streak. Nothing profound about it — just showing up and posting one honest paragraph every single day.",
    loop_coins: 1330,
    posts: [
      { match: "Hot take: Circles > group chats", content: "Day 140. Today's honest paragraph: the streak stopped being about writing quality a long time ago and became about not wanting to see the counter reset to zero. That's fine, whatever works.", hashtags: ["writingstreak", "day140"] },
      { match: "Branching this idea with the community tonight", content: "Someone branched day 138's post about burnout and added their own version from a completely different job. Reading their take on the same feeling from a different angle was the best part of my week.", hashtags: ["writingstreak", "coloop"] },
      { match: "Shipping loops feels like planting trees", content: "Almost missed today's post — posted at 11:52pm from my phone in a parking lot. The streak doesn't care about quality, just consistency. Day 139 secured.", hashtags: ["writingstreak"] },
      { match: "Morning check-in: streak still alive", content: "Streak check-in: still alive at day 140. The actual milestone that matters more than the number is that I stopped dreading the daily post around day 60.", hashtags: ["writingstreak", "day140"] },
      { match: "Theme shopping then posting — aesthetic unlocked", content: "Changed my profile theme to mark hitting day 140. Small ritual, but it makes the milestone feel real instead of just a number in the corner of the app.", hashtags: ["writingstreak"] },
    ],
  },
  verayork: {
    bio: "215-day workout streak, mostly just walking and bodyweight stuff. Not chasing a physique — chasing not breaking the chain.",
    loop_coins: 1245,
    posts: [
      { match: "Shipping loops feels like planting trees", content: "Day 215. Today's workout was ten minutes because I was exhausted and that's genuinely fine — the streak rule is 'move your body on purpose,' not 'have a great session.'", hashtags: ["fitnessstreak", "day215"] },
      { match: "Morning check-in: streak still alive", content: "Streak check-in: 215 days, still going. The habit stopped being about fitness around day 100 and became about proving to myself I follow through on things. Bonus that I can also do more push-ups now.", hashtags: ["fitnessstreak"] },
      { match: "Theme shopping then posting — aesthetic unlocked", content: "Bought a new profile theme to celebrate 200 days a couple weeks back. Small reward system, works better than I expected for keeping motivation up on the bad days.", hashtags: ["fitnessstreak"] },
    ],
  },
  omarwest: {
    bio: "Weekend woodworker. Mostly small furniture and mistakes I turn into 'design choices'. Garage doubles as a workshop, badly.",
    loop_coins: 1180,
    posts: [
      { match: "Branching this idea with the community tonight", content: "Cut a shelf bracket 3/8 inch too short and instead of starting over, just made the whole design asymmetrical on purpose. Nobody who sees the finished piece will know it started as a mistake.", hashtags: ["woodworking"] },
      { match: "Shipping loops feels like planting trees", content: "Finished the side table I've been building for six weekends. It wobbles slightly on one leg and I've decided that's now 'character' rather than admitting I measured wrong.", hashtags: ["woodworking"] },
      { match: "Morning check-in: streak still alive", content: "Garage smells like sawdust and coffee this morning. Starting on a bookshelf for my kid's room — first project where the stakes feel slightly higher than 'ugly side table nobody will notice'.", hashtags: ["woodworking"] },
    ],
  },
  jonbell: {
    bio: "Home cook who follows zero recipes exactly. Posting the kitchen experiments that work and, more often, the ones that don't.",
    loop_coins: 1090,
    posts: [
      { match: "Hot take: Circles > group chats", content: "Hot take: recipe blogs make everything sound harder than it is because they need 2,000 words before the ad revenue kicks in. Most weeknight dinners are five steps, not twenty.", hashtags: ["cooking"] },
      { match: "Branching this idea with the community tonight", content: "Tried to make my grandmother's soup from memory and got the seasoning wrong in a way I can't quite name. Posting it anyway because someone in the cooking Circle might recognize what's missing.", hashtags: ["cooking"] },
      { match: "Shipping loops feels like planting trees", content: "Tonight's experiment: browning butter before adding it to cornbread batter. Small change, genuinely transformed a boring side dish. Writing this down so future me remembers.", hashtags: ["cooking"] },
      { match: "Morning check-in: streak still alive", content: "Meal-prepped four lunches this morning that all taste slightly like the same base sauce because I'm lazy about grocery shopping. Not glamorous, but it's real and it's Tuesday.", hashtags: ["cooking"] },
    ],
  },
}

async function main() {
  let profilesUpdated = 0
  let loopsUpdated = 0
  let loopsSkipped = 0

  for (const [username, data] of Object.entries(USERS)) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle()

    if (profileErr || !profile) {
      console.warn(`[skip] profile not found: ${username}`, profileErr?.message)
      continue
    }

    const { error: updateProfileErr } = await supabase
      .from("profiles")
      .update({ bio: data.bio, loop_coins: data.loop_coins, updated_at: new Date().toISOString() })
      .eq("id", profile.id)

    if (updateProfileErr) {
      console.warn(`[error] updating profile ${username}:`, updateProfileErr.message)
    } else {
      profilesUpdated += 1
    }

    const { data: loops, error: loopsErr } = await supabase
      .from("loops")
      .select("id, content")
      .eq("author_id", profile.id)

    if (loopsErr) {
      console.warn(`[error] fetching loops for ${username}:`, loopsErr.message)
      continue
    }

    for (const loop of loops || []) {
      const match = data.posts.find((p) => (loop.content || "").includes(p.match))
      if (!match) {
        loopsSkipped += 1
        continue
      }
      const { error: updateLoopErr } = await supabase
        .from("loops")
        .update({ content: match.content, hashtags: match.hashtags })
        .eq("id", loop.id)

      if (updateLoopErr) {
        console.warn(`[error] updating loop ${loop.id} for ${username}:`, updateLoopErr.message)
      } else {
        loopsUpdated += 1
      }
    }
  }

  console.log(`Done. profiles updated: ${profilesUpdated}, loops updated: ${loopsUpdated}, loops skipped (no match): ${loopsSkipped}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
