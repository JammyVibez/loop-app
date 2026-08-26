import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // Overall counts
  const { rows: counts } = await client.query(`SELECT
    (SELECT COUNT(*) FROM loops) as loops,
    (SELECT COUNT(*) FROM comments) as comments,
    (SELECT COUNT(*) FROM comments WHERE parent_comment_id IS NOT NULL) as nested_comments,
    (SELECT COUNT(*) FROM loop_interactions) as interactions,
    (SELECT COUNT(*) FROM loop_interactions WHERE interaction_type = 'like') as likes,
    (SELECT COUNT(*) FROM loop_interactions WHERE interaction_type = 'bookmark') as bookmarks,
    (SELECT COUNT(*) FROM loop_interactions WHERE interaction_type = 'share') as shares,
    (SELECT COUNT(*) FROM loop_interactions WHERE interaction_type = 'view') as views`);
  console.log('=== TOTALS ===');
  console.log(JSON.stringify(counts[0], null, 2));

  // Loop engagement distribution
  console.log('\n=== ENGAGEMENT DISTRIBUTION ===');
  const { rows: dist } = await client.query(`
    SELECT 
      CASE WHEN like_count = 0 THEN '0' WHEN like_count <= 5 THEN '1-5' WHEN like_count <= 15 THEN '6-15' WHEN like_count <= 30 THEN '16-30' ELSE '31+' END as likes,
      COUNT(*) as loops
    FROM loops GROUP BY likes ORDER BY MIN(like_count)
  `);
  dist.forEach(d => console.log(`  ${d.likes} likes: ${d.loops} loops`));

  // Comment nesting depth
  console.log('\n=== COMMENT NESTING ===');
  const { rows: nesting } = await client.query(`
    SELECT 
      CASE WHEN parent_comment_id IS NULL THEN 'top-level' ELSE 'nested' END as type,
      COUNT(*) as count
    FROM comments GROUP BY type
  `);
  nesting.forEach(n => console.log(`  ${n.type}: ${n.count}`));

  // Posts per user
  console.log('\n=== POSTS PER USER (seed accounts) ===');
  const { rows: perUser } = await client.query(`
    SELECT p.username, COUNT(l.id) as posts
    FROM profiles p LEFT JOIN loops l ON p.id = l.author_id
    GROUP BY p.username, p.created_at
    ORDER BY posts DESC
    LIMIT 20
  `);
  perUser.forEach(u => console.log(`  ${u.username}: ${u.posts} posts`));

  // Random sample of new posts with their comment counts
  console.log('\n=== SAMPLE POSTS WITH ENGAGEMENT ===');
  const { rows: sample } = await client.query(`
    SELECT l.id, p.username, LEFT(l.content, 80) as content, l.like_count, l.comment_count, l.share_count, l.view_count
    FROM loops l JOIN profiles p ON l.author_id = p.id
    ORDER BY l.created_at DESC
    LIMIT 10
  `);
  sample.forEach(s => console.log(`  [${s.username}] "${s.content}..." | ❤️${s.like_count} 💬${s.comment_count} 🔄${s.share_count} 👁${s.view_count}`));

  // Sample threaded comments
  console.log('\n=== SAMPLE COMMENT THREADS ===');
  const { rows: threads } = await client.query(`
    SELECT c.id, c.parent_comment_id, p.username, LEFT(c.content, 70) as content, c.like_count
    FROM comments c JOIN profiles p ON c.author_id = p.id
    WHERE c.loop_id IN (SELECT id FROM loops ORDER BY created_at DESC LIMIT 3)
    ORDER BY c.id
    LIMIT 20
  `);
  threads.forEach(t => console.log(`  ${t.parent_comment_id ? '  ↳ ' : '  • '}[${t.username}] "${t.content}..." (likes: ${t.like_count})`));

  // Timing distribution
  console.log('\n=== POST TIMING DISTRIBUTION ===');
  const { rows: timing } = await client.query(`
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as posts
    FROM loops
    GROUP BY hour ORDER BY hour
  `);
  timing.forEach(t => console.log(`  ${String(t.hour).padStart(2, '0')}:00 — ${t.posts} posts ${'█'.repeat(Math.ceil(t.posts / 3))}`));

  await client.end();
}

main().catch(console.error);
