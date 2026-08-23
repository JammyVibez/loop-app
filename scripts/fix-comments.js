#!/usr/bin/env node
/**
 * Fix seeded comments: delete generic ones, replace with content-aware comments
 * that actually relate to each post's content.
 */

const { Client } = require('pg');
const CONN = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

// Seed users we can comment as
const USERS = [
  'avariver', 'noahbloom', 'miastone', 'leofrost', 'zoesky', 'kailane',
  'ivycruz', 'ezravale', 'lunapark', 'omarwest', 'ninacole', 'theohart',
  'ariaquinn', 'judevale', 'siashaw', 'rexray', 'noafox', 'elidawn',
  'verayork', 'jonbell'
];

// Content-aware comment templates per post topic
// These are manually crafted to relate to the actual post content
const COMMENT_MAP = {
  // Loop 186: Jonbell - small progress / showing up
  186: [
    { author: 'zoesky', content: 'Needed this reminder tonight. Some days the hardest part is just opening the laptop.', replies: [
      { author: 'jonbell', content: 'Exactly. The bar is just "show up". Everything after that is a bonus.' }
    ]},
    { author: 'siashaw', content: 'This is exactly what my streak taught me. Day 1 felt like nothing. Day 100 felt like a different person.' },
  ],

  // Loop 190: noahbloom - late night coding / focus
  190: [
    { author: 'miastone', content: 'My best work happens between 1am and 4am. The world is quiet and there are zero Slack notifications.' },
    { author: 'verayork', content: 'Same. I keep a notes app for the random thoughts that hit at 1am. Half of them are actual solutions.' },
  ],

  // Loop 194: ezravale - building for people who don't exist yet
  194: [
    { author: 'lunapark', content: 'That one real conversation thing is real. I had someone DM me about a post I wrote at 2am and it completely changed my energy.', replies: [
      { author: 'ezravale', content: 'That\'s exactly what I mean. One person showing up makes the whole thing worth it.' }
    ]},
    { author: 'omarwest', content: 'The imaginary user is always more active than the real ones at the start. You just keep building for them until the real ones show up.' },
    { author: 'ninacole', content: 'I stopped waiting for the audience and just started talking. The audience came eventually.' },
  ],

  // Loop 198: kailane - late night focus session / just trying to ship
  198: [
    { author: 'zoesky', content: 'The "I\'ll do it tomorrow" lie is so real. I set a rule: if I think of it, I do it within 5 minutes or it\'s dead.' },
    { author: 'ivycruz', content: 'Respect. I\'ve been stuck in planning mode for weeks. Seeing people actually ship is motivating.' },
  ],

  // Loop 202: siashaw - fear vs process / what actually scares you
  202: [
    { author: 'theohart', content: 'The gap between "I\'ll just make a simple shelf" and "now I need a jointer" is basically every hobby I\'ve ever picked up.' },
    { author: 'leofrost', content: 'You nailed it. The real fear isn\'t the big scary thing, it\'s admitting you actually want to try.' },
  ],

  // Loop 206: leofrost - building vs staying busy
  206: [
    { author: 'kailane', content: 'I\'ve been guilty of the "staying busy" side more than I want to admit. Zooming out is uncomfortable but necessary.' },
    { author: 'noahbloom', content: 'Busy feels productive until you look at what actually shipped at the end of the week.' },
  ],

  // Loop 210: ivycruz - days the only win is not quitting
  210: [
    { author: 'ezravale', content: 'Those days matter more than people think. Showing up on the low days is the actual skill.' },
    { author: 'lunapark', content: 'I had one of those days today. Logged in, stared at the screen, closed it. Still counts.' },
  ],

  // Loop 213: omarwest - what made you stay on this app
  213: [
    { author: 'ninacole', content: 'The fact that a few people are actually posting real thoughts instead of just polished content. It feels human here.', replies: [
      { author: 'omarwest', content: 'That\'s exactly it. The tone here still feels like actual conversations.' }
    ]},
    { author: 'theohart', content: 'Less noisy than other places. At least for now. I hope it stays this way.' },
  ],

  // Loop 216: theohart - just closed the laptop and reopened it
  216: [
    { author: 'ariaquinn', content: 'The "I\'m done for the night" lie we tell ourselves. Every single time.', replies: [
      { author: 'theohart', content: 'I\'ve accepted that "one more thing" is just part of the process now.' }
    ]},
    { author: 'siashaw', content: 'It\'s never just one more thing though 😂' },
  ],

  // Loop 223: rexray - best ideas come when not forcing
  223: [
    { author: 'noafox', content: 'Shower thoughts and late night walks still undefeated for ideas.', replies: [
      { author: 'verayork', content: 'I keep a notes app just for random thoughts that hit at 1am. Half are gold, half are gibberish.' }
    ]},
    { author: 'elidawn', content: 'Forcing ideas usually just gives me mediocre versions of old ones. The good stuff always comes when you\'re doing something else.' },
  ],

  // Loop 227: elidawn - writing Circle at 3am
  227: [
    { author: 'lunapark', content: 'Those 3am writing sessions hit different. No judgment, just raw words and honest feedback.' },
    { author: 'miastone', content: 'I need to find my version of this. A music Circle that\'s alive at weird hours would be perfect.' },
  ],

  // Loop 231: noafox - outtakes / posting the imperfect stuff
  231: [
    { author: 'zoesky', content: 'The mid-laugh shots are always the best ones though. The "perfect" ones look stiff.' },
    { author: 'siashaw', content: 'This is why I love this app. You don\'t have to pretend everything is polished.' },
  ],

  // Loop 232: noafox - golden hour but moody / lighting setup
  232: [
    { author: 'theohart', content: 'Golden hour but moody is basically "warm but also dramatic and slightly ominous". I\'d watch that tutorial.', replies: [
      { author: 'noafox', content: 'Ha, that\'s actually the perfect description. I\'ll try to make that reel.' }
    ]},
    { author: 'jonbell', content: 'The lighting ratio struggle is so real. Three setups sounds about right for something that should be "simple".' },
  ],

  // Loop 233: noafox - stranger in photography Circle helped fix lighting
  233: [
    { author: 'lunapark', content: 'This is the kind of community interaction that makes apps worth using. Real help from real people.' },
    { author: 'omarwest', content: 'Free knowledge from strangers > paid courses from experts. The context is just better.' },
  ],

  // Loop 235: kailane - killed a feature after 6 weeks
  235: [
    { author: 'rexray', content: 'The hardest part isn\'t killing it. It\'s explaining to stakeholders why 2% usage means it needs to go.', replies: [
      { author: 'kailane', content: 'You get it. The feature was technically good. Just nobody wanted it.' }
    ]},
    { author: 'ninacole', content: 'This is a product skill most people never learn. Shipping is easy. Killing is hard.' },
  ],

  // Loop 236: zoesky - Aurora theme pack performance
  236: [
    { author: 'leofrost', content: 'The particle effects thing is a real problem. Beautiful in screenshots, terrible on older devices.' },
    { author: 'theohart', content: 'Performance should be a feature, not an afterthought. Glad someone is calling this out.' },
  ],

  // Loop 237: zoesky - profile banner styles ranked
  237: [
    { author: 'miastone', content: 'The fact that half the banners actively hurt readability is wild. Form over function always loses.' },
  ],

  // Loop 238: zoesky - theme + dark mode for avatar colors
  238: [
    { author: 'ariaquinn', content: 'I had this exact problem. Dark themes wash out any avatar that isn\'t bright white or neon.' },
  ],

  // Loop 239: zoesky - theme + cosmetic combo with Co-Loop cyan
  239: [
    { author: 'siashaw', content: '340 Loop Coins well spent. The struggle of making cosmetic + theme + platform accent all work together is real.', replies: [
      { author: 'zoesky', content: 'It took way too long but the combo finally clicks. Worth every coin.' }
    ]},
    { author: 'kailane', content: 'The Co-Loop cyan clashes with literally everything. Respect for making it work.' },
  ],

  // Loop 240: leofrost - V60 to Kalita Wave pour-over
  240: [
    { author: 'judevale', content: 'Kalita Wave is so underrated. Flat bottom = more forgiving extraction. My mornings improved too.', replies: [
      { author: 'leofrost', content: 'Right? The flat bottom eliminates so much of the user error. Consistent every time.' }
    ]},
    { author: 'siashaw', content: 'I made the same switch last month. The bitterness difference was immediate.' },
    { author: 'jonbell', content: 'Been thinking about trying this. What grind size are you using with the Kalita?' },
  ],

  // Loop 241: miastone - Web Audio API delay pedal
  241: [
    { author: 'miastone', content: 'The latency is about 12ms which is noticeable but workable for ambient stuff. Working on a buffer optimization.' },
  ],

  // Loop 242: miastone - 40-second pad chord progression loop
  242: [
    { author: 'ariaquinn', content: 'I\'d love to branch this into something with a lo-fi beat underneath. What key is it in?', replies: [
      { author: 'miastone', content: 'D minor. Go for it, would love to hear what you do with it.' }
    ]},
    { author: 'elidawn', content: 'Drop a link when it\'s up. Always looking for ambient stuff to write to.' },
  ],

  // Loop 243: miastone - three failed mixdowns / low end fighting kick
  243: [
    { author: 'theohart', content: 'Sidechaining everything to the kick is the cheat code nobody talks about. Simple but it works every time.' },
    { author: 'noahbloom', content: 'Low end fights are the most frustrating mixing problem. Glad you figured it out before throwing more plugins at it.' },
  ],

  // Loop 244: miastone - ambient track through cassette deck
  244: [
    { author: 'siashaw', content: 'Tape hiss as a texture choice is so underrated. It adds warmth that digital plugins try to emulate and never get right.' },
    { author: 'lunapark', content: 'The imperfection IS the character. Digital lo-fi presets never capture what actual tape does.' },
  ],

  // Loop 245: miastone - lo-fi presets too clean / genre got popular
  245: [
    { author: 'ivycruz', content: 'This is exactly what happened. The genre\'s whole identity was "imperfection" and now there are presets that remove all of it.' },
  ],

  // Loop 246: noahbloom - Robinhood deposit flow redesign
  246: [
    { author: 'theohart', content: 'Combining bank-linking with the deposit step is such an obvious improvement. Why do they have it as two separate flows?', replies: [
      { author: 'noahbloom', content: 'Legacy decisions. The bank-link was built by a different team three years ago.' }
    ]},
    { author: 'leofrost', content: 'Six screens to four is a massive UX win. Would love to see the before/after breakdown.' },
  ],

  // Loop 247: noahbloom - signup form order of operations
  247: [
    { author: 'ariaquinn', content: 'This is such a good point. Asking for my name before I even know what the app does is a red flag.' },
    { author: 'jonbell', content: 'The "earn the right to ask" framework should be taught in every design bootcamp.' },
  ],

  // Loop 248: noahbloom - skeleton loaders vs spinners
  248: [
    { author: 'theohart', content: 'Controversial but correct. A bad skeleton loader creates false expectations. A spinner is at least honest.', replies: [
      { author: 'noahbloom', content: 'Exactly my point. Honesty in loading states > fake progress.' }
    ]},
    { author: 'siashaw', content: 'I never thought about it this way but it makes total sense. Skeleton loaders promise structure that might not exist.' },
  ],

  // Loop 249: noahbloom - empty-state CTA copy from user's first action
  249: [
    { author: 'kailane', content: 'Using the user\'s own action as the CTA is brilliant personalization at zero cost.' },
  ],

  // Loop 250: avariver - Nudge Circle / someone branched my onboarding copy
  250: [
    { author: 'miastone', content: 'The branching feature is literally built for this. Seeing someone improve your work and being okay with it.' },
  ],

  // Loop 251: avariver - 47 people have Nudge installed
  251: [
    { author: 'ezravale', content: '47 people who actually chose YOUR thing over all the alternatives. That\'s not small.' },
  ],

  // Loop 252: leofrost - switching from V60 to Kalita (duplicate-ish, different post)
  252: [
    { author: 'jonbell', content: 'Small changes that compound. Same with code, same with coffee, same with everything.' },
  ],

  // Loop 253: rexray - retention curve flattening at 22%
  253: [
    { author: 'siashaw', content: 'A retention curve that flattens instead of cliffing is literally the holy grail. What changed in your onboarding?', replies: [
      { author: 'rexray', content: 'Honestly not sure yet. Could be the new onboarding flow or the daily streak feature. Running tests to isolate.' }
    ]},
    { author: 'ezravale', content: '22% flattening is genuinely strong. Most consumer apps would kill for that number.' },
    { author: 'siashaw', content: 'As a dev, I relate to this on a molecular level. The debugging loop is real.' },
  ],

  // Loop 254: rexray - cohort chart without labeled y-axis
  254: [
    { author: 'theohart', content: 'Abstract art 😂 I\'ve seen so many dashboards where the charts look pretty but tell you absolutely nothing.' },
  ],

  // Loop 255: rexray - debugging activation metric jump
  255: [
    { author: 'kailane', content: 'The classic "someone changed the event definition" bug. This is why event schemas need version control.' },
  ],

  // Loop 256: siashaw - joined plant-care Circle for monstera
  256: [
    { author: 'siashaw', content: 'Update: turns out I was watering it every 3 days instead of every 2 weeks. The monstera was drowning.', replies: [
      { author: 'leofrost', content: 'Plants are so dramatic about overwatering. At least yours didn\'t die on you.' }
    ]},
    { author: 'elidawn', content: 'Plant Circles are surprisingly wholesome. Everyone just wants to help each other keep their plants alive.' },
  ],

  // Loop 257: siashaw - strangers helping talk through moving cities
  257: [
    { author: 'omarwest', content: 'Sometimes the best advice comes from people who have zero stake in your decision. Strangers see things clearly.', replies: [
      { author: 'siashaw', content: 'Exactly. They asked questions I hadn\'t thought to ask myself.' }
    ]},
    { author: 'ninacole', content: 'This is the kind of community interaction that can genuinely change someone\'s life trajectory.' },
  ],

  // Loop 258: siashaw - figuring out the app vibe / rambly post got replies
  258: [
    { author: 'noahbloom', content: 'The fact that a rambly honest post gets more engagement than a polished one says everything about what people actually want.', replies: [
      { author: 'siashaw', content: 'Real talks > content creation. That\'s the whole vibe of this place.' }
    ]},
    { author: 'noafox', content: 'First Co-Loop attempt tonight — couldn\'t stop laughing at how bad our first draft was. That\'s the fun part.' },
  ],

  // Loop 259: siashaw - First Co-Loop attempt
  259: [
    { author: 'ezravale', content: 'The first draft is always terrible. That\'s the point. You just keep iterating until something clicks.' },
  ],

  // Loop 260: siashaw - cooked risotto became rice soup
  260: [
    { author: 'ivycruz', content: 'Rice soup is a valid dish honestly. Sometimes the mistakes become the recipe.', replies: [
      { author: 'siashaw', content: 'I\'m calling it "deconstructed risotto" next time. Fancy name fixes everything.' }
    ]},
    { author: 'omarwest', content: 'The fact that you posted it anyway is the whole point. Perfect is boring.' },
  ],

  // Loop 261: theohart - accessible form validation debate
  261: [
    { author: 'kailane', content: 'Error messages should tell you what to do, not what you did wrong. "Enter a valid email" vs "Email must contain @".' },
  ],

  // Loop 262: theohart - audited button focus-visible states
  262: [
    { author: 'siashaw', content: 'Three variants with broken focus-visible? That\'s a keyboard-only user literally unable to navigate your interface.', replies: [
      { author: 'theohart', content: 'Exactly. And we ship to production like that. It\'s embarrassing.' }
    ]},
    { author: 'jackss', content: 'Following for updates on this! We need more people talking about a11y in design systems.' },
    { author: 'judebeck', content: 'The way you put this into words — exactly what I\'ve been trying to explain to my team.' },
  ],

  // Loop 263: theohart - component libraries failing WCAG on disabled buttons
  263: [
    { author: 'halalverified', content: 'Two out of four failing basic contrast checks is wild for supposedly production-ready libraries.' },
    { author: 'ninacole', content: 'This is why I check contrast ratios manually now. Trust but verify.' },
    { author: 'jackss', content: 'Good reminder to audit our own components. Saving this for Monday.' },
  ],

  // Loop 264: theohart - "accessibility later" means never
  264: [
    { author: 'stargreg', content: 'This is the a11y hill I will die on. If it\'s not in the component API on day one, it\'s not happening.' },
    { author: 'jackss', content: 'More people need to talk about this. It\'s a systemic issue, not just one team\'s problem.' },
  ],

  // Loop 265: theohart - someone branched token naming proposal
  265: [
    { author: 'ivycruz', content: 'Semantic names over color names is such a better approach. "surface-danger" works in dark mode and light mode.', replies: [
      { author: 'theohart', content: 'That\'s exactly the argument. Color names break when themes change. Semantic names are future-proof.' }
    ]},
  ],

  // Loop 266: omarwest - shelf bracket / woodworking
  266: [
    { author: 'ninacole', content: 'This is the kind of post that keeps the feed alive. The "I made a mistake and turned it into a feature" energy is everything.' },
    { author: 'theohart', content: 'Asymmetry on purpose is honestly a design philosophy. Happy accidents > forced perfection.' },
    { author: 'elidawn', content: 'I did the same thing with a bookshelf last month. Now it\'s "rustic asymmetric" and everyone compliments it.' },
  ],

  // Loop 267: lunapark - day 140 streak / not writing
  267: [
    { author: 'ezravale', content: 'The streak becoming about the streak itself is so real. Day 1 the goal was "write well". Day 140 the goal is "write at all".' },
  ],

  // Loop 268: lunapark - someone branched burnout post
  268: [
    { author: 'noahbloom', content: 'Cross-industry burnout posts are the most underrated content here. Different jobs, same exhaustion.', replies: [
      { author: 'lunapark', content: 'Right? A teacher and a software engineer both burning out from completely different causes but the feeling is identical.' }
    ]},
    { author: 'avariver', content: 'The people here make it worth it. Quality over quantity always.' },
  ],

  // Loop 269: lunapark - almost missed today's post / 11:52pm
  269: [
    { author: 'ninacole', content: 'The streak doesn\'t care about quality, just consistency. That\'s actually the most liberating rule ever.', replies: [
      { author: 'lunapark', content: 'Exactly. A bad post still counts. The habit is what matters.' }
    ]},
    { author: 'judevale', content: 'I\'ve posted from parking lots, airport floors, and once from a bathroom. The streak must survive.' },
  ],

  // Loop 270: ivycruz - shooting from the hip / photo Circle feedback
  270: [
    { author: 'crazyray1', content: 'Getting someone to point out your default angle is the kind of feedback you can\'t get from YouTube tutorials.' },
  ],

  // Loop 271: kailane - killed feature with 2% usage
  271: [
    { author: 'theohart', content: 'Data-driven decisions over ego-driven ones. Most teams can\'t do this.', replies: [
      { author: 'kailane', content: 'The team was frustrated at first but when the numbers speak, you listen.' }
    ]},
    { author: 'kailane', content: 'The feature was good. The users just didn\'t need it. Those are different problems.' },
  ],

  // Loop 272: halalverified - "Damn this aesthetics"
  272: [],

  // Loop 273: kailane - engagement metric debate
  273: [
    { author: 'rexray', content: 'Engagement is a vanity metric unless it correlates with retention. We learned that the hard way.', replies: [
      { author: 'kailane', content: 'Exactly. High engagement means nothing if users leave after a week.' }
    ]},
    { author: 'leofrost', content: 'Same energy, honestly. The metric obsession kills actual product thinking.' },
  ],

  // Loop 274: kailane - onboarding funnel 40% drop at step 3
  274: [
    { author: 'zoesky', content: 'Run the A/B test with fewer fields first. 40% drop at step 3 almost always means too much friction at that step.', replies: [
      { author: 'kailane', content: 'That\'s exactly what we\'re testing. Cutting step 3 from 5 fields to 2.' }
    ]},
    { author: 'noahbloom', content: 'Copy or form length — it\'s always form length. People bail when they see a wall of inputs.' },
  ],

  // Loop 275: kailane - Q3 roadmap as Co-Loop
  275: [
    { author: 'miastone', content: 'Co-Loop for roadmaps is genius. Engineers catch product blindspots that PMs miss every time.' },
  ],

  // Loop 276: judebeck - checkout page redesign
  276: [
    { author: 'kailane', content: 'One job per screen is the golden rule most checkout flows break. Shipping and billing together is a conversion killer.' },
  ],

  // Loop 277: judebeck - slow morning at roastery / subscription box
  277: [],

  // Loop 278: judebeck - 192F not 200F pour-over
  278: [
    { author: 'leofrost', content: 'This is actually a great tip. The 8-degree difference sounds trivial but it completely changes the flavor profile.' },
    { author: 'jonbell', content: 'Free tip that most people ignore. Temperature control is the easiest improvement to pour-over quality.' },
    { author: 'noahbloom', content: 'Good reminder, saving this for my next morning brew.' },
  ],

  // Loop 279: judebeck - reel timing pour-over methods
  279: [
    { author: 'verayork', content: 'Kalita on consistency, V60 on flavor — that\'s exactly what I\'d expect. The flat bottom is forgiving, the cone is expressive.' },
  ],

  // Loop 280: ariaquinn - Python BPM auto-detect script
  280: [
    { author: 'miastone', content: 'Four evenings for a working BPM detector is honestly fast. Stack Overflow is the real MVP of every music producer\'s toolkit.', replies: [
      { author: 'ariaquinn', content: 'The first two evenings were just figuring out what library to use. The actual algorithm was the easiest part.' }
    ]},
    { author: 'elidawn', content: 'Would love to see this as a Loop tool. Auto-detect BPM before posting a beat would be so useful.' },
  ],

  // Loop 281: ariaquinn - new beat / chopped jazz record for dad
  281: [
    { author: 'miastone', content: 'Chopping a record your dad gave you and flipping it into something new — that\'s the purest form of musical tribute.' },
    { author: 'ezravale', content: 'The specificity here is what makes it land. 12% speed up, boom-bap pattern — that\'s a recipe, not just a vibe.' },
  ],

  // Loop 282: halalverified - "Loop" (test post)
  282: [],

  // Loop 283: ariaquinn - sample clearance culture killed hip-hop
  283: [
    { author: 'theohart', content: 'This is such a good take. The fear of clearance turned sampling from an art form into a legal exercise.', replies: [
      { author: 'ariaquinn', content: 'Exactly. DJ Shadow and J Dilla would get sued into oblivion today for the same stuff.' }
    ]},
    { author: 'leofrost', content: 'Royalty-free samples killed the texture. Everything sounds the same now because everyone uses the same 200 packs.' },
    { author: 'judevale', content: 'Love this energy. The art form lost its soul when lawyers got involved.' },
  ],

  // Loop 284: avariver - apps feel empty first week / showing up
  284: [
    { author: 'noahbloom', content: 'Quiet feeds kill momentum faster than bad features. This is why early community building matters more than product polish.', replies: [
      { author: 'avariver', content: 'Exactly. The product can be perfect but if nobody\'s talking, people leave.' }
    ]},
    { author: 'miastone', content: 'Yeah I\'ve left so many apps after the first visit because nothing was happening. Even small activity makes a difference.' },
    { author: 'leofrost', content: 'This is why I\'m still here. Feels like the early days of something.' },
  ],

  // Loop 285: noahbloom - quiet feeds / replies
  285: [
    { author: 'ezravale', content: 'Honest question — do you ever feel like you\'re building for people who don\'t exist yet?', replies: [
      { author: 'lunapark', content: 'All the time. Then one real conversation happens and it suddenly feels worth it.' }
    ]},
  ],

  // Loop 286: avariver - small progress / comments
  286: [
    { author: 'judevale', content: 'The difference between building and staying busy gets clearer the longer you do this.', replies: [
      { author: 'siashaw', content: 'Busy feels productive until you zoom out and realize nothing shipped.' }
    ]},
    { author: 'ariaquinn', content: 'Quiet wins compound. Keep going.', },
  ],

  // Loop 287: theohart - closed laptop / reopened
  287: [
    { author: 'siashaw', content: 'The "I\'m done for the night" lie we all tell ourselves. Then 10 minutes later you\'re deep in a new branch.', replies: [
      { author: 'theohart', content: 'I\'ve accepted it as part of the creative process at this point.' }
    ]},
  ],

  // Loop 288: rexray - best ideas when not forcing
  288: [
    { author: 'noafox', content: 'Shower thoughts and 1am walks remain undefeated for idea generation.', replies: [
      { author: 'verayork', content: 'I keep a notes app specifically for those random 1am thoughts. Half are gold, half are nonsense.' }
    ]},
    { author: 'elidawn', content: 'Forcing ideas gives you mediocre versions of old ones. The good stuff comes when you\'re doing something else entirely.' },
  ],

  // Loop 289: jonbell - small progress still counts
  289: [
    { author: 'avariver', content: 'Especially when nobody sees it. That\'s the real test — showing up when there\'s no applause.', replies: [
      { author: 'noahbloom', content: 'Quiet wins compound. Keep going.' }
    ]},
    { author: 'miastone', content: 'Needed this reminder tonight. Some days the only win is not quitting.' },
  ],

  // Loop 290: leofrost - building vs staying busy
  290: [
    { author: 'zoesky', content: 'That hit. Busy feels productive until you zoom out and realize you just moved the same needle all week.', replies: [
      { author: 'leofrost', content: 'The zoom out is the hardest part. Way easier to stay busy and feel good about it.' }
    ]},
    { author: 'kailane', content: 'I\'ve been guilty of the second one more than I want to admit.' },
  ],

  // Loop 291: ivycruz - some days the only win is not quitting
  291: [
    { author: 'ezravale', content: 'Those days matter more than people think. Showing up on the low days is the actual skill.', replies: [
      { author: 'lunapark', content: 'This. Consistency beats intensity every single time.' }
    ]},
  ],

  // Loop 292: omarwest - what made you stay on this app
  292: [
    { author: 'ninacole', content: 'The fact that people post real thoughts here instead of polished content. It feels human.', replies: [
      { author: 'theohart', content: 'Less noisy than other places. At least for now.' }
    ]},
    { author: 'ariaquinn', content: 'Same. The tone here still feels like actual conversations, not performance.' },
  ],

  // Loop 293: judevale - working on something small tonight
  293: [
    { author: 'siashaw', content: 'The unsexy work is usually the stuff that actually moves things forward. Respect the quiet grind.', replies: [
      { author: 'rexray', content: 'Consistent effort beats dramatic announcements every time.' }
    ]},
  ],

  // Loop 294: noafox - random thought about motivation vs distractions
  294: [
    { author: 'elidawn', content: 'This. Motivation is temporary. Systems and focus last longer. Build the system and the motivation becomes irrelevant.', replies: [
      { author: 'noafox', content: 'Exactly. Protect your attention more aggressively than your schedule.' }
    ]},
    { author: 'verayork', content: 'I\'ve been trying to protect my attention more aggressively lately. Do Not Disturb is on from 9pm to 7am now.' },
    { author: 'jonbell', content: 'Systems > hype. Every time.' },
  ],

  // Loop 295: avariver - if you've been quiet, drop an update
  295: [
    { author: 'noahbloom', content: 'Still here. Still building. Slow but moving.', replies: [
      { author: 'leofrost', content: 'Good to see familiar names still around. The quiet ones are usually the most consistent.' }
    ]},
    { author: 'miastone', content: 'Same. Quiet week but not inactive. Sometimes the best progress happens off-screen.' },
  ],

  // Loop 296: ezravale - not every post needs to be deep
  296: [
    { author: 'zoesky', content: '"Still here" is enough. The pressure to be profound every post is what kills most apps.', replies: [
      { author: 'ezravale', content: 'Exactly. Some days you just need to exist in the feed.' }
    ]},
    { author: 'noahbloom', content: 'Low-key posts keep the feed from feeling like a performance.' },
  ],

  // Loop 297: lunapark - appreciate the people who reply
  297: [
    { author: 'siashaw', content: 'This whole thread is proof of that. Every reply changes the energy of the original post.' },
  ],

  // Loop 298: omarwest - building in public is uncomfortable
  298: [
    { author: 'noafox', content: 'The uncomfortable part is watching people see your mistakes in real-time. But that transparency builds trust faster than anything else.' },
  ],

  // Loop 299: ninacole - one real conversation > 50 empty likes
  299: [
    { author: 'theohart', content: 'This is the most accurate metric for community health. Depth > breadth, always.', replies: [
      { author: 'ninacole', content: 'Exactly. 50 likes means nothing. One real conversation means everything.' }
    ]},
  ],

  // Loop 300: theohart - late night thoughts / not performing
  300: [
    { author: 'ariaquinn', content: 'Late night thoughts hit different when nobody\'s watching. That\'s when the real stuff comes out.' },
  ],

  // Loop 301: ariaquinn - trying to post without overthinking
  301: [
    { author: 'siashaw', content: 'The best posts I\'ve seen here are the ones that feel unedited. Just raw thoughts.', replies: [
      { author: 'ariaquinn', content: 'Trying to unlearn the "edit 10 times before posting" habit. It\'s hard.' }
    ]},
  ],

  // Loop 302: judevale - progress is rarely loud
  302: [
    { author: 'ezravale', content: 'Most of the best things I\'ve built happened when nobody was watching. The loud wins are rare.', replies: [
      { author: 'judevale', content: 'Exactly. The quiet days are where the real work happens.' }
    ]},
  ],

  // Loop 303: siashaw - if you're waiting for the perfect moment
  303: [
    { author: 'rexray', content: 'The perfect moment is a myth. Just start. The momentum will carry you.', replies: [
      { author: 'siashaw', content: 'Needed this. Been sitting on three posts for a week.' }
    ]},
    { author: 'noafox', content: 'Still figuring things out. That\'s okay. Most of us are.' },
  ],

  // Loop 304: rexray - still figuring things out
  304: [
    { author: 'elidawn', content: 'Honesty about not having it figured out is more valuable than pretending you do.', replies: [
      { author: 'rexray', content: 'The pretending is exhausting. Feels better to just be real.' }
    ]},
  ],

  // Loop 305: noafox - quiet hours / honest posts
  305: [
    { author: 'verayork', content: 'The honest posts always come out at 2am. Something about the quiet makes people drop the filter.', replies: [
      { author: 'noafox', content: '2am honesty is the best content on this app.' }
    ]},
  ],

  // Loop 306: elidawn - small consistent actions vs bursts of motivation
  306: [
    { author: 'jonbell', content: 'Motivation gets you started. Discipline keeps you going. Systems make it effortless.', replies: [
      { author: 'elidawn', content: 'Systems > discipline > motivation. In that order.' }
    ]},
  ],

  // Loop 307: verayork - leaving something so feed doesn't feel empty
  307: [
    { author: 'lunapark', content: 'Even a one-liner makes the feed feel alive. The pressure to write something profound is what kills most activity.', replies: [
      { author: 'verayork', content: 'Exactly. Some days a "still here" is enough.' }
    ]},
  ],

  // Loop 308: jonbell - if you're still reading this / already ahead of lurkers
  308: [
    { author: 'avariver', content: 'Reading is engagement too. Not everyone needs to post to be part of the community.', replies: [
      { author: 'jonbell', content: 'True. But if you\'ve been lurking for a while, this is your sign to post something.' }
    ]},
    { author: 'siashaw', content: 'This post just made me comment for the first time in a week. Fair play.' },
  ],
};

