#!/usr/bin/env node
/**
 * Insert content-aware comments for bio-based posts (247-303).
 * Each comment directly relates to the post's actual content.
 */
const { Client } = require('pg');
const CONN = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

// Format: loopId -> [{author, content, replies: [{author, content}]}]
const COMMENTS = {
  // 247 @avariver: Shipped tiny feature procrastinated 3 weeks
  247: [
    { author: 'judevale', content: 'The gap between "I should do this" and actually doing it is always bigger than the task itself. 20 minutes vs 3 weeks.' },
    { author: 'leofrost', content: 'This is the most relatable dev experience ever. The code takes 20 min, the decision to write it takes 3 weeks.' },
  ],

  // 248 @avariver: Nudge hit 50 downloads
  248: [
    { author: 'siashaw', content: '50 people who chose YOUR thing. That\'s not small — every single one made a conscious decision to try it.', replies: [
      { author: 'avariver', content: 'When you put it that way, it hits different. Thanks.' }
    ]},
    { author: 'ezravale', content: 'Growth is growth. 50 to 500 is just consistency. The hard part (building something people want) is already done.' },
  ],

  // 249 @noahbloom: Redesigned onboarding 7 screens to 3
  249: [
    { author: 'theohart', content: 'Nobody asked you to do this and you did it anyway. That\'s the mark of someone who actually cares about UX.', replies: [
      { author: 'noahbloom', content: 'Sometimes the best portfolio pieces are the ones you do for fun with zero stakes.' }
    ]},
    { author: 'ariaquinn', content: '7 to 3 is massive. Most teams would kill for that kind of simplification on their own product.' },
  ],

  // 250 @noahbloom: Most onboarding flows exist because team couldn't agree
  250: [
    { author: 'siashaw', content: 'Clarity first, features second. This should be printed on every PM\'s wall.', replies: [
      { author: 'noahbloom', content: 'The onboarding is just a symptom. If you can\'t explain what your product does in one sentence, the product has a problem.' }
    ]},
    { author: 'kailane', content: 'The hot take nobody wants to hear. Onboarding is a band-aid for unclear product thinking.' },
  ],

  // 251 @miastone: Web Audio tool randomizes sample start points
  251: [
    { author: 'ariaquinn', content: 'Broken tape deck aesthetic is the best aesthetic. Random start points make everything sound alive and imperfect.', replies: [
      { author: 'miastone', content: 'Exactly what I was going for. Static samples are boring, randomized ones breathe.' }
    ]},
    { author: 'elidawn', content: 'Would love to try this in a Co-Loop session. Randomized textures are my favorite thing to write over.' },
  ],

  // 252 @miastone: Synth patch sounds like rain on tin roof
  252: [
    { author: 'elidawn', content: 'Accidentally creating the best ambient texture is the most musician thing ever. Happy accidents beat deliberate ones.', replies: [
      { author: 'miastone', content: 'I was actually trying to make a bass pad. The rain thing was a total accident.' }
    ]},
    { author: 'siashaw', content: 'Found sounds are always better than designed sounds. Nature doesn\'t follow rules and neither should synths.' },
  ],

  // 253 @leofrost: Rubber duck debugging
  253: [
    { author: 'siashaw', content: 'The rubber duck method is literally just "explain it to someone who doesn\'t know what you\'re talking about." Works every time.', replies: [
      { author: 'leofrost', content: 'Sometimes the duck doesn\'t even need to be there. Just saying it out loud is enough.' }
    ]},
    { author: 'ezravale', content: 'I explain things to my cat. Same energy. She judges less than my code review partner.' },
    { author: 'siashaw', content: 'As a dev, I relate to this on a molecular level. The debugging loop is real.' },
  ],

  // 254 @leofrost: Standing desk + treadmill / 2am brain
  254: [
    { author: 'zoesky', content: 'Your knees are the most rational person in this conversation. Listen to them.', replies: [
      { author: 'leofrost', content: 'My knees have been right about everything since 2019. I should start taking their advice.' }
    ]},
    { author: 'siashaw', content: '2am ideas are 90% genius and 10% "please don\'t." The ratio depends on the night.' },
  ],

  // 255 @zoesky: 3 hour nap solved bug
  255: [
    { author: 'kailane', content: 'Sleep is genuinely the most underrated debugging tool. I\'ve solved more problems unconscious than conscious.', replies: [
      { author: 'zoesky', content: 'The brain does background processing that no amount of staring at a screen can replicate.' }
    ]},
    { author: 'miastone', content: 'Rubber duck debugging but the duck is REM sleep.' },
  ],

  // 256 @zoesky: Circadian rhythm vs ambition
  256: [
    { author: 'elidawn', content: 'Sleep winning the war against ambition is the most relatable thing I\'ve read all week.' },
    { author: 'ivycruz', content: 'My circadian rhythm filed a restraining order against my ambition. We\'re in couples therapy now.' },
  ],

  // 257 @kailane: Backlog grooming = where good product decisions happen
  257: [
    { author: 'rexray', content: 'The boring work IS the work. Nobody tweets about it because it doesn\'t look glamorous, but it\'s where everything gets decided.', replies: [
      { author: 'kailane', content: 'Exactly. The flashy launches get the tweets, but the grooming sessions make them possible.' }
    ]},
    { author: 'jonbell', content: 'Backlog grooming is the unsung hero of every successful product. Respect the process.' },
  ],

  // 258 @kailane: 3 hour meeting about meeting frequency
  258: [
    { author: 'leofrost', content: 'The irony of a meeting about meetings is peak corporate, but at least you resolved something. Most meeting-about-meetings don\'t.', replies: [
      { author: 'kailane', content: 'We actually walked out with a concrete schedule. That\'s a miracle for this team.' }
    ]},
    { author: 'theohart', content: 'The fact that you can laugh about the irony means the culture is healthy. Most teams just get bitter.' },
  ],

  // 259 @ivycruz: Shot entire roll, only 3 sharp
  259: [
    { author: 'noafox', content: 'Film teaches you that less is more. 3 sharp frames from a roll is better than 500 sharp frames from a memory card.', replies: [
      { author: 'ivycruz', content: 'Exactly. The constraint makes you think before you shoot. Digital makes you spray and pray.' }
    ]},
    { author: 'siashaw', content: 'The contact sheet is the honest editor. No hiding behind Lightroom presets.' },
  ],

  // 260 @ivycruz: Contact sheet is the honest editor
  260: [
    { author: 'noafox', content: 'Contact sheets are the most honest form of photography. Every missed shot, every light leak, every blur — it\'s all there.', replies: [
      { author: 'ivycruz', content: 'That honesty is why I shoot film. Digital lets you pretend every shot was intentional.' }
    ]},
  ],

  // 261 @ezravale: 3am microservices argument
  261: [
    { author: 'siashaw', content: '3am technical debates are either the most productive conversations or the most unhinged. There is no in-between.', replies: [
      { author: 'ezravale', content: 'This one was both. We settled nothing but I learned a lot.' }
    ]},
    { author: 'theohart', content: 'Microservices are overrated for 90% of use cases. The 10% that need them know who they are.' },
  ],

  // 262 @ezravale: Race condition at 2am
  262: [
    { author: 'siashaw', content: 'Race conditions that only appear at specific times are the worst kind of bugs. Night shift debugging them is a different kind of pain.', replies: [
      { author: 'ezravale', content: 'The bug only happens when 3 users are active simultaneously. At 2am, that\'s basically never — except when it is.' }
    ]},
    { author: 'theohart', content: 'Race conditions at 2am are a rite of passage for every backend dev. Welcome to the club.' },
  ],

  // 263 @lunapark: Day 141 streak / identity
  263: [
    { author: 'zoesky', content: 'The shift from "I have to write" to "I\'m someone who writes" is the most powerful mental change in any streak.', replies: [
      { author: 'lunapark', content: 'Exactly. The streak isn\'t a rule anymore. It\'s just who I am now.' }
    ]},
    { author: 'judevale', content: 'Identity-based habits > outcome-based habits. James Clear would be proud.' },
  ],

  // 264 @lunapark: Terrible paragraph published anyway
  264: [
    { author: 'siashaw', content: 'Publishing the bad ones is the hardest part. But the streak doesn\'t care about quality — and that\'s the point.', replies: [
      { author: 'lunapark', content: 'The streak rule is just "show up." Everything else is bonus.' }
    ]},
    { author: 'siashaw', content: 'The discipline to publish garbage is the discipline that eventually produces gold.' },
  ],

  // 265 @omarwest: Cut shelf 2 inches short / display ledge
  265: [
    { author: 'ninacole', content: 'Calling it a "display ledge" instead of admitting a mistake is peak woodworking energy. Your wife will come around.', replies: [
      { author: 'omarwest', content: 'She\'s already measured it for a plant. I think I\'m safe.' }
    ]},
    { author: 'siashaw', content: 'The best projects are the ones where the "mistake" becomes the feature. Display ledge > planned shelf.' },
  ],

  // 266 @omarwest: Simple shelf to jointer / one weekend project
  266: [
    { author: 'elidawn', content: 'Every hobby has this pipeline. "I\'ll just try it once" → $500 in tools later → "I\'m basically a professional now."', replies: [
      { author: 'omarwest', content: 'The jointer was the gateway. Next it\'ll be a planer. Then a table saw. I can feel it coming.' }
    ]},
    { author: 'theohart', content: 'The gap between wanting to make something and buying every tool to make it is exactly one weekend. Relatable.' },
  ],

  // 267 @ninacole: Async communication = we'll get back whenever
  267: [
    { author: 'kailane', content: 'Async communication is corporate-speak for "I\'ll reply when it\'s convenient and call it a feature."', replies: [
      { author: 'ninacole', content: 'The funniest part is when teams use async tools but still expect instant responses.' }
    ]},
    { author: 'theohart', content: 'This is such a good newsletter topic. The gap between async-as-intention and async-as-excuse is massive.' },
  ],

  // 268 @ninacole: 6,000 readers / reply to every email
  268: [
    { author: 'lunapark', content: 'Replying to every email at 6,000 subscribers is insane discipline. That\'s the kind of personal touch that builds real loyalty.', replies: [
      { author: 'ninacole', content: 'It takes time but every reply has led to at least one meaningful conversation. Worth it.' }
    ]},
    { author: 'miastone', content: 'This is the difference between a newsletter and a community. You\'re building the latter.' },
  ],

  // 269 @theohart: Focus ring 1px gray border / accessibility
  269: [
    { author: 'siashaw', content: 'A 1px gray focus ring is basically telling keyboard users "good luck finding where you are."', replies: [
      { author: 'theohart', content: 'Exactly. If you can\'t see where focus is, you can\'t navigate. It\'s that simple.' }
    ]},
    { author: 'jackss', content: 'Accessibility isn\'t optional. It\'s the foundation. More people need to say this louder.' },
  ],

  // 270 @theohart: Shipped component library with proper focus states
  270: [
    { author: 'kailane', content: 'Every interactive element with proper focus states, ARIA labels, and keyboard navigation — this is how you build inclusive UI.', replies: [
      { author: 'theohart', content: 'It took 3 weeks but every keyboard-only user will thank us for it.' }
    ]},
    { author: 'elidawn', content: 'Would love to see this component library. Been looking for one that actually gets a11y right.' },
  ],

  // 271 @rexray: Retention curve hockey stick / staircase
  271: [
    { author: 'kailane', content: 'A hockey stick retention curve means something is broken. A staircase means the bug is in the tracking. Both need investigation.', replies: [
      { author: 'rexray', content: 'The staircase was a batching issue in our analytics pipeline. Fixed it and the real curve was... not as pretty.' }
    ]},
    { author: 'leofrost', content: 'Metrics that lie are worse than no metrics at all. At least with no data you know you\'re guessing.' },
  ],

  // 272 @rexray: Cohort analysis / step 3 completion = 4x retention
  272: [
    { author: 'noahbloom', content: 'Step 3 completion being the retention gatekeeper is such valuable insight. Fix that step and the whole funnel improves.', replies: [
      { author: 'rexray', content: 'We\'re running an A/B test now — shorter step 3 vs guided step 3. Should have results next week.' }
    ]},
    { author: 'siashaw', content: 'The boring work is the work. Cohort analysis doesn\'t make for sexy tweets but it makes or breaks products.' },
  ],

  // 273 @noafox: Posted outtakes / awkward laughs
  273: [
    { author: 'siashaw', content: 'The awkward laughs and missed moments are always more honest than the "perfect" shot. Real life isn\'t curated.', replies: [
      { author: 'noafox', content: 'Exactly. The outtakes show the process, not just the result. That\'s what makes them compelling.' }
    ]},
    { author: 'ivycruz', content: 'I should start posting my outtakes too. The vulnerability is what makes photography feel real.' },
  ],

  // 274 @noafox: Instagram would never show this / bad light blur
  274: [
    { author: 'miastone', content: 'The photos Instagram would never show are always the ones with the most character. Algorithmic perfection kills art.', replies: [
      { author: 'noafox', content: 'Motion blur and bad light tell a story. Perfectly lit and sharp just tells you the camera settings.' }
    ]},
    { author: 'siashaw', content: 'Blinking, blurry, badly lit — still your favorite frame. That says everything about what photography should be.' },
  ],

  // 275 @ariaquinn: Python sample-chopping tool / 8-bar loops
  275: [
    { author: 'miastone', content: 'Automatic 8-bar loop slicing is exactly what I need. Manual chopping is the most tedious part of production.', replies: [
      { author: 'ariaquinn', content: 'Working on adding transient detection next so it chops on beat boundaries instead of arbitrary points.' }
    ]},
    { author: 'elidawn', content: 'Make it available as a Loop tool. Auto-chop samples before posting would be incredibly useful.' },
  ],

  // 276 @ariaquinn: Boom-bap at midnight / neighbors
  276: [
    { author: 'miastone', content: 'Boom-bap at midnight with windows open is either the best or worst neighbor move depending on who you ask.', replies: [
      { author: 'ariaquinn', content: 'My neighbors have learned to live with it. The bass is too clean to complain about.' }
    ]},
    { author: 'siashaw', content: 'If the neighbors complain, at least they\'re getting free music. That\'s a community service, not a noise complaint.' },
  ],

  // 277 @judevale: Show up, do work, don't tell anyone
  277: [
    { author: 'rexray', content: 'The grind speaks for itself. Loud people get attention, quiet people get results.', replies: [
      { author: 'judevale', content: 'Exactly. The work compounds in silence. The noise doesn\'t.' }
    ]},
    { author: 'siashaw', content: 'The unsexy work is the work that actually moves things. Respect the quiet grind.' },
  ],

  // 278 @siashaw: Killed another succulent / plant obituaries circle
  278: [
    { author: 'leofrost', content: 'Plant obituaries circle would genuinely be the most wholesome community on this app. I\'d join immediately.', replies: [
      { author: 'siashaw', content: 'Day 1: "Rest in peace, Gerald the succulent. You were overwatered and underloved." 😂' }
    ]},
    { author: 'elidawn', content: 'Succulents are deceptively hard to kill, which makes killing them even more impressive. My condolences.' },
  ],

  // 279 @siashaw: More Twitter or Reddit / people nicer
  279: [
    { author: 'omarwest', content: 'Neither. It\'s more like early-stage Twitter before the trolls moved in. Enjoy it while it lasts.', replies: [
      { author: 'siashaw', content: 'That\'s honestly the best comparison. The vibe is "2012 Twitter but actually nice."' }
    ]},
  ],

  // 280 @elidawn: Wrote 400 words / lighthouse keeper story
  280: [
    { author: 'lunapark', content: 'A lighthouse keeper who collects lost things — that premise alone is already compelling. Please finish it.', replies: [
      { author: 'elidawn', content: 'Working on it. The ending is the hard part. Right now the lighthouse keeper just... collects things forever.' }
    ]},
    { author: 'siashaw', content: '3am writing sessions are when the best ideas happen. Something about the quiet makes the words flow differently.' },
  ],

  // 281 @elidawn: 47 unfinished drafts / 3 published
  281: [
    { author: 'lunapark', content: 'The ratio is honest. Most writers have 10x more unfinished work than published work. The drafts folder is the real measure of effort.', replies: [
      { author: 'elidawn', content: 'Exactly. The 47 drafts aren\'t failures. They\'re practice for the 3 that made it.' }
    ]},
  ],

  // 282 @verayork: Day 216 / 30-min walk / streak unbroken
  282: [
    { author: 'lunapark', content: 'Nothing impressive — except the 216-day streak that proves consistency beats intensity every single time.', replies: [
      { author: 'verayork', content: 'The walk is just the vehicle. The real workout is showing up when you don\'t feel like it.' }
    ]},
    { author: 'siashaw', content: 'A 30-minute walk is genuinely better than no walk. The streak rule of "just move" is genius.' },
  ],

  // 283 @verayork: Hardest part is feeling fine and almost skipping
  283: [
    { author: 'kailane', content: 'The days you feel fine are the most dangerous. "I could do it tomorrow" is the streak killer.', replies: [
      { author: 'verayork', content: 'Exactly. The hard days are easy to show up for because you feel obligated. The easy days are when you slip.' }
    ]},
    { author: 'elidawn', content: 'This is the streak philosophy in one sentence. The risk isn\'t the bad days. It\'s the "meh" days.' },
  ],

  // 284 @jonbell: Miso caramel cookies / caramel seized
  284: [
    { author: 'siashaw', content: 'Caramel seizing is the baking equivalent of a compile error. Frustrating in the moment but usually fixable with heat and patience.', replies: [
      { author: 'jonbell', content: 'I just kept stirring and added cream. It un-seized somehow. Baking is just chemistry with better smells.' }
    ]},
    { author: 'elidawn', content: '"Somehow they taste incredible" — the best recipes are the ones that shouldn\'t work but do.' },
  ],

  // 285 @jonbell: Kitchen crime scene / perfect risotto
  285: [
    { author: 'siashaw', content: 'The mess is part of the process is the cooking equivalent of "the code is the documentation." Sounds nice but your wife still has to clean it.', replies: [
      { author: 'jonbell', content: 'Fair point. I cleaned it. Eventually. After eating the risotto.' }
    ]},
    { author: 'elidawn', content: 'Perfect risotto from a crime-scene kitchen is peak "trust the process" energy.' },
  ],

  // 286 @miastone: Lo-fi beat generator / Web Audio API / pure oscillators
  286: [
    { author: 'ariaquinn', content: 'Pure oscillator synthesis for lo-fi is such a flex. Most people just use samples. Building from scratch is the real art.', replies: [
      { author: 'miastone', content: 'Oscillators + filters + random modulation = infinite lo-fi textures. No samples needed.' }
    ]},
    { author: 'elidawn', content: 'Would love to branch this into a Co-Loop. Pure synthesis ambient is my favorite thing to write over.' },
  ],

  // 287 @noahbloom: Best onboarding is no onboarding
  287: [
    { author: 'theohart', content: 'If your product needs a tutorial, the product needs a redesign. This is the UX hill I will die on.', replies: [
      { author: 'noahbloom', content: 'The best products are intuitive enough that onboarding is just... using the product.' }
    ]},
    { author: 'kailane', content: 'Hot take but correct. Every onboarding step is a confession that the product isn\'t clear enough.' },
  ],

  // 288 @ezravale: Deployed at 3am / zero downtime
  288: [
    { author: 'siashaw', content: '3am deployments with zero downtime are the peak of engineering discipline. Nobody notices and that\'s the whole point.', replies: [
      { author: 'ezravale', content: 'The best deployments are the ones nobody talks about. Silent, clean, done.' }
    ]},
    { author: 'theohart', content: 'Night shift deploy energy is unmatched. The codebase is quiet, the servers are calm, and you\'re basically a ghost.' },
  ],

  // 289 @lunapark: 140-day writing streak / one paragraph before bed
  289: [
    { author: 'siashaw', content: 'One paragraph before bed is the lowest possible bar — and that\'s exactly why it works. You can always write one paragraph.', replies: [
      { author: 'lunapark', content: 'That\'s the whole secret. Make the bar so low you can\'t fail. Then just show up.' }
    ]},
    { author: 'elidawn', content: 'The streak rule of "write one paragraph" is the writing equivalent of "just put on your shoes." Once you start, you keep going.' },
  ],

  // 290 @theohart: Screen reader testing / half a product
  290: [
    { author: 'siashaw', content: 'If you haven\'t tested with a screen reader, you don\'t know what your product actually sounds like to 15% of users.', replies: [
      { author: 'theohart', content: 'Exactly. You built it for your eyes. Half the world navigates differently.' }
    ]},
    { author: 'kailane', content: 'This should be a requirement, not a nice-to-have. Screen reader testing is as important as cross-browser testing.' },
  ],

  // 291 @rexray: Retention curve went UP / bug in analytics
  291: [
    { author: 'siashaw', content: '5 beautiful minutes of thinking you\'d cracked retention. Then the bug report came in. The emotional journey of analytics.', replies: [
      { author: 'rexray', content: 'I literally celebrated for a solid minute before checking the raw data. Humbling.' }
    ]},
    { author: 'kailane', content: 'If your metrics look too good to be true, they probably are. Always verify the raw data.' },
  ],

  // 292 @ninacole: Hardest part of newsletter is deciding what NOT to include
  292: [
    { author: 'miastone', content: 'Editing is the real creative work. Writing is easy. Deciding what to cut is where the craft lives.', replies: [
      { author: 'ninacole', content: 'Every issue starts at 2,000 words and gets cut to 800. The best version is always the shorter one.' }
    ]},
    { author: 'elidawn', content: 'This applies to everything — writing, coding, design. The best work is defined by what you remove.' },
  ],

  // 293 @zoesky: Woke at noon / chose violence / laptop
  293: [
    { author: 'siashaw', content: 'Woke at noon, chose violence (opening the laptop). That\'s the most honest productivity update I\'ve ever read.', replies: [
      { author: 'zoesky', content: 'Productivity is a spectrum and I\'m on the "eventually" end of it today.' }
    ]},
    { author: 'kailane', content: 'The "after coffee" caveat is doing heavy lifting here. We all know coffee comes first.' },
  ],

  // 294 @kailane: Killed feature that took 3 months
  294: [
    { author: 'rexray', content: 'The hardest part isn\'t killing it. It\'s explaining to the team why 3 months of work needs to go.', replies: [
      { author: 'kailane', content: 'The team was frustrated at first but when you show the 2% usage data, the conversation shifts.' }
    ]},
    { author: 'leofrost', content: 'Good product decisions are often painful ones. Shipping is easy. Killing is hard.' },
  ],

  // 295 @avariver: Building in public / days when nothing works
  295: [
    { author: 'ezravale', content: 'The days when nothing works and you still have to post about it — that\'s the real test of building in public.', replies: [
      { author: 'avariver', content: 'The vulnerability of saying "today was rough" is harder than sharing wins.' }
    ]},
    { author: 'siashaw', content: 'Honest updates about failure are more valuable than polished success stories. Keep posting.' },
  ],

  // 296 @siashaw: App growing on me / vulnerable post got replies
  296: [
    { author: 'ezravale', content: 'The fact that vulnerability gets genuine replies here is the whole point. Other platforms reward performance.', replies: [
      { author: 'siashaw', content: 'I was nervous to post it. The replies made it worth it. This app is different.' }
    ]},
    { author: 'ninacole', content: 'One real interaction beats a hundred empty likes. Welcome to the community.' },
  ],

  // 297 @leofrost: 6 months waiting for red lights / npm install
  297: [
    { author: 'siashaw', content: 'npm install is the developer\'s red light. You just sit there and question every dependency you\'ve ever added.', replies: [
      { author: 'leofrost', content: 'At least red lights eventually turn green. npm install sometimes just... doesn\'t.' }
    ]},
    { author: 'miastone', content: '6 months of red lights is still less time than waiting for a Docker build. Priorities.' },
  ],

  // 298 @omarwest: Measure twice cut once / backup wood
  298: [
    { author: 'siashaw', content: '"Ask me how I know" — the three most expensive words in woodworking. Every mistake teaches you a tool you didn\'t know you needed.', replies: [
      { author: 'omarwest', content: 'I now have a dedicated "backup wood" pile. Problem solved, wallet crying.' }
    ]},
  ],

  // 299 @ninacole: This thread is gold
  299: [
    { author: 'leofrost', content: 'The best threads are the ones that accumulate wisdom from different people. This app does that naturally.', replies: [
      { author: 'ninacole', content: 'Exactly. Every reply adds something the original poster didn\'t think of.' }
    ]},
  ],

  // 300 @noahbloom: Consistency + curiosity
  300: [
    { author: 'kailane', content: 'Consistency gets you there. Curiosity makes the journey worth it. Both together is what separates good from great.', replies: [
      { author: 'noahbloom', content: 'The curiosity part is what keeps the consistency from feeling like a grind.' }
    ]},
  ],

  // 301 @rexray: Resonated / sharing with team
  301: [
    { author: 'siashaw', content: 'When something resonates enough to share with your team, it\'s hit a nerve that matters. Good signal.', replies: [
      { author: 'rexray', content: 'Shared it in our standup doc. The team had a 10-minute discussion about it instead of the usual status updates.' }
    ]},
  ],

  // 302 @lunapark: Hardest part is starting / momentum carries
  302: [
    { author: 'siashaw', content: 'Starting is 90% of the battle. Once you\'re moving, momentum does the rest. The hardest part is literally just opening the file.', replies: [
      { author: 'lunapark', content: 'Exactly. "Just open the document" is my entire productivity system.' }
    ]},
  ],

  // 303 @rexray: This thread is gold
  303: [
    { author: 'siashaw', content: 'Threads like this are why I keep coming back. Real conversations, not just content.', replies: [
      { author: 'rexray', content: 'The quality of discussion here is something I haven\'t found anywhere else.' }
    ]},
  ],
};

