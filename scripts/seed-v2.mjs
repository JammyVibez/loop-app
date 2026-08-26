import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const SEED_ACCOUNTS = [
  { id: '4d1d17b1-be42-4214-803f-34a2f56dde33', username: 'avariver' },
  { id: '7ec9433f-3732-47c9-91fa-d3332083f02f', username: 'ninacole' },
  { id: '9b26d4fd-b3e3-4da9-b8ef-ee6c48e5357a', username: 'noahbloom' },
  { id: '7bcf8a0d-5556-4aed-be4f-8b826ff37d33', username: 'miastone' },
  { id: '17a12097-d2e2-4965-9d9a-46fb53c161ab', username: 'leofrost' },
  { id: '84d890eb-757a-48a5-a463-ea9be8628202', username: 'zoesky' },
  { id: 'db5b4184-066f-40be-9235-f96411ad63b4', username: 'kailane' },
  { id: '8c0e2c49-9c2e-4745-a043-04ce21e7229a', username: 'ivycruz' },
  { id: 'd469d34c-bde9-4842-a1b9-c61049f82bdc', username: 'ezravale' },
  { id: 'f15343ab-6382-4554-b92c-090bc9da7da7', username: 'lunapark' },
  { id: 'd2c5cc86-22c9-4ab3-9ad7-9453de77424b', username: 'omarwest' },
  { id: 'afe82a3d-8828-4d27-86d5-6bfea6ab37d5', username: 'theohart' },
  { id: 'f5c1eb2c-1449-4d13-8689-6c0472647f27', username: 'ariaquinn' },
  { id: '1ef8b48d-8e87-488e-aa51-e40c7bfe8e61', username: 'judebeck' },
  { id: 'fb34846b-9f53-4b17-bd53-9bb9d24c0ef1', username: 'siashaw' },
  { id: '0c974364-6571-4f6e-8e32-e3357fa12a72', username: 'rexray' },
  { id: 'e5c09d64-4014-4d20-9781-4f54cd364af3', username: 'noafox' },
  { id: 'aaf8e1ba-2c80-4282-8db9-6391140208d5', username: 'elidawn' },
  { id: '2e053481-3a0f-4bda-8216-7d412a8098e7', username: 'verayork' },
  { id: '1f9b6346-bb54-43c6-85bc-94a80d9fe520', username: 'jonbell' },
  { id: 'bc23f929-efff-41c8-a246-d71249b1517b', username: 'halalverified' },
  { id: 'de822fe7-2b29-4563-b270-ce33cbd58712', username: 'crazyray1' },
  { id: '8b4fe905-c78d-43c4-86d3-1e4f7a783a0a', username: 'babygojo01' },
  { id: '8830ee87-9b8f-426b-b4d5-6d87cecbeeac', username: 'jackss' },
];

function rc(a) { return a[Math.floor(Math.random() * a.length)]; }
function rs(a, n) { const s = [...a].sort(() => Math.random() - 0.5); return s.slice(0, Math.min(n, s.length)); }
function fmt(d) { return d.toISOString().replace('T', ' ').replace('Z', '+00'); }

