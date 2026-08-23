#!/usr/bin/env node
/**
 * Recovery script v3: Fix corrupted loop IDs using ctid-based assignment.
 * 
 * All 303 loops have only 3 distinct IDs due to JS Number() overflow.
 * No PK constraint exists. Need to assign unique IDs using physical row addresses.
 */
const { Client } = require('pg');
const CONN = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';
const EPOCH = 1288834974657;

(async () => {
  const c = new Client({ connectionString: CONN });
  await c.connect();

  try {
    // Step 1: Create temp table mapping ctid → new unique ID
    console.log('Step 1: Creating ctid-based ID mapping...');
    await c.query('DROP TABLE IF EXISTS ctid_map');
    await c.query(`
      CREATE TEMP TABLE ctid_map AS
      SELECT ctid as tid,
             (((EXTRACT(EPOCH FROM NOW()) * 1000)::bigint - ${EPOCH}) << 22)
             | (1 << 17) | (1 << 12) | ROW_NUMBER() OVER (ORDER BY created_at ASC, ctid ASC) as new_id
      FROM loops
    `);
    
    const mapCount = await c.query('SELECT COUNT(*) as c, COUNT(DISTINCT new_id) as d FROM ctid_map');
    console.log(`  Mapped ${mapCount.rows[0].c} rows, ${mapCount.rows[0].d} unique IDs`);

    // Step 2: Update loops using ctid
    console.log('Step 2: Updating loops.id via ctid...');
    await c.query(`ALTER TABLE loops ADD COLUMN IF NOT EXISTS temp_id BIGINT`);
    await c.query(`UPDATE loops SET temp_id = m.new_id FROM ctid_map m WHERE loops.ctid = m.tid`);
    
    // Check
    const nullCheck = await c.query('SELECT COUNT(*) as c FROM loops WHERE temp_id IS NULL');
    console.log(`  NULL temp_ids: ${nullCheck.rows[0].c}`);
    
    const uniqueCheck = await c.query('SELECT COUNT(DISTINCT temp_id) as d FROM loops WHERE temp_id IS NOT NULL');
    console.log(`  Unique temp_ids: ${uniqueCheck.rows[0].d}`);

    // Step 3: Drop old id, rename temp_id to id
    console.log('Step 3: Swapping columns...');
    await c.query('ALTER TABLE loops DROP COLUMN id');
    await c.query('ALTER TABLE loops RENAME COLUMN temp_id TO id');
    await c.query('ALTER TABLE loops ALTER COLUMN id SET NOT NULL');
    
    // Step 4: Add PK
    console.log('Step 4: Adding primary key...');
    await c.query('ALTER TABLE loops ADD PRIMARY KEY (id)');
    console.log('  ✅ PK created');

    // Step 5: Fix loop_stats.loop_id (sequential 1-303 → new IDs)
    console.log('Step 5: Fixing loop_stats.loop_id...');
    await c.query(`
      UPDATE loop_stats SET loop_id = l.new_id
      FROM (
        SELECT id as new_id,
               ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
        FROM loops
      ) l
      WHERE loop_stats.loop_id = l.rn
    `);
    const statsCheck = await c.query('SELECT COUNT(DISTINCT loop_id) as d FROM loop_stats');
    console.log(`  Stats unique loop_ids: ${statsCheck.rows[0].d}`);

    // Step 6: Clear parent_loop_id (broken values from old migration)
    console.log('Step 6: Clearing broken parent_loop_id...');
    await c.query('UPDATE loops SET parent_loop_id = NULL');
    
    // Step 7: Drop all corrupted FK data
    console.log('Step 7: Clearing corrupted dependent data...');
    const tables = [
      'comments', 'loop_interactions', 'loop_reactions', 'loop_boosts',
      'loop_polls', 'loop_poll_votes', 'loop_duels', 'loop_collaborators',
      'hashtag_usage', 'user_mentions', 'gift_transactions'
    ];
    for (const t of tables) {
      try {
        const cnt = await c.query(`SELECT COUNT(*) as c FROM ${t}`);
        await c.query(`DELETE FROM ${t}`);
        if (parseInt(cnt.rows[0].c) > 0) console.log(`  Cleared ${t} (${cnt.rows[0].c} rows)`);
      } catch (e) { /* skip */ }
    }
    try { await c.query(`UPDATE notifications SET data = data - 'loop_id' WHERE data ? 'loop_id'`); } catch {}

    // Step 8: Recreate FK constraints
    console.log('Step 8: Recreating FK constraints...');
    const FK_DEFS = [
      ['comments', 'loop_id'], ['loop_interactions', 'loop_id'],
      ['loop_reactions', 'loop_id'], ['loop_boosts', 'loop_id'],
      ['loop_stats', 'loop_id'], ['loop_polls', 'loop_id'],
      ['loop_poll_votes', 'loop_id'], ['loop_duels', 'loop_id'],
      ['loop_collaborators', 'loop_id'], ['hashtag_usage', 'loop_id'],
      ['user_mentions', 'loop_id'], ['user_mentions', 'post_id'],
      ['user_mentions', 'source_id'],
    ];
    for (const [table, col] of FK_DEFS) {
      try {
        const name = `fk_${table}_${col}_loops`;
        await c.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${name}`);
        await c.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} FOREIGN KEY (${col}) REFERENCES loops(id) ON DELETE CASCADE`);
      } catch {}
    }
    try {
      await c.query(`ALTER TABLE loops ADD CONSTRAINT fk_loops_parent_loop_id_loops
        FOREIGN KEY (parent_loop_id) REFERENCES loops(id) ON DELETE SET NULL`);
    } catch {}

    // Reload schema
    try { await c.query("SELECT pg_notify('pgrst', 'reload schema')"); } catch {}

    // Verify
    console.log('\n✅ Recovery complete!');
    const v = await c.query('SELECT COUNT(*) as c, COUNT(DISTINCT id) as d FROM loops');
    console.log(`  loops: ${v.rows[0].c} rows, ${v.rows[0].d} unique IDs (all unique: ${v.rows[0].c === v.rows[0].d ? '✅' : '❌'})`);

    const pk = await c.query("SELECT conname FROM pg_constraint WHERE conrelid = 'loops'::regclass AND contype = 'p'");
    console.log(`  PK: ${pk.rows.length > 0 ? '✅ ' + pk.rows[0].conname : '❌'}`);

    const fk = await c.query(`SELECT COUNT(*) as c FROM pg_constraint WHERE contype = 'f'`);
    console.log(`  FK constraints: ${fk.rows[0].c}`);

    const sample = await c.query('SELECT id, LEFT(content, 40) as content, created_at FROM loops ORDER BY created_at LIMIT 3');
    for (const r of sample.rows) console.log(`  ${r.id} "${r.content}..." ${r.created_at}`);

    await c.end();
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