(async () => {
  const c = new Client({ connectionString: CONN });
  await c.connect();

  // 1. Delete all seeded comments (loops 186+) — these are the generic ones
  const delResult = await c.query(`
    DELETE FROM comments
    WHERE loop_id >= 186
    AND content IN (
      'This is the kind of post that keeps the feed alive. Thank you.',
      'Real. Raw. Relatable. That''s what this app needs more of.',
      'Love this energy. Keep sharing your journey.',
      'Late night coding hits different. No notifications, no Slack, just flow.',
      'Motivation fades. Discipline is what keeps you going when it does.',
      'Showing up consistently is the real hack. Not talent, not connections.',
      'This is exactly what I needed to read right now.',
      'This resonates. I stopped waiting for perfect and just started shipping.',
      'Needed to hear this today. The gap between planning and doing is everything.',
      'Real talk. The best product decisions happen after you ship something imperfect.',
      'This is why I keep coming back. Real conversations, not just content.',
      'The people here make it worth it. Quality over quantity always.',
      'Honest posts like this are why I''m still here.',
      'Consistency over intensity. Every. Single. Time.',
      'The streak matters more than the spike. Keep going.',
      'Night owls unite. We do our best work when everyone else is sleeping.',
      'There is something about the silence that makes ideas clearer.',
      'My best work happens between 1am and 4am. The world is quiet.',
      'Slow progress is still progress. Keep stacking those days.',
      'The compound effect is real. One year from now you''ll be glad you started.',
      'The process is the art. Not just the final frame.',
      'As a dev, I relate to this on a molecular level.',
      'The debugging loop is real. Fix one thing, break two more.',
      'Code first, coffee second. That''s the real stack.',
      'Couldn''t agree more. One genuine interaction beats a hundred likes.',
      'Following for updates on this!',
      'Couldn''t agree more.'
    )
  `);
  console.log(`Deleted ${delResult.rowCount} generic seed comments`);

  // 2. Also delete ANY comments by seed users on loops 186+ that are generic
  const delGeneric2 = await c.query(`
    DELETE FROM comments
    WHERE loop_id >= 186
    AND content IN (
      'Same energy, honestly.',
      'Good reminder, saving this.',
      'Can relate more than I''d like to admit.',
      'Screenshotting this for later.',
      'This is a great point, hadn''t thought of it that way.',
      'The way you put this into words — exactly.',
      'Wait this is actually really helpful, thanks for sharing.',
      'Okay but the specific detail here is what got me.',
      'More people need to talk about this.',
      'This tracks with what I''ve been seeing too.',
      'Honestly the most relatable post I''ve seen this week.',
      'Needed to read this today, thank you.',
      'Love seeing the process, not just the finished thing.',
      'Real question: how long did that take you?',
      'The specificity here is what makes it land.',
      'Following for updates on this!'
    )
  `);
  console.log(`Deleted ${delGeneric2.rowCount} more generic comments`);

  // 3. Get user ID map
  const usersRes = await c.query('SELECT id, username FROM profiles WHERE username = ANY($1)', [USERS]);
  const userIdMap = {};
  for (const u of usersRes.rows) userIdMap[u.username] = u.id;

  // 4. Insert content-aware comments
  let insertedComments = 0;
  let updatedStats = 0;

  for (const [loopIdStr, comments] of Object.entries(COMMENT_MAP)) {
    const loopId = parseInt(loopIdStr);
    for (const cm of comments) {
      const authorId = userIdMap[cm.author];
      if (!authorId) {
        console.log(`  Skip: user @${cm.author} not found`);
        continue;
      }

      // Insert top-level comment
      const { data: comment, error } = await c.query(`
        INSERT INTO comments (loop_id, author_id, content, created_at)
        VALUES ($1, $2, $3, NOW() - INTERVAL '${Math.floor(Math.random() * 30) + 1} minutes')
        RETURNING id
      `, [loopId, authorId, cm.content]).then(r => ({ data: r.rows[0], error: null })).catch(e => ({ data: null, error: e }));

      if (error) {
        console.log(`  FAIL comment on loop ${loopId} by @${cm.author}: ${error.message.substring(0, 80)}`);
        continue;
      }
      insertedComments++;

      // Insert replies
      if (cm.replies) {
        for (const reply of cm.replies) {
          const replyAuthorId = userIdMap[reply.author];
          if (!replyAuthorId) continue;

          const { error: replyErr } = await c.query(`
            INSERT INTO comments (loop_id, author_id, content, parent_comment_id, created_at)
            VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${Math.floor(Math.random() * 15) + 1} minutes')
          `, [loopId, replyAuthorId, reply.content, comment.id]).catch(e => ({ error: e }));

          if (!replyErr) insertedComments++;
        }
      }
    }

    // Update loop_stats comment count for this loop
    const countRes = await c.query('SELECT COUNT(*) as cnt FROM comments WHERE loop_id = $1', [loopId]);
    const realCount = parseInt(countRes.rows[0].cnt);
    await c.query('UPDATE loop_stats SET comments_count = $1 WHERE loop_id = $2', [realCount, loopId]);
    updatedStats++;
  }

  console.log(`\nInserted ${insertedComments} content-aware comments across ${Object.keys(COMMENT_MAP).length} posts`);
  console.log(`Updated ${updatedStats} loop_stats comment counts`);

  // 5. Also update ALL loop_stats to match real comment counts
  const allLoops = await c.query(`
    SELECT l.id, COUNT(c.id) as real_count
    FROM loops l
    LEFT JOIN comments c ON c.loop_id = l.id
    GROUP BY l.id
  `);

  let statsFixed = 0;
  for (const row of allLoops.rows) {
    const { error } = await c.query(
      'UPDATE loop_stats SET comments_count = $1 WHERE loop_id = $2',
      [row.real_count, row.id]
    );
    if (!error) statsFixed++;
  }
  console.log(`Synced all ${statsFixed} loop_stats to real comment counts`);

  await c.end();
  console.log('\nDone!');
})();