const POSTS = [
  "Just realized I've been writing CSS for 8 hours straight and my back hurts. But hey, that scrollbar is *pixel perfect* now.",
  "Hot take: the best debugging tool is a good night's sleep. Stuck on a bug for 3 hours yesterday, went to bed, woke up, fixed it in 2 minutes.",
  "Unpopular opinion: TypeScript is just JavaScript with a security blanket. And I need that security blanket.",
  "Today I learned that `git blame` doesn't actually blame you, it just shows who last touched the line. But emotionally, it's the same.",
  "My dev setup: 3 monitors, standing desk, noise-canceling headphones, and the ability to still get distracted by my phone.",
  "Code review tip: if you can't understand what the code does in 30 seconds, the code needs to be simpler. Not your brain.",
  "Started learning Rust today. The borrow checker already hates me. We're off to a great start.",
  "Nothing humbles you faster than livecoding in front of an audience and forgetting a semicolon.",
  "Why do all my side projects start as 'I'll just build a quick prototype' and end as 'I need to refactor the entire architecture'?",
  "The best part about open source is when someone opens an issue on your repo 3 years later and you have no memory of writing that code.",
  "Spent 2 hours debugging a CSS issue. It was a missing `z-index`. I'm fine. Everything is fine.",
  "Pro tip: name your branches something descriptive like `feature/user-auth` instead of `asdfghjkl` like I do at 2am.",
  "Coffee count today: 4. Bugs fixed: 0. Lines of code deleted: 200. Productivity: undefined.",
  "Hot take: the perfect code review takes exactly 7 minutes. Less than that, you missed something. More than that, you're bikeshedding.",
  "Just watched a 10-hour coding livestream and now I feel like I can build anything. Spoiler: I will build nothing.",
  "The real 10x engineer is the one who writes code that the 1x engineer can maintain.",
  "My plants are jealous of how much time I spend looking at green text in a terminal.",
  "TIL that `console.log` is not a substitute for proper debugging. But it sure feels like it is.",
  "Recruiter DM: 'We're looking for a senior dev with 10 years of experience in a framework that's 2 years old.' Classic.",
  "The secret to being productive is not checking Hacker News every 5 minutes. I would know, I just checked it again.",
  "Wrote a blog post about my startup journey. It's 3 paragraphs long because: had idea, wrote code, still writing code.",
  "If your code works without comments, it's not self-documenting. It's just undocumented.",
  "Day 47 of building in public: posted my revenue numbers ($12) and someone DMed me asking for investment advice. Wild.",
  "Anyone else get that 3pm brain fog where you stare at the screen and suddenly you're on Wikipedia reading about umbrellas?",
  "Just pushed to main on a Friday. No regrets. (I do have regrets.)",
  "The most satisfying feeling in coding: deleting a file and nothing breaks.",
  "I've mass archived all the '10x engineer' tweets from my bookmarks. Turns out the 10x thing was just knowing when to ask for help.",
  "My code editor has more extensions than actual code at this point. It's like putting spoilers on a car that doesn't run.",
  "Started a 30-day coding challenge. Day 3: wrote a hello world and called it a week.",
  "There are two types of developers: those who write tests and those who will eventually wish they had.",
];

const CMNTS = [
  "This is so relatable it hurts 😭", "I feel personally attacked by this post",
  "This is the content I signed up for", "Hard agree on this one",
  "Finally someone said it", "I literally just experienced this yesterday",
  "The z-index comment is too real. Spent entire sprints on z-index issues.",
  "TypeScript with a security blanket is the most accurate description ever",
  "Console.log gang rise up", "My git log looks like a crime scene from 2am coding sessions",
  "I once deleted 800 lines and tests still passed. Best day of my career.",
  "Building in public is underrated. Even failures teach people something.",
  "$12 MRR is $12 more than most side projects ever make. Respect.",
  "The Wikipedia rabbit holes are too real. Fixed CSS, ended up reading about Roman aqueducts.",
  "Friday deploys build character. And gray hairs.",
  "My dev setup is: one laptop, a blanket, and anxiety.",
  "The brain fog hits different when debugging something that worked yesterday for no reason",
  "Wait until you discover Tailwind's dark mode. Another 2 hours gone.",
  "No because same. Literally same.", "You're not wrong but also ouch",
  "This thread is everything 😂", "OK but who gave you permission to call me out like this",
  "Can confirm, I am the bug in this story", "Plot twist: the real treasure was the bugs we fixed along the way",
  "Reading this at 2am while debugging. The irony is not lost on me.",
  "Not me bookmarking this for my next 3pm crisis", "This thread just keeps getting better",
  "I showed this to my team lead and they just sighed", "The '47 extensions' comment — I have 52. I need help.",
  "We've all been the 'asdfghjkl' branch person. No shame.",
  "Not me sharing this with my entire dev team", "I'm in this post and I don't like it",
  "This is peak developer humor", "Replying to add this also applies to CSS grid.",
];

const TAGS = ['devlife', 'coding', 'startup', 'buildinpublic', 'tech', 'javascript', 'webdev'];

