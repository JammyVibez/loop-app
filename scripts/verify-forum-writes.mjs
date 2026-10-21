import pg from "pg"

/**
 * Proves the forum write path fits the real schema without writing anything:
 * every insert runs inside a transaction that is rolled back at the end.
 */
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const { rows: circleRows } = await client.query(
  `SELECT c.id, c.owner_id FROM circles c ORDER BY c.id LIMIT 1`,
)
const circle = circleRows[0]
if (!circle) throw new Error("no circles to test with")
const { rows: userRows } = await client.query(`SELECT id FROM profiles LIMIT 1`)
const authorId = circle.owner_id || userRows[0]?.id
console.log(`testing circle_id=${circle.id} author=${authorId}`)

await client.query("BEGIN")
try {
  const now = new Date().toISOString()
  const { rows: postRows } = await client.query(
    `INSERT INTO circle_posts
      (circle_id, author_id, content, post_type, space_id, tags, content_metadata,
       status, comment_count, like_count, view_count, last_activity_at, created_at, updated_at)
     VALUES ($1,$2,$3,'thread',NULL,$4,$5,'published',0,0,0,$6,$6,$6)
     RETURNING id`,
    [circle.id, authorId, "Forum write check body", ["check"], JSON.stringify({ title: "Forum write check" }), now],
  )
  const postId = postRows[0].id
  console.log(`✓ circle_posts insert (id=${postId})`)

  const { rows: commentRows } = await client.query(
    `INSERT INTO circle_post_comments (circle_id, post_id, author_id, content, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
    [circle.id, postId, authorId, "Reply check", now],
  )
  console.log(`✓ circle_post_comments insert (id=${commentRows[0].id})`)

  const { rows: voteRows } = await client.query(
    `INSERT INTO circle_post_interactions (post_id, user_id, interaction_type)
     VALUES ($1,$2,'upvote') RETURNING id`,
    [postId, authorId],
  )
  console.log(`✓ circle_post_interactions upvote insert (id=${voteRows[0].id})`)

  const { rows: logRows } = await client.query(
    `INSERT INTO community_moderation_logs (circle_id, moderator_id, action, target_type, target_id, details)
     VALUES ($1,$2,'thread_pin','post',$3,'{}'::jsonb) RETURNING id`,
    [circle.id, authorId, String(postId)],
  )
  console.log(`✓ community_moderation_logs insert (id=${logRows[0].id})`)

  const { rows: actRows } = await client.query(
    `INSERT INTO circle_activity (circle_id, actor_id, activity_type, target_type, target_id, metadata)
     VALUES ($1,$2,'thread_created','post',$3,'{}'::jsonb) RETURNING id`,
    [circle.id, authorId, String(postId)],
  )
  console.log(`✓ circle_activity insert (id=${actRows[0].id})`)
} finally {
  await client.query("ROLLBACK")
  console.log("transaction rolled back — nothing written")
}
await client.end()
