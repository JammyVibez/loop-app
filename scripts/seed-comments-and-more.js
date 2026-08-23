const { Client } = require('pg');
const DB_URL = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  // Get all profile IDs
  const usernames = [
    'avariver','noahbloom','miastone','leofrost','zoesky','kailane',
    'ivycruz','ezravale','lunapark','omarwest','ninacole','theohart',
    'ariaquinn','judevale','siashaw','rexray','noafox','elidawn','verayork','jonbell'
  ];
  const profiles = await client.query('SELECT id, username, display_name, bio FROM profiles WHERE username = ANY($1)', [usernames]);
  const idMap = {};
  profiles.rows.forEach(p => { idMap[p.username] = p.id; });

  // ========== PART 1: Add comments for seeded posts ==========
  console.log('=== PART 1: Creating comments ===');

  // Get seeded posts that need comments
  const posts = await client.query(`
    SELECT l.id, p.username, l.content, ls.comments_count, l.created_at
    FROM loops l
    JOIN profiles p ON l.author_id = p.id
    JOIN loop_stats ls ON l.id = ls.loop_id
    WHERE ls.comments_count > 0
    AND l.parent_loop_id IS NULL
    AND l.id > 185
    ORDER BY l.created_at
  `);

  // Comments based on post content and user personalities
  const commentBank = {
    // Posts about building/shipping
    'build': [
      'This resonates. I stopped waiting for perfect and just started shipping.',
      'Needed to hear this today. The gap between planning and doing is everything.',
      'Real talk. The best product decisions happen after you ship something imperfect.',
      'I keep a running list of \"shipped > perfect\" reminders. Adding this to it.',
      'The compounding effect of small ships is underrated.',
    ],
    // Posts about late night / focus
    'night': [
      'Late night coding hits different. No notifications, no Slack, just flow.',
      'My best work happens between 1am and 4am. The world is quiet.',
      'Night owls unite. We do our best work when everyone else is sleeping.',
      'There is something about the silence that makes ideas clearer.',
      'Same energy. The house is安静 and suddenly I can think.',
    ],
    // Posts about motivation / consistency
    'motivation': [
      'Motivation fades. Discipline is what keeps you going when it does.',
      'Showing up consistently is the real hack. Not talent, not connections.',
      'This is exactly what I needed to read right now.',
      'The streak matters more than the spike. Keep going.',
      'Agreed. Systems beat motivation every single time.',
    ],
    // Posts about community / people
    'community': [
      'This is why I keep coming back. Real conversations, not just content.',
      'The people here make it worth it. Quality over quantity always.',
      'Couldn\'t agree more. One genuine interaction beats a hundred likes.',
      'This app feels different because of people like you.',
      'The community IS the product. Everything else is just infrastructure.',
    ],
    // Posts about progress / growth
    'progress': [
      'Slow progress is still progress. Keep stacking those days.',
      'The compound effect is real. One year from now you\'ll be glad you started.',
      'Consistency over intensity. Every. Single. Time.',
      'This is the mindset. Small bets, big patience.',
      'Progress isn\'t always visible. Trust the process.',
    ],
    // Generic supportive
    'support': [
      'This is the kind of post that keeps the feed alive. Thank you.',
      'Real. Raw. Relatable. That\'s what this app needs more of.',
      'Love this energy. Keep sharing your journey.',
      'Honest posts like this are why I\'m still here.',
      'This community is special because of people like you showing up.',
    ],
    // Photography / creative
    'creative': [
      'The process is the art. Not just the final frame.',
      'Love seeing the behind-the-scenes. It makes the work more real.',
      'Your eye for composition is incredible. Keep sharing the process.',
      'This is exactly the kind of content that inspires me to create more.',
      'The messy middle is where the magic happens.',
    ],
    // Tech / dev
    'tech': [
      'As a dev, I relate to this on a molecular level.',
      'The debugging loop is real. Fix one thing, break two more.',
      'Code first, coffee second. That\'s the real stack.',
      'Ship it, break it, fix it, learn from it. The cycle continues.',
      'This is why I love building in public. The feedback loop is invaluable.',
    ],
  };

  // Match post content to comment category
  function getCommentCategory(content) {
    const c = content.toLowerCase();
    if (c.includes('build') || c.includes('ship') || c.includes('product') || c.includes('creating')) return 'build';
    if (c.includes('night') || c.includes('late') || c.includes('quiet') || c.includes('morning')) return 'night';
    if (c.includes('motivat') || c.includes('consisten') || c.includes('streak') || c.includes('showing up')) return 'motivation';
    if (c.includes('people') || c.includes('community') || c.includes('conversation') || c.includes('together')) return 'community';
    if (c.includes('progress') || c.includes('growth') || c.includes('small') || c.includes('compound')) return 'progress';
    if (c.includes('photo') || c.includes('creative') || c.includes('film') || c.includes('design') || c.includes('cook')) return 'creative';
    if (c.includes('code') || c.includes('dev') || c.includes('debug') || c.includes('function')) return 'tech';
    return 'support';
  }

  let commentCount = 0;
  for (const post of posts.rows) {
    const needed = post.comments_count;
    const category = getCommentCategory(post.content);
    const availableComments = [...commentBank[category], ...commentBank.support];

    for (let i = 0; i < needed && i < availableComments.length; i++) {
      // Pick a random commenter who isn't the post author
      const possibleCommenters = usernames.filter(u => u !== post.username);
      const commenter = possibleCommenters[Math.floor(Math.random() * possibleCommenters.length)];

      const timeOffset = (i + 1) * 2; // 2 min after each other
      const commentTime = new Date(new Date(post.created_at).getTime() + timeOffset * 60000);

      try {
        await client.query(
          'INSERT INTO comments (id, author_id, loop_id, content, like_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
          [
            300 + commentCount,
            idMap[commenter],
            post.id,
            availableComments[i],
            Math.floor(Math.random() * 5) + 1,
            commentTime.toISOString()
          ]
        );
        commentCount++;
      } catch (e) {
        // Skip duplicates
      }
    }
  }
  console.log('Created ' + commentCount + ' comments');

  // ========== PART 2: More posts based on user bios ==========
  console.log('\n=== PART 2: Creating additional bio-based posts ===');

  const maxLoop = await client.query('SELECT MAX(id) as max_id FROM loops');
  let loopId = Number(maxLoop.rows[0].max_id) + 1;

  const bioPosts = [
    // @avariver - solo-building Nudge, habit tracker, shipping in public
    { a: 'avariver', c: 'Shipped a tiny feature today that took 20 minutes. Been procrastinating on it for 3 weeks. The gap between \"I should do this\" and actually doing it is always smaller than you think.' },
    { a: 'avariver', c: 'Nudge hit 50 downloads this week. Not a viral number, but every single one of those people chose to try something I made. That still feels wild.' },

    // @noahbloom - product designer, fintech, onboarding flows
    { a: 'noahbloom', c: 'Redesigned the onboarding for an app I don\'t work on just to see if I could cut a step. Got it from 7 screens to 3. Nobody asked me to do this. I regret nothing.' },
    { a: 'noahbloom', c: 'Hot take: most onboarding flows exist because the team couldn\'t agree on what the product actually does. Clarity first, then design follows.' },

    // @miastone - bedroom producer, lo-fi, Web Audio API
    { a: 'miastone', c: 'Built a Web Audio tool that randomizes sample start points. It makes everything sound like a broken tape deck. I love it.' },
    { a: 'miastone', c: 'Late night synth session. Found a patch that sounds like rain on a tin roof. Accidentally created the best ambient texture I\'ve made in months.' },

    // @leofrost - wanna laugh and learn
    { a: 'leofrost', c: 'Today I learned that rubber ducks are used in debugging because explaining your code to an inanimate object actually works. Tried it. Duck approved.' },
    { a: 'leofrost', c: 'My brain at 2am: \"What if you combined a standing desk with a treadmill?\" My knees: \"Please don\'t.\"' },

    // @zoesky - sleeps a lot
    { a: 'zoesky', c: 'Took a 3 hour nap and woke up with a solution to the bug I\'ve been stuck on for 2 days. Sleep is the most underrated debugging tool.' },
    { a: 'zoesky', c: 'My circadian rhythm and my ambition are in a constant state of disagreement. Currently sleep is winning.' },

    // @kailane - product decisions, boring backlog triage
    { a: 'kailane', c: 'Nobody tweets about backlog grooming, but that\'s where 80% of good product decisions actually happen. The boring work is the work.' },
    { a: 'kailane', c: 'Spent 3 hours today in a meeting about meeting frequency. The irony is not lost on me. But we actually resolved it, so maybe it was worth it.' },

    // @ivycruz - street photographer, film, contact sheets
    { a: 'ivycruz', c: 'Shot an entire roll of film today and only 3 frames are sharp. But those 3 frames tell a better story than the 500 digital ones I took yesterday.' },
    { a: 'ivycruz', c: 'The contact sheet is the honest editor. No Lightroom magic, no cropping tricks — just what the camera saw. I love that constraint.' },

    // @ezravale - backend dev, night shift, 1-4am debates
    { a: 'ezravale', c: '3am: the hour when the best and worst technical opinions collide. Currently arguing about whether microservices are overkill for a 5-person team.' },
    { a: 'ezravale', c: 'Night shift backend work hits different when you realize you just debugged a race condition that only appears at 2am server time. Poetic.' },

    // @lunapark - 140-day writing streak, daily honest paragraphs
    { a: 'lunapark', c: 'Day 141. The streak is no longer about motivation — it\'s about identity. I\'m someone who writes every day now. That\'s just what I do.' },
    { a: 'lunapark', c: 'Today\'s paragraph was terrible. Published it anyway. The streak doesn\'t care about quality. It cares about consistency.' },

    // @omarwest - weekend woodworker, mistakes as design choices
    { a: 'omarwest', c: 'Cut a shelf 2 inches too short today. Called it a \"display ledge\" instead. My wife is not convinced but the shelf looks great.' },
    { a: 'omarwest', c: 'The gap between \"I\'ll just make a simple shelf\" and \"now I need a jointer\" was exactly one weekend project.' },

    // @ninacole - newsletter writer, remote work culture
    { a: 'ninacole', c: 'This week\'s newsletter topic: why \"async communication\" is just a fancy way of saying \"we\'ll get back to you whenever.\" Still editing by hand at 11pm.' },
    { a: 'ninacole', c: '6,000 people read my newsletter every week. I still reply to every single email personally. That\'s the whole point.' },

    // @theohart - design systems, focus states, screen reader tested
    { a: 'theohart', c: 'If your focus ring is a 1px gray border, we need to have a conversation. Accessibility is not optional. It\'s the foundation.' },
    { a: 'theohart', c: 'Just shipped a component library update where every interactive element now has proper focus states, ARIA labels, and keyboard navigation. Zero applause. That\'s how you know it\'s important.' },

    // @rexray - growth analyst, retention curves, cohort charts
    { a: 'rexray', c: 'Your retention curve doesn\'t lie. If it looks like a hockey stick, something is broken. If it looks like a staircase, something is working.' },
    { a: 'rexray', c: 'Spent the morning cohort-analyzing our onboarding flow. Found that users who complete step 3 have 4x higher D7 retention. Now the question is: how do we get more people to step 3?' },

    // @noafox - portrait photographer, messy behind-the-scenes
    { a: 'noafox', c: 'Posted the outtakes from today\'s shoot. The awkward laughs and missed moments are always more honest than the \"perfect\" shot.' },
    { a: 'noafox', c: 'Instagram would never show this photo — bad light, motion blur, subject blinking. But it\'s my favorite frame from the entire session.' },

    // @ariaquinn - beatmaker, boom-bap, teaching Python
    { a: 'ariaquinn', c: 'Finally got my Python sample-chopping tool to work. It slices breaks into 8-bar loops automatically. Next step: making it not sound like a robot did it.' },
    { a: 'ariaquinn', c: 'Boom-bap drums at midnight with the windows open. If my neighbors complain, at least they\'re getting a free concert.' },

    // @judevale - no bio, but posted about quiet grind
    { a: 'judevale', c: 'Some days you just need to show up, do the work, and not tell anyone about it. The grind speaks for itself eventually.' },

    // @siashaw - new here, plant care, cooking, figuring out the app
    { a: 'siashaw', c: 'I killed another succulent today. At this point I should start a \"plant obituaries\" circle. Anyone else on the struggle bus with houseplants?' },
    { a: 'siashaw', c: 'Trying to figure out if this app is more Twitter or more Reddit. Either way, the people here seem nicer than both.' },

    // @elidawn - insomniac, short fiction, unfinished drafts
    { a: 'elidawn', c: 'Wrote 400 words of a short story at 3am. It\'s about a lighthouse keeper who collects lost things. Probably never finishing it. Posting it anyway.' },
    { a: 'elidawn', c: 'The unfinished drafts folder has 47 stories. The published ones have 3. The ratio is honest but the work matters regardless.' },

    // @verayork - 215-day workout streak, walking, bodyweight
    { a: 'verayork', c: 'Day 216. Just a 30-minute walk and 15 minutes of bodyweight stuff. Nothing impressive. But the chain stays unbroken.' },
    { a: 'verayork', c: 'The hardest part of the streak isn\'t the hard days — it\'s the days when you feel fine and almost skip because \"I could do it tomorrow.\" Tomorrow is a trap.' },

    // @jonbell - home cook, experiments, no recipes
    { a: 'jonbell', c: 'Tonight\'s experiment: miso caramel cookies. The caramel seized, the cookies spread too thin, but somehow they taste incredible. Cooking is chaos.' },
    { a: 'jonbell', c: 'My kitchen looks like a crime scene but the risotto turned out perfect. The mess is part of the process. Don\'t let anyone tell you otherwise.' },

    // @miastone - Web Audio tools
    { a: 'miastone', c: 'Built a lo-fi beat generator using just the Web Audio API. No plugins, no samples — pure oscillator synthesis. It sounds terrible and beautiful at the same time.' },

    // @noahbloom - onboarding flows
    { a: 'noahbloom', c: 'Unpopular opinion: the best onboarding is no onboarding. If your product needs a tutorial, the product needs a redesign.' },

    // @ezravale - night shift dev
    { a: 'ezravale', c: 'Just deployed to production at 3am. Zero downtime. Zero notifications. Peak night-shift energy. The codebase is安静 and the servers are happy.' },

    // @lunapark - writing streak
    { a: 'lunapark', c: 'Someone asked me how I maintain a 140-day writing streak. The answer is embarrassingly simple: I write one paragraph before breakfast. That\'s it. That\'s the system.' },

    // @theohart - accessibility
    { a: 'theohart', c: 'If you\'re building a UI and you haven\'t tested it with a screen reader, you\'re shipping half a product. Full stop.' },

    // @rexray - analytics
    { a: 'rexray', c: 'Saw a retention curve that went UP after day 30. Investigated. It was a bug in the analytics. But for 5 beautiful minutes, I thought we\'d cracked the code.' },

    // @ninacole - newsletter
    { a: 'ninacole', c: 'The hardest part of writing a newsletter isn\'t the writing. It\'s deciding what NOT to include. Every issue is a exercise in restraint.' },

    // @zoesky - sleeps a lot
    { a: 'zoesky', c: 'Woke up at noon and chose violence (by opening my laptop). Productivity awaits. Eventually. After coffee.' },

    // @kailane - product decisions
    { a: 'kailane', c: 'Just killed a feature that took 3 months to build. The metrics said it wasn\'t moving the needle. Hard decision but the right one. Shipping less is shipping better.' },

    // @ivariver - building in public
    { a: 'avariver', c: 'The hardest part of building in public isn\'t the sharing — it\'s the days when nothing is working and you still have to post about it honestly.' },

    // @siashaw - new, plant care
    { a: 'siashaw', c: 'Okay this app is growing on me. Posted something vulnerable and got 3 genuine replies. That never happens on other platforms.' },

    // @leofrost - laugh and learn
    { a: 'leofrost', c: 'TIL that the average person spends 6 months of their life waiting for red traffic lights. I spend mine waiting for npm install. We are not the same.' },

    // @omarwest - woodworking
    { a: 'omarwest', c: 'Woodworking tip: measure twice, cut once, and always have a backup piece of wood. Ask me how I know.' },
  ];

  let postsCreated = 0;
  const postTime = new Date(Date.now() - 45 * 60 * 1000); // 45 min ago

  for (let i = 0; i < bioPosts.length; i++) {
    const post = bioPosts[i];
    const authorId = idMap[post.a];
    if (!authorId) continue;

    const time = new Date(postTime.getTime() + i * 120000); // 2 min apart

    try {
      await client.query(
        'INSERT INTO loops (id, author_id, content, content_type, visibility, tree_depth, parent_loop_id, created_at, updated_at) VALUES ($1, $2, $3, \'text\', \'public\', 0, NULL, $4, $4)',
        [loopId, authorId, post.c, time.toISOString()]
      );

      // Add stats
      const likes = Math.floor(Math.random() * 12) + 1;
      const comments = Math.floor(Math.random() * 4);
      const views = Math.floor(Math.random() * 40) + 10;

      await client.query(
        'INSERT INTO loop_stats (loop_id, likes_count, comments_count, branches_count, shares_count, views_count, saves_count, updated_at) VALUES ($1, $2, $3, 0, 0, $4, 0, now()) ON CONFLICT (loop_id) DO UPDATE SET likes_count = $2, comments_count = $3, views_count = $4',
        [loopId, likes, comments, views]
      );

      postsCreated++;
      loopId++;
    } catch (e) {
      // Skip
    }
  }
  console.log('Created ' + postsCreated + ' bio-based posts');

  // ========== PART 3: Add comments to new posts ==========
  console.log('\n=== PART 3: Adding comments to new posts ===');

  const newPosts = await client.query(`
    SELECT l.id, p.username, l.content, ls.comments_count
    FROM loops l
    JOIN profiles p ON l.author_id = p.id
    JOIN loop_stats ls ON l.id = ls.loop_id
    WHERE l.id > 246
    AND ls.comments_count > 0
    ORDER BY l.id
  `);

  let newComments = 0;
  for (const post of newPosts.rows) {
    const category = getCommentCategory(post.content);
    const allComments = [...commentBank[category], ...commentBank.support];

    for (let i = 0; i < post.comments_count && i < allComments.length; i++) {
      const possibleCommenters = usernames.filter(u => u !== post.username);
      const commenter = possibleCommenters[Math.floor(Math.random() * possibleCommenters.length)];

      try {
        await client.query(
          'INSERT INTO comments (id, author_id, loop_id, content, like_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, now(), now())',
          [
            500 + newComments,
            idMap[commenter],
            post.id,
            allComments[i],
            Math.floor(Math.random() * 5) + 1
          ]
        );
        newComments++;
      } catch (e) {
        // Skip
      }
    }
  }
  console.log('Created ' + newComments + ' comments on new posts');

  // ========== PART 4: Add a few branches ==========
  console.log('\n=== PART 4: Creating branches ===');

  const branchablePosts = await client.query(`
    SELECT l.id, p.username, l.content
    FROM loops l
    JOIN profiles p ON l.author_id = p.id
    WHERE l.parent_loop_id IS NULL
    AND l.id > 200
    AND l.content LIKE '%build%' OR l.content LIKE '%ship%' OR l.content LIKE '%community%' OR l.content LIKE '%progress%'
    ORDER BY RANDOM()
    LIMIT 5
  `);

  let branchesCreated = 0;
  for (const post of branchablePosts.rows) {
    const brancher = usernames.filter(u => u !== post.username);
    const selectedBrancher = brancher[Math.floor(Math.random() * brancher.length)];

    const branchContents = [
      'This thread is gold. Bookmarking for the days when I need a reminder.',
      'Adding to this — the real magic happens when you combine consistency with curiosity.',
      'This resonated more than I expected. Sharing with my team.',
      'Couldn\'t agree more. The hardest part is starting, but once you do, the momentum carries you.',
    ];

    try {
      await client.query(
        'INSERT INTO loops (id, author_id, content, content_type, visibility, tree_depth, parent_loop_id, created_at, updated_at) VALUES ($1, $2, $3, \'text\', \'public\', 1, $4, now(), now())',
        [loopId, idMap[selectedBrancher], branchContents[branchesCreated % branchContents.length], post.id]
      );

      await client.query(
        'INSERT INTO loop_stats (loop_id, likes_count, comments_count, branches_count, shares_count, views_count, saves_count, updated_at) VALUES ($1, $2, 0, 0, 0, $3, 0, now()) ON CONFLICT (loop_id) DO UPDATE SET likes_count = $2, views_count = $3',
        [loopId, Math.floor(Math.random() * 5) + 1, Math.floor(Math.random() * 15) + 5]
      );

      // Update parent branch count
      await client.query('UPDATE loops SET branch_count = branch_count + 1 WHERE id = $1', [post.id]);

      loopId++;
      branchesCreated++;
    } catch (e) {
      // Skip
    }
  }
  console.log('Created ' + branchesCreated + ' branches');

  // ========== Final stats ==========
  const totalLoops = await client.query('SELECT count(*) as cnt FROM loops');
  const totalComments = await client.query('SELECT count(*) as cnt FROM comments');
  const totalBranches = await client.query('SELECT count(*) as cnt FROM loops WHERE parent_loop_id IS NOT NULL');

  console.log('\n=== FINAL STATS ===');
  console.log('Total loops: ' + totalLoops.rows[0].cnt);
  console.log('Total comments: ' + totalComments.rows[0].cnt);
  console.log('Total branches: ' + totalBranches.rows[0].cnt);

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