(async () => {
  const c = new Client({ connectionString: CONN });
  await c.connect();

  // Get user IDs
  const userNames = [...new Set(Object.values(COMMENTS).flat().flatMap(cm => [cm.author, ...(cm.replies || []).map(r => r.author)]))];
  const usersRes = await c.query('SELECT id, username FROM profiles WHERE username = ANY($1)', [userNames]);
  const uid = {};
  for (const u of usersRes.rows) uid[u.username] = u.id;

  let inserted = 0;
  let statsUpdated = 0;

  for (const [loopIdStr, comments] of Object.entries(COMMENTS)) {
    const loopId = parseInt(loopIdStr);

    for (const cm of comments) {
      const authorId = uid[cm.author];
      if (!authorId) { console.log(`Skip: @${cm.author} not found`); continue; }

      // Insert comment with random time offset
      const minsAgo = Math.floor(Math.random() * 45) + 5;
      const { rows, error } = await c.query(
        `INSERT INTO comments (loop_id, author_id, content, created_at)
         VALUES ($1, $2, $3, NOW() - INTERVAL '${minsAgo} minutes')
         RETURNING id`,
        [loopId, authorId, cm.content]
      ).then(r => ({ rows: r.rows, error: null })).catch(e => ({ rows: null, error: e }));

      if (error) { console.log(`FAIL loop ${loopId} @${cm.author}: ${error.message.substring(0, 60)}`); continue; }
      inserted++;
      const commentId = rows[0].id;

      // Insert replies
      if (cm.replies) {
        for (const reply of cm.replies) {
          const replyId = uid[reply.author];
          if (!replyId) continue;
          const rMinsAgo = Math.floor(Math.random() * 30) + 1;
          const { error: rErr } = await c.query(
            `INSERT INTO comments (loop_id, author_id, content, parent_comment_id, created_at)
             VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${rMinsAgo} minutes')`,
            [loopId, replyId, reply.content, commentId]
          ).catch(e => ({ error: e }));
          if (!rErr) inserted++;
        }
      }
    }

    // Update comment count
    const countRes = await c.query('SELECT COUNT(*) as cnt FROM comments WHERE loop_id = $1', [loopId]);
    await c.query('UPDATE loop_stats SET comments_count = $1 WHERE loop_id = $2', [parseInt(countRes.rows[0].cnt), loopId]);
    statsUpdated++;
  }

  console.log(`\nInserted ${inserted} content-aware comments`);
  console.log(`Updated ${statsUpdated} loop_stats`);

  // Final sync all stats
  const all = await c.query(`
    SELECT l.id, COUNT(c.id) as real_count
    FROM loops l LEFT JOIN comments c ON c.loop_id = l.id
    GROUP BY l.id
  `);
  let synced = 0;
  for (const row of all.rows) {
    await c.query('UPDATE loop_stats SET comments_count = $1 WHERE loop_id = $2', [row.real_count, row.id]);
    synced++;
  }
  console.log(`Final sync: ${synced} stats rows`);

  await c.end();
  console.log('Done!');
})();
