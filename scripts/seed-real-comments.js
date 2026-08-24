const { Client } = require('pg');

const CONN = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

// Post ID -> array of {author_username, content, replies?: [{author_username, content}]}
const COMMENTS = {
  // Jon Bell - recipe blogs
  '2091670686266429441': [
    { author: 'kailane', content: 'The scrolling past the life story to get to the actual ingredient list is a universal experience at this point.' },
    { author: 'siashaw', content: 'I literally ctrl+F "jump to recipe" on every single one now. Life changing.' },
  ],
  // Jon Bell - grandmother's soup
  '2091670686266429442': [
    { author: 'elidawn', content: 'Could be too much acid? Grandmas usually balance with a tiny pinch of sugar to round things out.' },
    { author: 'verayork', content: 'My grandmother\'s recipe has zero written measurements. Just "a handful of this" and "until it smells right." Impossible to recreate.' },
  ],
  // Jon Bell - browning butter cornbread
  '2091670686266429443': [
    { author: 'leofrost', content: 'Brown butter cornbread is elite. Try adding a tablespoon of honey to the batter next time — the nuttiness pairs perfectly.' },
    { author: 'miastone', content: 'I did this with chocolate chip cookies last week and it changed everything. The depth of flavor is insane.' },
  ],
  // Jon Bell - meal prep
  '2091670686266429444': [
    { author: 'zoesky', content: 'The "same base sauce" thing is so real. I made 5 meals with the same sofrito base and my roommate asked if I was okay.' },
  ],
  // Vera York - day 215 short workout
  '2091670686266429445': [
    { author: 'lunapark', content: 'The reframe from "I only did 10 minutes" to "I showed up on purpose" is the healthiest mindset shift.' },
    { author: 'ivycruz', content: 'Day 100+ is where the real battle happens. The excitement is gone and it\'s just discipline. You\'re past the hard part.' },
  ],
  // Vera York - 215 days streak
  '2091670686266429446': [
    { author: 'judevale', content: '215 days is wild. The "proving I follow through" part resonates more than the fitness side honestly.' },
  ],
  // Vera York - bought theme to celebrate
  '2091670686266429447': [
    { author: 'zoesky', content: 'Reward systems work way better than guilt systems. What theme did you go with?' },
  ],
  // Eli Dawn - writing circle 3am
  '2091670686266429448': [
    { author: 'ninacole', content: '3am writing circles are the most underrated thing on this app. Strangers give better feedback than friends because they have no reason to be polite.' },
    { author: 'noafox', content: 'Traded drafts with strangers at midnight and got the most honest feedback of my life. The anonymity of it makes people ruthless in the best way.' },
  ],
  // Noa Fox - posting outtakes
  '2091670686266429449': [
    { author: 'ivycruz', content: 'The outtakes are always the ones with actual emotion in them. The "perfect" shots are usually the deadest.' },
    { author: 'miastone', content: 'Mid-laugh shots with soft focus hit different. There\'s a whole genre of photography built on "happy accidents."' },
  ],
  // Noa Fox - golden hour but moody
  '2091670686266429450': [
    { author: 'theohart', content: 'Clients describing lighting is like describing music to a sound engineer. "Make it louder but softer" energy.' },
    { author: 'ivycruz', content: 'Underexposed and warm is basically the entire Wes Anderson palette. Clients just don\'t know the vocabulary.' },
  ],
  // Noa Fox - stranger helped with lighting
  '2091670686266429451': [
    { author: 'siashaw', content: 'This is exactly why I stay on this app. Random 11pm help from a stranger in a niche circle beats any paid course.' },
  ],
  // Noa Fox - ring light tip
  '2091670686266429452': [
    { author: 'fiona01', content: 'Wait I literally just bought a ring light last week. What off-camera setup would you recommend for a beginner?' },
    { author: 'ivycruz', content: 'One speedlight with a shoot-through umbrella. $50 total and your portraits will look 10x more professional than any ring light.' },
  ],
  // Rex Ray - retention curve flattening
  '2091670686266429453': [
    { author: 'kailane', content: '22% week-4 retention is genuinely solid. What did you change in onboarding? Was it the flow or the copy?' },
    { author: 'noahbloom', content: 'The hardest part now is isolating WHICH change caused the improvement. A/B test everything or you\'ll never know.' },
  ],
  // Rex Ray - cohort chart y-axis
  '2091670686266429454': [
    { author: 'kailane', content: 'I once saw a deck where the y-axis started at 95% and made a 2% increase look like exponential growth. Sold it to the board.' },
  ],
  // Rex Ray - activation metric jump
  '2091670686266429455': [
    { author: 'noahbloom', content: 'The classic "our numbers improved overnight!" turn into "oh someone changed the event definition." Happens more than anyone admits.' },
    { author: 'kailane', content: 'This is why data contracts between engineering and analytics matter. Someone changes a definition without telling anyone and suddenly your dashboards are fiction.' },
  ],
  // Sia Shaw - plant care circle
  '2091670686266429456': [
    { author: 'elidawn', content: 'Overwatering is the number one houseplant killer. The rule is: stick your finger an inch into the soil. If it\'s dry, water. If not, wait.' },
  ],
  // Sia Shaw - move cities decision
  '2091670686266429457': [
    { author: 'ninacole', content: 'I talked through a career change with strangers on this app and it ended up being more useful than my therapist. The distance makes people more honest.' },
  ],
  // Sia Shaw - figuring out app vibe
  '2091670686266429458': [
    { author: 'avariver', content: 'The "genuine replies instead of polished content" thing is the whole point. Glad you found it.' },
  ],
  // Sia Shaw - first Co-Loop attempt
  '2091670686266429459': [
    { author: 'halalverified', content: 'Publishing bad first drafts is the most Loop thing ever. The Co-Loops that work best are the ones where nobody\'s precious about it.' },
  ],
  // Sia Shaw - risotto rice soup
  '2091670686266429460': [
    { author: 'jonbell', content: 'Rice soup is just congee with better PR. You\'re fine.' },
    { author: 'siashaw', content: 'The plant circle told you to normalize kitchen failures? That\'s the most supportive thing I\'ve ever heard.' },
  ],
  // Jude Beck - checkout page redesign
  '2091670686266429461': [
    { author: 'noahbloom', content: 'One job per screen is such a simple rule that most checkout flows still get wrong. The shipping + billing combo page is a conversion killer.' },
    { author: 'theohart', content: 'Did you test with keyboard navigation? Checkout forms are where accessibility usually falls apart the worst.' },
  ],
  // Jude Beck - shipping costs
  '2091670686266429462': [
    { author: 'avariver', content: 'Shipping costs killed my last subscription idea. Flat rate helps but eating the cost on short-distance orders is the real play.' },
  ],
  // Jude Beck - pour-over temperature
  '2091670686266429463': [
    { author: 'leofrost', content: '192°F is the sweet spot. I also let the kettle sit for 30 seconds after boiling before pouring — brings it down from 212 to around 200 naturally.' },
    { author: 'miastone', content: 'Wait so THAT\'S why my coffee tastes bitter. I\'ve been pouring straight off the boil like an idiot for months.' },
  ],
  // Jude Beck - pour-over methods reel
  '2091670686266429464': [
    { author: 'leofrost', content: 'The Kalita consistency take is correct. Flat bottom just distributes extraction more evenly. V60 requires a pour technique most people don\'t have.' },
    { author: 'noafox', content: 'Chemex is purely an aesthetic choice and I respect the honesty about it.' },
  ],
  // Aria Quinn - Python BPM script
  '2091670686266429465': [
    { author: 'miastone', content: 'I need this badly. Tapping tempo for 200 files is destroying my wrist. Did you use librosa for the detection?' },
    { author: 'leofrost', content: 'Four evenings for a working script is honestly fast. My side projects take four months before they work.' },
  ],
  // Aria Quinn - chopped jazz record
  '2091670686266429466': [
    { author: 'miastone', content: 'Chopping your dad\'s records and speeding them up 12% is such a specific tribute. The boom-bap pairing makes it work.' },
    { author: 'elidawn', content: 'The 12% speed-up is classic — takes it from jazz lounge to sample-ready. What did you use to chop it?' },
  ],
  // Aria Quinn - sample clearance
  '2091670686266429468': [
    { author: 'miastone', content: 'The royalty-free pack sound is everywhere now. Every lo-fi beat sounds like the same 5 splice kits rearranged.' },
    { author: 'thetradingguy01', content: 'Isn\'t that why everyone\'s going back to vinyl sampling? The texture is impossible to replicate with clean digital samples.' },
  ],
  // Theo Hart - accessible form validation
  '2091670686266429469': [
    { author: 'theohart', content: 'Update: we agreed that errors should announce on blur for inline validation, and on submit for full-form errors. Arguing about it in public made the decision clearer.' },
    { author: 'noahbloom', content: 'The fact that you\'re debating this AT ALL puts you ahead of 90% of product teams. Most just slap aria-live on everything and call it done.' },
  ],
  // Theo Hart - focus-visible audit
  '2091670686266429470': [
    { author: 'ninacole', content: 'Three unreachable button variants is terrifying. How are people supposed to navigate your product if they can\'t even click buttons with a keyboard?' },
  ],
  // Theo Hart - disabled button contrast reel
  '2091670686266429471': [
    { author: 'noahbloom', content: 'Name the names. Component libraries getting away with WCAG failures because nobody calls them out publicly is a problem.' },
    { author: 'theohart', content: 'MUI and Chakra both fail on their default disabled button contrast. Shipping the reel with exact ratios tomorrow.' },
  ],
  // Theo Hart - accessibility later
  '2091670686266429472': [
    { author: 'ninacole', content: '"We\'ll add it later" is the software equivalent of "I\'ll start Monday." It never happens because there\'s always something more urgent.' },
  ],
  // Theo Hart - semantic token names
  '2091670686266429473': [
    { author: 'noahbloom', content: 'surface-danger instead of red-500 is such a better call. Colors change, semantic meanings don\'t. Good merge.' },
  ],
  // Nina Cole - Slack rant
  '2091670686266429474': [
    { author: 'kailane', content: 'The defensive managers proving your point by responding on Slack at 11pm is poetic irony.' },
    { author: 'elidawn', content: 'Always-on Slack is a symptom of management that measures hours instead of output. The fix is cultural, not technical.' },
  ],
  // Nina Cole - Circle feedback better than editor
  '2091670686266429475': [
    { author: 'lunapark', content: 'Editors are incentivized to keep you happy. Circle people have no reason to be polite. That\'s the value.' },
  ],
  // Nina Cole - quiet quitting replies
  '2091670686266429476': [
    { author: 'kailane', content: '30 replies in an hour on a topic like that means you struck a nerve. People have opinions about "quiet quitting" but nobody\'s actually defining it.' },
    { author: 'avariver', content: 'Rewriting your thesis based on audience feedback is the best use of this platform I\'ve heard so far.' },
  ],
  // Nina Cole - Issue #62 async standups
  '2091670686266429477': [
    { author: 'theohart', content: 'Three rewrites to stop sounding preachy is the normal amount for opinionated writing. Draft one is always preachy. That\'s what drafts are for.' },
    { author: 'elidawn', content: 'Getting told draft two was still preachy and actually listening is rare. Most writers would\'ve published it anyway.' },
  ],
  // Omar West - shelf bracket mistake
  '2091670686266429478': [
    { author: 'judevale', content: 'Turning mistakes into "design features" is the most woodworker thing ever. Bob Ross called them happy accidents.' },
    { author: 'siashaw', content: 'The fact that nobody will ever know it started as a mistake is peak craftsmanship. Intentional-looking accidents are the hardest skill in any craft.' },
  ],
  // Luna Park - day 140 streak
  '2091670686266429479': [
    { author: 'verayork', content: '"Not wanting to see the counter reset to zero" is the most honest description of streak motivation I\'ve ever read. Same exact thing drives mine.' },
    { author: 'ezravale', content: 'The counter becoming the motivation instead of the writing is fascinating. Is that a good thing or a bad thing?' },
  ],
  // Luna Park - someone branched day 138
  '2091670686266429480': [
    { author: 'avariver', content: 'Reading someone else\'s take on the same feeling from a different angle is literally what branching was designed for. Love that it\'s working this way.' },
  ],
  // Luna Park - posted at 11:52pm
  '2091670686266429481': [
    { author: 'zoesky', content: '11:52pm in a parking lot is the most relatable streak maintenance I\'ve ever heard. The streak doesn\'t care about context, just consistency.' },
  ],
  // Ivy Cruz - shooting from hip
  '2091670686266429482': [
    { author: 'noafox', content: 'Low angles completely change the power dynamic in a portrait. The subject looks more commanding. Half garbage, half gold is a solid ratio for trying something new.' },
    { author: 'ivycruz', content: 'Exactly — the "half garbage" part is the learning. You can\'t get to the good half without shooting the bad half first.' },
  ],
  // Kai Lane - killed feature
  '2091670686266429483': [
    { author: 'noahbloom', content: 'Six weeks of work, 2% usage, and the maturity to kill it anyway. That\'s the hardest skill in product. Most teams ship it and pretend the data is wrong.' },
    { author: 'kailane', content: 'The hardest part wasn\'t even the decision — it was telling the engineers who built it. They took it well but you could see it hurt.' },
  ],
  // Kai Lane - engagement metric argument
  '2091670686266429485': [
    { author: 'rexray', content: 'Engagement is just "time spent" wearing a fancy name. If nobody can define what good looks like, the metric is useless for decision-making.' },
  ],
  // Kai Lane - onboarding funnel 40% drop
  '2091670686266429486': [
    { author: 'rexray', content: 'A/B testing copy vs form length is the right move. My bet is on form length — every field you remove from step 3 lifts completion by 10-15%.' },
    { author: 'noahbloom', content: '"Will report back with actual numbers, not vibes" should be every product team\'s motto. Please share the results.' },
  ],
  // Kai Lane - Q3 roadmap as Co-Loop
  '2091670686266429488': [
    { author: 'theohart', content: 'Writing roadmaps as Co-Loops with engineers instead of solo docs is genius. They catch production issues at the planning stage instead of post-deploy.' },
    { author: 'avariver', content: 'The "two things that would\'ve broken in production" is exactly why Co-Loops work for docs. The collaborative format surfaces blind spots.' },
  ],
  // Zoe Sky - Aurora theme performance
  '2091670686266429489': [
    { author: 'theohart', content: 'Particle effects on scroll is a known performance trap. CSS animations would\'ve been fine — the GPU doesn\'t need to render 60fps particles on every frame.' },
    { author: 'zoesky', content: 'Yeah I was excited about the design but my phone literally got warm. Can\'t recommend a theme that kills your battery.' },
  ],
  // Zoe Sky - ranked banner styles
  '2091670686266429490': [
    { author: 'theohart', content: 'Half of them failing readability is generous. Most decorative banners make bio text impossible to read. Form over function every time.' },
  ],
  // Zoe Sky - theme for dark mode profile
  '2091670686266429491': [
    { author: 'zoesky', content: 'Update: Aurora dark mode wins on avatar contrast. Neon theme washes out avatars completely. Posting the side-by-side tonight.' },
  ],
  // Zoe Sky - spent 340 coins on theme
  '2091670686266429492': [
    { author: 'siashaw', content: '340 coins and three weeks for theme compatibility is the most relatable thing on this feed. Why do none of the themes play nice together?' },
  ],
  // Leo Frost - Kalita Wave switch
  '2091670686266429493': [
    { author: 'judebeck', content: 'The Kalita\'s flat bottom is why it\'s more forgiving. V60 demands a perfect pour technique — one mistake and you get channeling. Good switch.' },
  ],
  // Mia Stone - Web Audio delay pedal
  '2091670686266429494': [
    { author: 'ariaquinn', content: 'Web Audio latency is rough but the murky tape delay tone is exactly what Web Audio does best. The imperfections ARE the character.' },
    { author: 'miastone', content: 'The latency is about 20ms on Chrome which is annoying for live use but fine for production. The tone is worth the tradeoff.' },
  ],
  // Mia Stone - pad chord progression branch request
  '2091670686266429495': [
    { author: 'ariaquinn', content: 'I\'ll branch it and add a kick pattern. Drop the link or tag me when it\'s live.' },
  ],
  // Mia Stone - sidechained everything to kick
  '2091670686266429496': [
    { author: 'ariaquinn', content: 'The "finally just sidechained everything like a normal person" moment is a rite of passage in mixing. EQ fighting the kick is a losing battle.' },
  ],
  // Mia Stone - cassette deck ambient track
  '2091670686266429497': [
    { author: 'elidawn', content: 'Recording through cassette for tape hiss and re-digitizing is such a specific creative choice. The VHS texture is exactly what lo-fi should sound like.' },
    { author: 'ariaquinn', content: 'The analog degradation is what makes it feel real. Everything is too clean now. Tape hiss is basically an instrument.' },
  ],
  // Mia Stone - lo-fi presets too clean
  '2091670686266429498': [
    { author: 'ariaquinn', content: 'The irony of lo-fi becoming too polished is peak 2024 music production. "Imperfection as a preset" is the funniest description I\'ve heard.' },
  ],
  // Noah Bloom - Robinhood redesign
  '2091670686266429499': [
    { author: 'theohart', content: 'Cutting from 6 to 4 screens by combining bank-linking and amount is clean. The compliance concern is real though — KYC usually requires separate consent flows.' },
    { author: 'kailane', content: 'The "probably breaks some compliance requirement" disclaimer is the most honest design portfolio statement ever.' },
  ],
  // Noah Bloom - signup form order
  '2091670686266429500': [
    { author: 'theohart', content: 'Asking for name before showing value is the #1 signup mistake. Nobody wants to give you their name until they know what they\'re getting.' },
    { author: 'kailane', content: 'Order of operations in forms is such an underrated conversion lever. The same fields in a different order can change completion rates by 30%.' },
  ],
  // Noah Bloom - skeleton loaders
  '2091670686266429501': [
    { author: 'theohart', content: 'This is actually a great take. Skeleton loaders create a visual promise that real content then breaks. A spinner at least sets the expectation of "wait, something is coming."' },
    { author: 'kailane', content: 'Depends on the layout though. For feed-style content, skeleton screens maintain spatial stability. For forms, yeah, spinners are better.' },
  ],
  // Noah Bloom - branched empty state
  '2091670686266429502': [
    { author: 'noahbloom', content: 'Using the user\'s own first action as the CTA copy is the kind of micro-copy optimization that actually moves metrics. Generic "Get started" tells nobody what they\'re starting.' },
  ],
  // Ava River - Nudge branching
  '2091670686266429504': [
    { author: 'noahbloom', content: 'Posting drafts instead of finished screens is the whole point of Co-Loops. The branching format catches better solutions you\'d never find alone.' },
  ],
  // Ava River - 47 people have Nudge
  '2091670686266429505': [
    { author: 'avariver', content: '47 real people who chose to try something I built. Not a viral number but every single one of those is someone who saw value in it.' },
  ],
  // Halalverified - public Co-Loop invitation
  '2091670686266429508': [
    { author: 'fiona01', content: 'I\'m down! What time are you thinking? I\'ve never done a public Co-Loop before.' },
  ],
  // Halalverified - most annoying thing about social media
  '2091670686266429509': [
    { author: 'siashaw', content: 'The algorithm showing me the same 10 accounts is exactly why I\'m here. At least the feed here feels chronological and real.' },
    { author: 'ninacole', content: 'The "same 10 accounts" thing is designed to keep you doom-scrolling, not to show you content you actually want. It optimizes for time-on-app, not satisfaction.' },
  ],
  // Halalverified - Reels or Circles first
  '2091670686266429510': [
    { author: 'siashaw', content: 'Circles. Reels are everywhere already. The community space feature is what makes this app different.' },
    { author: 'zoesky', content: 'Better Circles for sure. The theming and customization is what keeps me coming back.' },
  ],
  // Trading Guy - BTC analysis
  '2091670686266429512': [
    { author: 'halalverified', content: 'ETH pushing toward resistance while SOL lags is the divergence to watch. If ETH breaks $1950 it could drag SOL up with it.' },
  ],
  // Trading Guy - key levels Fed day
  '2091670686266429513': [
    { author: 'thetradingguy01', content: 'The rate decision reaction is everything tomorrow. If they hint at cuts, BTC breaks $66K. If they hold hawkish, we test $62K support hard.' },
  ],
  // Trading Guy - liquidity sweep
  '2091670686266429525': [
    { author: 'thetradingguy01', content: 'Stop hunts below yesterday\'s low into a VWAP reversal is textbook smart money behavior. The trap is obvious in hindsight but most traders chase the breakdown.' },
  ],
  // Trading Guy - closing charts
  '2091670686266429526': [
    { author: 'halalverified', content: 'Sitting on your hands during chop is the hardest discipline in trading. Most people overtrade when nothing is happening and give back their morning gains.' },
  ],
  // Trading Guy - altcoin at 11pm
  '2091670686266429527': [
    { author: 'halalverified', content: 'The "pure discipline" to "random altcoin at 11pm" pipeline is too real. We\'ve all been there 😂' },
    { author: 'fiona01', content: 'Charts looking like they\'re "about to move" is the most dangerous form of confirmation bias in trading lol' },
  ],
  // Anonymous News - Fed held rates
  '2091670686266429531': [
    { author: 'thetradingguy01', content: 'Three dissenting votes for a hike is unusual. The bond market pushing the 30-year toward 5.24% means someone is betting the Fed is behind the curve.' },
  ],
  // Halalverified - more active earn coins
  '2091670686266429514': [
    { author: 'thetradingguy01', content: 'Appreciate the tip! Definitely trying to stay more active here. The community vibe is way better than Twitter.' },
  ],
  // Fiona - cherry blossom playlist
  '2091670686266429519': [
    { author: 'siashaw', content: 'Soft girl hour playlist + cherry blossom season is a whole mood. Drop the playlist link!' },
  ],
  // Fiona - 40 minutes outfit
  '2091670686266429520': [
    { author: 'halalverified', content: 'The hoodie always wins. Comfort > aesthetics every single time 😂' },
    { author: 'siashaw', content: 'This is so relatable it hurts. I have a closet full of clothes I never wear because the hoodie exists.' },
  ],
  // Halalverified - what are you building
  '2091670686266429521': [
    { author: 'avariver', content: 'Building a habit tracker app called Nudge. 50 downloads this week. Small but real.' },
    { author: 'miastone', content: 'Working on a Web Audio sample chopping tool in the browser. Slow progress but it\'s getting there.' },
  ],
  // Halalverified - code snippet
  '2091670686266429523': [
    { author: 'ezravale', content: 'Clean function signature. Adding a max members limit and invite validation would make this production-ready.' },
  ],
  // Halalverified - what do you think about this design
  '2091670686266429524': [
    { author: 'theohart', content: 'The color palette works but the contrast ratio on the secondary text might not pass WCAG AA. Check it against a contrast checker before shipping.' },
  ],
  // Halalverified - updates announcement
  '2091670686266429518': [
    { author: 'siashaw', content: 'Events being live is huge. I\'ve been waiting for that. Going to try creating one tonight.' },
    { author: 'zoesky', content: 'The feed glow-up looks clean. The visual changes are subtle but the readability improved a lot.' },
  ],
  // Halalverified - Co-Loop with me
  '2091670686266429516': [
    { author: 'siashaw', content: 'I\'m in! First Co-Loop bragging rights are serious. Let\'s do it.' },
  ],
  // Ivy Cruz - contact sheet
  '2091670686266429673': [
    { author: 'noafox', content: 'The contact sheet as "honest editor" is perfectly said. No undo, no delete, just what you captured. Film forces you to be intentional.' },
  ],
  // Ivy Cruz - film roll 3 sharp frames
  '2091670686266429671': [
    { author: 'noafox', content: '3 sharp frames out of a whole roll that tell a better story than 500 digital shots — that\'s the argument for film right there.' },
  ],
  // Ezra Vale - 3am microservices debate
  '2091670686266429675': [
    { author: 'leofrost', content: 'Microservices for a 5-person team is overkill 99% of the time. A well-structured monolith will outperform a bad microservices architecture every time.' },
  ],
  // Ezra Vale - deployed at 3am
  '2091670686266429729': [
    { author: 'leofrost', content: 'Zero downtime at 3am is peak engineering. The quietest deployments are the best deployments.' },
    { author: 'ezravale', content: 'The 安静 (quiet) in the codebase was intentional. The servers were literally安静. Peak bilingual debugging energy.' },
  ],
  // Ezra Vale - race condition at 2am
  '2091670686266429677': [
    { author: 'leofrost', content: 'Race conditions that only appear at specific server times are the worst. It\'s like the bug has a bedtime and only wakes up when you\'re asleep.' },
  ],
  // Leo Frost - rubber duck debugging
  '2091670686266429659': [
    { author: 'miastone', content: 'I keep an actual rubber duck on my desk for this. The act of explaining the problem out loud forces you to think sequentially, which is where the bug usually hides.' },
  ],
  // Leo Frost - standing desk treadmill
  '2091670686266429661': [
    { author: 'zoesky', content: 'Your brain at 2am proposing architectural changes to your body is the most relatable thing I\'ve read today.' },
  ],
  // Leo Frost - npm install wait
  '2091670686266429742': [
    { author: 'ezravale', content: '6 months waiting for red lights vs. waiting for npm install. One of these is a universal human experience and the other is developer-specific suffering.' },
  ],

  // Nina Cole - 6000 subscribers
  '2091670686266429689': [
    { author: 'lunapark', content: 'Replying to every email personally at 6,000 subscribers is insane. That level of personal touch is exactly why your open rates are probably way above average.' },
  ],
  // Nina Cole - async communication newsletter
  '2091670686266429688': [
    { author: 'kailane', content: '"Async communication is just a fancy way of saying we\'ll get back to you whenever" — this is the most accurate description of workplace async culture I\'ve read.' },
  ],
  // Nina Cole - one real conversation > 50 likes
  '2091670686266429715': [
    { author: 'avariver', content: 'This should be the tagline for this entire app. Engagement metrics mean nothing without actual conversation behind them.' },
  ],
  // Rex Ray - retention curve went UP
  '2091670686266429734': [
    { author: 'kailane', content: '"5 beautiful minutes of thinking we cracked the code" is the data analyst\'s version of finding money in your pocket then realizing it\'s a receipt.' },
  ],
  // Rex Ray - retention staircase
  '2091670686266429701': [
    { author: 'kailane', content: 'Staircase retention is the best description of healthy growth I\'ve heard. Each step is a cohort that sticks. Hockey sticks are usually one viral moment that doesn\'t sustain.' },
  ],
  // Rex Ray - step 3 onboarding
  '2091670686266429702': [
    { author: 'noahbloom', content: 'Users who complete step 3 having 4x D7 retention means step 3 is your activation moment. The entire product should be optimized to get people there faster.' },
  ],
  // Sia Shaw - killed another succulent
  '2091670686266429712': [
    { author: 'siashaw', content: '"Plant obituaries circle" is something I would genuinely join. I\'ve killed 3 succulents this month and I need a support group.' },
    { author: 'elidawn', content: 'Succulents die from overwatering more than anything else. The counter-intuitive thing is to basically ignore them. They thrive on neglect.' },
  ],
  // Sia Shaw - Twitter or Reddit
  '2091670686266429714': [
    { author: 'siashaw', content: 'It\'s neither and that\'s the point. The tone here is more like a group chat where everybody actually knows each other.' },
  ],
  // Sia Shaw - posted vulnerable got replies
  '2091670686266429741': [
    { author: 'siashaw', content: 'That\'s the whole reason I\'m still here. The ratio of genuine replies to posts is unlike anywhere else I\'ve tried.' },
  ],
  // Eli Dawn - 400 words lighthouse keeper
  '2091670686266429716': [
    { author: 'lunapark', content: 'A lighthouse keeper who collects lost things is such a compelling premise. "Probably never finishing it" is the most writer thing to say about your best idea.' },
    { author: 'ninacole', content: 'Post it anyway. The 400 words you wrote at 3am have more voice than most finished pieces I read. Don\'t let perfect kill good.' },
  ],
  // Eli Dawn - 47 drafts 3 published
  '2091670686266429717': [
    { author: 'lunapark', content: '47 to 3 is the most honest writer ratio I\'ve ever seen. The drafts aren\'t failures — they\'re practice that made the 3 published ones possible.' },
  ],
  // Eli Dawn - systems > hype
  '2091670686266429682': [
    { author: 'noafox', content: 'Motivation gets you started. Systems get you to day 200. The distinction matters more than people realize.' },
  ],
  // Eli Dawn - motivation temporary
  '2091670686266429682': [
    { author: 'verayork', content: 'This is why streaks work — they turn a motivation-dependent activity into a system-dependent one. The chain does the work when motivation fails.' },
  ],
  // Jon Bell - miso caramel cookies
  '2091670686266429722': [
    { author: 'siashaw', content: 'The caramel seizing is fixable — add a splash of cream and whisk it off heat. But "cooking is chaos" is the most accurate summary of baking I\'ve heard.' },
  ],
  // Jon Bell - risotto perfection
  '2091670686266429724': [
    { author: 'siashaw', content: '"The mess is part of the process" should be on a kitchen apron. Every good meal starts with a destroyed kitchen.' },
  ],
  // Jon Bell - measure twice cut once
  '2091670686266429743': [
    { author: 'omarwest', content: 'Having a backup piece of wood is the real pro move. The "ask me how I know" energy is so woodworker.' },
  ],
  // Mia Stone - lo-fi beat generator
  '2091670686266429726': [
    { author: 'ariaquinn', content: 'Pure oscillator synthesis with no samples is the hard mode of audio programming. "Sounds terrible and beautiful" is exactly what good lo-fi should sound like.' },
  ],
  // Mia Stone - broken tape deck tool
  '2091670686266429655': [
    { author: 'ariaquinn', content: 'Randomizing sample start points is essentially what tape wobble does naturally. The broken tape deck aesthetic is having a moment right now.' },
  ],
  // Mia Stone - rain on tin roof patch
  '2091670686266429657': [
    { author: 'elidawn', content: 'Accidentally creating your best texture is how every good ambient track starts. The best sounds come from mistakes that you decide to keep.' },
  ],
  // Noah Bloom - best onboarding is no onboarding
  '2091670686266429727': [
    { author: 'kailane', content: 'Controversial but mostly true. If your product needs a tutorial, either the product is too complex or the UI is too confusing. Usually both.' },
    { author: 'theohart', content: 'There\'s a middle ground though — contextual onboarding that teaches features as users encounter them, not all upfront in a tutorial they\'ll skip.' },
  ],
  // Noah Bloom - redesigned onboarding 7 to 3
  '2091670686266429651': [
    { author: 'kailane', content: '7 screens to 3 for an app you don\'t even work on is peak side project energy. Did you test it or is this purely a design exercise?' },
  ],
  // Noah Bloom - onboarding flow hot take
  '2091670686266429653': [
    { author: 'kailane', content: '"Onboarding flows exist because the team couldn\'t agree on what the product does" is devastating and accurate. Clarity in onboarding starts with clarity in product strategy.' },
  ],
  // Noah Bloom - signup form order reel
  '2091670686266429500': [
    { author: 'theohart', content: 'Order of operations matters more than field count is such a clean insight. Asking for email before showing value kills conversion faster than a long form with good sequencing.' },
  ],
  // Zoe Sky - sleep solution to bug
  '2091670686266429663': [
    { author: 'ezravale', content: 'Sleep as a debugging tool is underrated. Your brain consolidates problem-solving patterns during REM. The 3-hour nap probably let your subconscious work through it.' },
  ],
  // Zoe Sky - circadian rhythm vs ambition
  '2091670686266429665': [
    { author: 'lunapark', content: '"My circadian rhythm and my ambition are in a constant state of disagreement" is the most poetic way to describe being a night owl who wants to be productive.' },
  ],
  // Zoe Sky - woke up at noon chose violence
  '2091670686266429737': [
    { author: 'siashaw', content: '"Woke up at noon and chose violence (by opening my laptop)" is the most accurate description of late-morning productivity I\'ve ever read.' },
  ],
  // Vera York - day 216 walk
  '2091670686266429719': [
    { author: 'lunapark', content: '"Nothing impressive but the chain stays unbroken" — this is the healthiest relationship with fitness I\'ve seen anyone describe.' },
  ],
  // Vera York - tomorrow is a trap
  '2091670686266429721': [
    { author: 'verayork', content: '"Tomorrow is a trap" needs to be on a motivational poster. The days when you feel fine and think "I could skip" are the most dangerous days for a streak.' },
  ],
  // Vera York - protect attention
  '2091670686266429684': [
    { author: 'elidawn', content: 'Protecting attention aggressively is the only way to get deep work done in 2024. Notifications are designed to steal it.' },
  ],
  // Vera York - notes app 1am
  '2091670686266429645': [
    { author: 'noafox', content: 'The 1am notes app graveyard is universal. Most of them are terrible at noon but occasionally one is genuinely brilliant.' },
  ],
  // Omar West - display ledge
  '2091670686266429683': [
    { author: 'siashaw', content: '"Called it a display ledge instead" is the most woodworker problem-solving move ever. Reframing mistakes as intentional design choices is an art form.' },
  ],
  // Omar West - shelf to jointer pipeline
  '2091670686266429685': [
    { author: 'siashaw', content: 'The gap between "simple shelf" and "now I need a jointer" is the gateway to a $5000 workshop. Ask every woodworker how it started.' },
  ],
  // Omar West - building in public
  '2091670686266429713': [
    { author: 'avariver', content: 'The transition from uncomfortable to normal happens faster than you think. The first few posts are terrifying, then it just becomes what you do.' },
  ],
  // Omar West - what made you stay
  '2091670686266429666': [
    { author: 'ninacole', content: 'Real thoughts instead of polished content. Most platforms reward performance. This one rewards honesty.' },
    { author: 'theohart', content: 'Felt less noisy than other places. The signal-to-noise ratio here is genuinely better because there\'s no algorithm amplifying outrage.' },
  ],
  // Jute Vale - quiet grind
  '2091670686266429674': [
    { author: 'siashaw', content: 'The unsexy work is the work that actually matters. Nobody posts about fixing edge cases but that\'s where the product quality lives.' },
  ],
  // Jute Vale - one more thing
  '2091670686266429640': [
    { author: 'siashaw', content: '"One more thing" is the biggest lie in software development. It\'s never one more thing. It\'s one more thing that reveals three more things.' },
  ],
  // Jute Vale - progress rarely loud
  '2091670686266429723': [
    { author: 'siashaw', content: 'The silent progress is the progress that compounds. The loud stuff is usually the least impactful.' },
  ],
  // Leo Frost - building vs busy
  '2091670686266429654': [
    { author: 'zoesky', content: '"Busy feels productive until you zoom out" hit hard. I literally use a weekly review to catch myself being busy instead of productive.' },
    { author: 'kailane', content: 'The second one is comfortable because it feels like work. Building requires decisions that might be wrong, which is scarier.' },
  ],
  // Ivy Cruz - some days only win is not quitting
  '2091670686266429660': [
    { author: 'ezravale', content: 'Those days matter more than the easy ones. Anyone can show up when it\'s going well. The hard days are where consistency is actually built.' },
  ],
  // Luna Park - showing up on low days
  '2091670686266429664': [
    { author: 'verayork', content: 'The "low day showing up" skill is underrated. Motivation is easy when things are going well. Discipline is what you need when they\'re not.' },
  ],
  // Luna Park - day 141 identity
  '2091670686266429679': [
    { author: 'verayork', content: 'When a habit becomes identity — "I\'m someone who writes every day" — that\'s when it sticks permanently. You\'re not fighting motivation anymore.' },
  ],
  // Luna Park - terrible paragraph published anyway
  '2091670686266429681': [
    { author: 'elidawn', content: 'Publishing the bad paragraphs is the only way to keep the streak honest. Curating your output defeats the purpose of daily practice.' },
  ],
  // Luna Park - branch about burnout
  '2091670686266429480': [
    { author: 'avariver', content: 'Branching someone\'s burnout post with your own version from a different job is exactly what this platform was designed for. Same feeling, different context, new perspective.' },
  ],
  // Mia Stone - low end fighting kick
  '2091670686266429496': [
    { author: 'ariaquinn', content: 'Sidechaining everything to the kick is the mixing equivalent of "if you can\'t beat them, join them." Fighting frequency overlap with EQ is a losing battle.' },
  ],
  // Mia Stone - 40-second pad loop
  '2091670686266429495': [
    { author: 'ariaquinn', content: 'Drop the link — I\'ll add a boom-bap pattern to it. Pad progressions with drums always hit different.' },
  ],
  // Sia Shaw - first Co-Loop laugh
  '2091670686266429459': [
    { author: 'halalverified', content: 'Laughing at your own first draft and publishing anyway is the most Loop thing ever. The vulnerability is the content.' },
  ],
  // Aria Quinn - Python sample tool working
  '2091670686266429707': [
    { author: 'miastone', content: 'Slicing breaks into 8-bar loops automatically sounds incredibly useful. The "not sounding like a robot" part is the hard challenge — manual groove quantization might help.' },
  ],
  // Aria Quinn - boom-bap at midnight
  '2091670686266429709': [
    { author: 'miastone', content: 'If your neighbors are getting a free boom-bap concert at midnight, that\'s community building whether they like it or not.' },
  ],
  // Rex Ray - shared with team
  '2091670686266429695': [
    { author: 'kailane', content: 'SharingLoop posts with your team is the best endorsement. The content here hits different when it comes from real experience, not corporate thought leadership.' },
  ],
  // Noah Bloom - familiar names
  '2091670686266429698': [
    { author: 'miastone', content: 'Same. Seeing the same people still showing up after weeks is the sign of a community that\'s actually working.' },
  ],
  // Noah Bloom - consistency + curiosity
  '2091670686266429694': [
    { author: 'lunapark', content: 'Consistency gets you to day 100. Curiosity gets you to day 200. The combination is what makes a habit stick long-term.' },
  ],
  // Theo Hart - no one noticed accessibility work
  '2091670686266429699': [
    { author: 'theohart', content: 'Zero applause for accessibility work is the norm. The people who need it can\'t always speak up about it, and the people who don\'t need it don\'t notice it exists.' },
  ],
  // Theo Hart - screen reader testing
  '2091670686266429732': [
    { author: 'noahbloom', content: 'Testing with a screen reader should be as standard as testing on mobile. Half a product is generous — I\'d say you\'re shipping an inaccessible product with a visual layer on top.' },
  ],
  // Theo Hart - focus ring 1px gray
  '2091670686266429691': [
    { author: 'theohart', content: '1px gray focus rings are the "we technically have focus styles" equivalent of "we\'ll add accessibility later." Visible focus should be 2px+ with sufficient contrast.' },
  ],
  // Jon Bell - still here reading
  '2091670686266429738': [
    { author: 'siashaw', content: 'Reading posts on this app at midnight instead of sleeping is the most honest engagement metric there is.' },
  ],
  // Sia Shaw - just shipped tiny feature
  '2091670686266429647': [
    { author: 'noahbloom', content: 'Three weeks of procrastination for 20 minutes of work is the most developer experience ever. The gap between "I should" and "I did" is always smaller than it feels.' },
  ],
  // Sia Shaw - Nudge 50 downloads
  '2091670686266429648': [
    { author: 'avariver', content: 'Every download is someone who chose YOUR thing. That\'s more meaningful than viral numbers where people download and never open.' },
  ],
  // Noah Bloom - still here still building
  '2091670686266429690': [
    { author: 'miastone', content: 'Slow but moving is the only sustainable pace. Fast and burning out is the alternative, and it always ends the same way.' },
  ],
  // Mia Stone - needed this reminder
  '2091670686266429652': [
    { author: 'noahbloom', content: 'Quiet wins compound. You might not see the results today but they accumulate faster than you think.' },
  ],
  // Sia Shaw - post more without overthinking
  '2091670686266429720': [
    { author: 'ariaquinn', content: 'The overthinking is what kills most posts. Write it, post it, move on. The algorithm doesn\'t reward perfection, it rewards consistency.' },
  ],
  // Leo Frost - good to see familiar names
  '2091670686266429698': [
    { author: 'noahbloom', content: 'Familiar names in the feed is the sign of a community that\'s working. Most apps lose everyone after week 1.' },
  ],
  // Sia Shaw - unsexy work moves things
  '2091670686266429676': [
    { author: 'judevale', content: 'The unsexy work is the work that matters. Nobody posts about fixing error handling but that\'s what makes a product reliable.' },
  ],
  // Ezra Vale - still figuring things out
  '2091670686266429728': [
    { author: 'lunapark', content: 'Still figuring things out is the most honest status update anyone can give. The people who claim to have it figured out are usually the most lost.' },
  ],
  // Sia Shaw - feed feels different
  '2091670686266429705': [
    { author: 'ninacole', content: 'People talking to each other instead of posting into the void — that\'s the entire difference between this and every other platform.' },
  ],
  // Nina Cole - quiet quitting replies
  '2091670686266429676': [
    { author: 'kailane', content: 'Asking your audience to define a term before you write about it is the best research method. Most writers assume they know what their readers think.' },
  ],
  // Halalverified - welcome message
  '2091670686266429515': [
    { author: 'fiona01', content: 'Welcome to the community! Glad to see new people joining.' },
  ],
};