// === STEP 1: Create posts ===
async function seedPosts() {
  const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) as count FROM loops WHERE content = ANY($1)`, [POSTS]);
  if (parseInt(count) >= 10) { console.log(`Posts already seeded (${count})`); return; }

  console.log('Creating 30 posts...');
  for (let i = 0; i < 30; i++) {
    const author = SEED_ACCOUNTS[i % SEED_ACCOUNTS.length];
    const content = POSTS[i];
    const tags = rs(TAGS, 1 + Math.floor(Math.random() * 3));
    const daysAgo = Math.floor(Math.random() * 14);
    const postDate = new Date(Date.now() - daysAgo * 86400000 - Math.random() * 86400000);
    const ts = fmt(postDate);
    const { rows: [{ id }] } = await client.query('SELECT generate_snowflake_id_text() as id');

    await client.query(`
      INSERT INTO loops (id, author_id, content, hashtags, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $5)
      ON CONFLICT DO NOTHING
    `, [id, author.id, content, tags, ts]);

    await client.query(`
      INSERT INTO loop_stats (loop_id, created_at, updated_at) VALUES ($1, $2, $2) ON CONFLICT DO NOTHING
    `, [id, ts]);

    console.log(`  ${i+1}. [${author.username}] ${content.substring(0, 55)}...`);
  }
}

// === STEP 2: Add comments ===
async function seedComments() {
  const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) as count FROM comments`);
  if (parseInt(count) > 300) { console.log(`Comments already seeded (${count})`); return; }

  console.log('Creating comments...');
  const { rows: loops } = await client.query(`SELECT id, author_id, created_at FROM loops ORDER BY created_at DESC LIMIT 60`);

  let inserted = 0;
  for (const loop of loops) {
    const n = 2 + Math.floor(Math.random() * 3);
    const loopDate = new Date(loop.created_at);
    const avail = SEED_ACCOUNTS.filter(a => a.id !== loop.author_id);

    // Top-level comments
    const commentIds = [];
    for (let j = 0; j < n; j++) {
      const commenter = rc(avail);
      const cDate = new Date(loopDate.getTime() + (0.5 + Math.random() * 48) * 3600000);
      if (cDate > new Date()) continue;

      const { rows: [{ id }] } = await client.query(`
        INSERT INTO comments (author_id, loop_id, content, like_count, parent_comment_id, created_at, updated_at)
        VALUES ($1, $2, $3, 0, NULL, $4, $4) RETURNING id
      `, [commenter.id, loop.id, rc(CMNTS), fmt(cDate)]);
      commentIds.push(id);
      inserted++;
    }

    // Nested replies (40% chance per top-level comment)
    for (const cid of commentIds) {
      if (Math.random() > 0.4) continue;
      const nr = 1 + Math.floor(Math.random() * 2);
      let lastDate = loopDate;
      for (let k = 0; k < nr; k++) {
        const replier = rc(avail);
        const rDate = new Date(lastDate.getTime() + (0.5 + Math.random() * 12) * 3600000);
        if (rDate > new Date()) continue;
        await client.query(`
          INSERT INTO comments (author_id, loop_id, content, parent_comment_id, like_count, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 0, $5, $5)
        `, [replier.id, loop.id, rc(CMNTS), cid, fmt(rDate)]);
        inserted++;
        lastDate = rDate;
      }
    }
  }
  console.log(`  Inserted ${inserted} comments`);
}

