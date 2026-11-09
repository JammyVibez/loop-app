/**
 * Read-only: classify the community-scoped rows that live inside *shared*
 * Loop tables, so a Community wipe never deletes a DM or global record.
 *
 * Prints only structural metadata (ids, scopes, timestamps) — never message
 * content.
 */
import pg from "pg"

const { Client } = pg
const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const out = {}

// messages: is circle_id a chat-room scope, or does it ride along on DMs?
{
  const { rows } = await client.query(`
    SELECT id, conversation_id, circle_id, sender_id,
           (content IS NOT NULL) AS has_content,
           (message_type <> 'text') AS non_text_type,
           message_type, created_at
    FROM messages
    WHERE circle_id IS NOT NULL
    ORDER BY created_at DESC
  `)
  const { rows: conv } = await client.query(`
    SELECT DISTINCT c.id, c.type, c.name
    FROM messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE m.circle_id IS NOT NULL
  `)
  out.messages = {
    rows: rows.length,
    sample: rows.slice(0, 5),
    conversation_types: conv,
  }
}

// call_sessions / bot_* — confirm every scoped row is circle-bound.
for (const [table, col] of [
  ["call_sessions", "circle_id"],
  ["bot_activity", "community_id"],
  ["bot_chat_messages", "community_id"],
  ["bot_marketplace_purchases", "community_id"],
]) {
  const { rows } = await client.query(`
    SELECT count(*)::int AS scoped,
           count(DISTINCT "${col}")::int AS distinct_scopes
    FROM "${table}"
    WHERE "${col}" IS NOT NULL
  `)
  out[table] = rows[0]
}

// Does anything outside the community tables point at community content?
{
  const { rows } = await client.query(`
    SELECT 'loops.circle_id' AS src, count(*)::int AS n FROM loops WHERE circle_id IS NOT NULL
    UNION ALL
    SELECT 'loop_duels.circle_id', count(*) FROM loop_duels WHERE circle_id IS NOT NULL
    UNION ALL
    SELECT 'notifications circle refs', count(*) FROM notifications
      WHERE data::text LIKE '%circle%' OR action_url LIKE '/circles/%' OR action_url LIKE '/communities/%'
    UNION ALL
    SELECT 'notifications circle_id col', count(*)
      FROM information_schema.columns WHERE table_name='notifications' AND column_name='circle_id'
  `)
  out.outbound_references = rows
}

console.log(JSON.stringify(out, null, 2))
await client.end()