// Users we can use as comment authors
const USERS = {
  jonbell: null, verayork: null, elidawn: null, noafox: null, rexray: null,
  siashaw: null, lunapark: null, ivycruz: null, kailane: null, zoesky: null,
  judebeck: null, ariaquinn: null, theohart: null, ninacole: null, omarwest: null,
  noahbloom: null, avariver: null, judevale: null, leoFrost: null, miastone: null,
  ezravale: null, halalverified: null, fiona01: null, thetradingguy01: null,
  anonymousnews: null, crazyray1: null, halalverified: null,
};

async function main() {
  const c = new Client({ connectionString: CONN });
  await c.connect();

  // Get user IDs
  const users = await c.query('SELECT id, username FROM profiles');
  for (const u of users.rows) {
    USERS[u.username] = u.id;
  }

  let totalComments = 0;
  let totalReplies = 0;
  const now = new Date();

  for (const [postId, commentList] of Object.entries(COMMENTS)) {
    for (let i = 0; i < commentList.length; i++) {
      const comment = commentList[i];
      const authorId = USERS[comment.author];
      if (!authorId) {
        console.log(`Skipping unknown user: ${comment.author}`);
        continue;
      }

      // Stagger timestamps
      const ts = new Date(now.getTime() - (commentList.length - i) * 120000);

      // Insert comment
      const res = await c.query(
        `INSERT INTO comments (loop_id, author_id, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4) RETURNING id`,
        [postId, authorId, comment.content, ts.toISOString()]
      );
      const commentId = res.rows[0].id;
      totalComments++;

      // Insert reply if exists
      if (comment.replies) {
        for (const reply of comment.replies) {
          const replyAuthorId = USERS[reply.author];
          if (!replyAuthorId) continue;
          const replyTs = new Date(ts.getTime() + 60000);
          await c.query(
            `INSERT INTO comments (loop_id, author_id, content, parent_comment_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $5)`,
            [postId, replyAuthorId, reply.content, commentId, replyTs.toISOString()]
          );
          totalReplies++;
        }
      }
    }

    // Update comment count
    const count = await c.query(
      'SELECT COUNT(*) as c FROM comments WHERE loop_id = $1',
      [postId]
    );
    await c.query(
      'UPDATE loop_stats SET comments_count = $2 WHERE loop_id = $1',
      [postId, parseInt(count.rows[0].c)]
    );
  }

  // Update remaining loop_stats (posts without comments)
  await c.query(`
    UPDATE loop_stats SET comments_count = 0
    WHERE loop_id NOT IN (SELECT DISTINCT loop_id FROM comments)
  `);

  console.log(`\nDone! ${totalComments} comments + ${totalReplies} replies`);
  console.log(`Total comments in DB: ${totalComments + totalReplies}`);

  // Verify a few
  const verify = await c.query(`
    SELECT l.content as post, c.content as comment, p.username
    FROM comments c
    JOIN loops l ON c.loop_id = l.id
    JOIN profiles p ON c.author_id = p.id
    WHERE c.parent_comment_id IS NULL
    ORDER BY RANDOM() LIMIT 5
  `);
  console.log('\nSpot check:');
  for (const v of verify.rows) {
    console.log(`  POST: "${v.post?.substring(0, 80)}..."`);
    console.log(`  COMMENT by @${v.username}: "${v.comment?.substring(0, 80)}..."`);
    console.log();
  }

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