// === STEP 3: Add engagement ===
async function seedEngagement() {
  const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) as count FROM loop_interactions`);
  if (parseInt(count) > 15000) { console.log(`Interactions already seeded (${count})`); return; }

  console.log('Creating engagement...');
  const { rows: loops } = await client.query(`SELECT id, author_id, created_at FROM loops`);
  const userIds = SEED_ACCOUNTS.map(a => a.id);
  let inserted = 0;

  for (const loop of loops) {
    const tier = Math.random();
    const nLikes = tier < 0.3 ? 2 + Math.floor(Math.random() * 8) : tier < 0.7 ? 8 + Math.floor(Math.random() * 18) : 20 + Math.floor(Math.random() * 40);
    const nBookmarks = tier < 0.3 ? Math.floor(Math.random() * 3) : tier < 0.7 ? 2 + Math.floor(Math.random() * 6) : 5 + Math.floor(Math.random() * 12);
    const nShares = tier < 0.3 ? Math.floor(Math.random() * 2) : tier < 0.7 ? 1 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 8);
    const nViews = tier < 0.3 ? 10 + Math.floor(Math.random() * 40) : tier < 0.7 ? 40 + Math.floor(Math.random() * 150) : 150 + Math.floor(Math.random() * 350);

    const avail = userIds.filter(id => id !== loop.author_id);
    const likes = rs(avail, nLikes);
    const bks = rs(avail.filter(id => !likes.includes(id)), nBookmarks);
    const shs = rs(avail.filter(id => !likes.includes(id) && !bks.includes(id)), nShares);
    const vws = rs(avail, nViews);
    const loopDate = new Date(loop.created_at);

    const batch = [];
    const params = [];
    let pi = 1;

    const addInteraction = (uid, type) => {
      const d = new Date(loopDate.getTime() + (0.1 + Math.random() * 168) * 3600000);
      if (d > new Date()) return;
      batch.push(`($${pi}, $${pi+1}, $${pi+2}, $${pi+3})`);
      params.push(uid, loop.id, type, fmt(d));
      pi += 4;
    };

    likes.forEach(id => addInteraction(id, 'like'));
    bks.forEach(id => addInteraction(id, 'bookmark'));
    shs.forEach(id => addInteraction(id, 'share'));
    vws.forEach(id => addInteraction(id, 'view'));

    if (batch.length > 0) {
      await client.query(`INSERT INTO loop_interactions (user_id, loop_id, interaction_type, created_at) VALUES ${batch.join(', ')}`, params);
      inserted += batch.length;
    }

    // Update counters for this loop
    await client.query(`
      UPDATE loops SET
        like_count = (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = $1 AND interaction_type = 'like'),
        comment_count = (SELECT COUNT(*) FROM comments WHERE loop_id = $1),
        share_count = (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = $1 AND interaction_type = 'share'),
        view_count = (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = $1 AND interaction_type = 'view')
      WHERE id = $1
    `, [loop.id]);

    await client.query(`
      INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, saves_count, updated_at)
      VALUES ($1,
        (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = $1 AND interaction_type = 'like'),
        (SELECT COUNT(*) FROM comments WHERE loop_id = $1),
        (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = $1 AND interaction_type = 'share'),
        (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = $1 AND interaction_type = 'view'),
        (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = $1 AND interaction_type = 'bookmark'),
        NOW()
      )
      ON CONFLICT (loop_id) DO UPDATE SET
        likes_count = EXCLUDED.likes_count,
        comments_count = EXCLUDED.comments_count,
        shares_count = EXCLUDED.shares_count,
        views_count = EXCLUDED.views_count,
        saves_count = EXCLUDED.saves_count,
        updated_at = EXCLUDED.updated_at
    `, [loop.id]);
  }

  console.log(`  Inserted ${inserted} interactions`);
}

// === STEP 4: Update profile counters ===
async function updateProfiles() {
  console.log('Updating profile counters...');
  await client.query(`
    UPDATE profiles SET
      loops_count = (SELECT COUNT(*) FROM loops WHERE author_id = profiles.id),
      followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = profiles.id),
      following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = profiles.id)
  `);
}

async function main() {
  await client.connect();
  await seedPosts();
  await seedComments();
  await seedEngagement();
  await updateProfiles();

  // Final summary
  const { rows: s } = await client.query(`SELECT
    (SELECT COUNT(*) FROM loops) as loops,
    (SELECT COUNT(*) FROM comments) as comments,
    (SELECT COUNT(*) FROM loop_interactions) as interactions,
    (SELECT COUNT(*) FROM comments WHERE parent_comment_id IS NOT NULL) as nested_comments,
    (SELECT COUNT(*) FROM loop_stats WHERE likes_count > 0) as loops_with_likes`);
  console.log('\n=== FINAL ===');
  console.log(`Loops: ${s[0].loops}, Comments: ${s[0].comments} (${s[0].nested_comments} nested), Interactions: ${s[0].interactions}`);
  console.log(`Loops with likes synced: ${s[0].loops_with_likes}`);

  const { rows: eng } = await client.query(`SELECT interaction_type, COUNT(*) as c FROM loop_interactions GROUP BY interaction_type ORDER BY c DESC`);
  eng.forEach(r => console.log(`  ${r.interaction_type}: ${r.c}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
