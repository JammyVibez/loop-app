const { Client } = require('pg');
const DB_URL = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  // All remaining UUID columns that reference BIGINT tables (not profiles)
  const conversions = [
    // Circle-related
    { table: 'circle_post_interactions', col: 'post_id', ref: 'circle_posts' },
    { table: 'circle_post_polls', col: 'post_id', ref: 'circle_posts' },
    { table: 'circle_post_poll_votes', col: 'poll_id', ref: 'circle_post_polls' },
    { table: 'circle_room_members', col: 'room_id', ref: 'circle_rooms' },
    { table: 'circle_room_messages', col: 'reply_to_id', ref: 'circle_room_messages' },
    { table: 'circle_room_polls', col: 'room_id', ref: 'circle_rooms' },
    { table: 'circle_room_poll_votes', col: 'poll_id', ref: 'circle_room_polls' },
    { table: 'circle_room_presence', col: 'room_id', ref: 'circle_rooms' },
    // Messages
    { table: 'messages', col: 'forwarded_message_id', ref: 'messages' },
    { table: 'messages', col: 'reply_to_message_id', ref: 'messages' },
    // Developer
    { table: 'developer_projects', col: 'forked_from_id', ref: 'developer_projects' },
    { table: 'project_comments', col: 'project_id', ref: 'developer_projects' },
    { table: 'project_comments', col: 'parent_comment_id', ref: 'project_comments' },
    { table: 'project_collaborators', col: 'project_id', ref: 'developer_projects' },
    { table: 'project_forks', col: 'forked_project_id', ref: 'developer_projects' },
    { table: 'project_forks', col: 'original_project_id', ref: 'developer_projects' },
    { table: 'project_stars', col: 'project_id', ref: 'developer_projects' },
    { table: 'dev_quest_submissions', col: 'project_id', ref: 'developer_projects' },
    { table: 'snippet_likes', col: 'snippet_id', ref: 'code_snippets' },
    // Reels
    { table: 'reel_comments', col: 'parent_comment_id', ref: 'reel_comments' },
    // Gifts & Transactions
    { table: 'gift_transactions', col: 'stream_id', ref: 'live_streams' },
    { table: 'gifts', col: 'context_id', ref: 'loops' },
    // Cosmetics & Shop
    { table: 'user_cosmetics_equipped', col: 'item_id', ref: 'shop_items' },
    { table: 'user_cosmetics_inventory', col: 'item_id', ref: 'shop_items' },
    { table: 'user_gifts', col: 'item_id', ref: 'gifts' },
    { table: 'user_inventory', col: 'item_id', ref: 'shop_items' },
    // Events
    { table: 'virtual_events', col: 'organizer_id', ref: 'profiles' },
    // Themes
    { table: 'theme_bundles', col: 'creator_id', ref: 'profiles' },
    { table: 'themes', col: 'category_id', ref: 'themes' },
    { table: 'themes', col: 'creator_id', ref: 'profiles' },
    // Other
    { table: 'content_flags', col: 'content_id', ref: 'loops' },
    { table: 'notifications', col: 'related_id', ref: 'loops' },
    { table: 'reports', col: 'content_id', ref: 'loops' },
    { table: 'user_mentions', col: 'post_id', ref: 'loops' },
    { table: 'user_mentions', col: 'source_id', ref: 'loops' },
    { table: 'user_mentions', col: 'reel_id', ref: 'reels' },
    { table: 'user_mentions', col: 'comment_id', ref: 'comments' },
    { table: 'stream_chat', col: 'stream_id', ref: 'live_streams' },
    { table: 'stream_viewers', col: 'stream_id', ref: 'live_streams' },
    { table: 'voice_channel_participants', col: 'channel_id', ref: 'circle_voice_channels' },
    { table: 'workspace_collaborators', col: 'workspace_id', ref: 'shared_workspaces' },
    { table: 'moment_comments', col: 'parent_comment_id', ref: 'moment_comments' },
    { table: 'user_skills', col: 'skill_id', ref: 'skill_trees' },
  ];

  let fixed = 0;
  let failed = 0;

  for (const c of conversions) {
    // Check if column is still UUID
    const colCheck = await client.query(
      "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
      [c.table, c.col]
    );
    if (colCheck.rows.length === 0 || colCheck.rows[0].data_type !== 'uuid') continue;

    // Check if ref table has the right id type
    const refCheck = await client.query(
      "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'",
      [c.ref]
    );
    if (refCheck.rows.length === 0 || refCheck.rows[0].data_type !== 'bigint') continue;

    // Drop RLS policies
    const policies = await client.query('SELECT policyname FROM pg_policies WHERE tablename = $1', [c.table]);
    for (const p of policies.rows) {
      await client.query('DROP POLICY IF EXISTS "' + p.policyname + '" ON ' + c.table);
    }

    // Drop constraints on this column
    const constraints = await client.query(
      "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = $1::regclass AND contype IN ('u','f')",
      [c.table]
    );
    for (const con of constraints.rows) {
      if (con.def.includes(c.col)) {
        await client.query('ALTER TABLE ' + c.table + ' DROP CONSTRAINT IF EXISTS ' + con.conname);
      }
    }

    try {
      // NULL out old values
      await client.query('UPDATE ' + c.table + ' SET ' + c.col + ' = NULL');
      // Convert type
      await client.query('ALTER TABLE ' + c.table + ' ALTER COLUMN ' + c.col + ' TYPE text USING ' + c.col + '::text');
      await client.query('ALTER TABLE ' + c.table + ' ALTER COLUMN ' + c.col + ' TYPE bigint USING CASE WHEN ' + c.col + ' IS NULL THEN NULL ELSE ' + c.col + '::bigint END');
      // Add FK
      await client.query('ALTER TABLE ' + c.table + ' ADD CONSTRAINT fk_' + c.table + '_' + c.col + ' FOREIGN KEY (' + c.col + ') REFERENCES ' + c.ref + '(id) ON DELETE SET NULL');
      fixed++;
    } catch (e) {
      failed++;
    }
  }

  await client.query("SELECT pg_notify('pgrst', 'reload schema')");
  const total = await client.query("SELECT count(*) as cnt FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace");
  console.log('Fixed: ' + fixed + ', Failed: ' + failed + ', Total FKs: ' + total.rows[0].cnt);

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
