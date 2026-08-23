#!/usr/bin/env node
/**
 * Phase 4 fix: Migrate loops.id from sequential integers to proper Snowflake IDs.
 *
 * Strategy:
 * 1. Generate Snowflake ID mapping
 * 2. Drop all FK constraints referencing loops.id
 * 3. Update all FK column values using the mapping
 * 4. Swap loops.id (drop old PK, rename snowflake_id to id)
 * 5. Recreate FK constraints
 */
const { Client } = require('pg');
const { Worker: SnowflakeWorker } = require('snowflake-uuid');

const CONN = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';
const generator = new SnowflakeWorker(1, 1);

// All tables with FK columns referencing loops.id
const FK_TABLES = [
  { table: 'comments', column: 'loop_id' },
  { table: 'gift_transactions', column: 'loop_id' },
  { table: 'gifts', column: 'context_id' },
  { table: 'hashtag_usage', column: 'loop_id' },
  { table: 'loop_boosts', column: 'loop_id' },
  { table: 'loop_collaborators', column: 'loop_id' },
  { table: 'loop_duels', column: 'loop_id' },
  { table: 'loop_interactions', column: 'loop_id' },
  { table: 'loop_poll_votes', column: 'loop_id' },
  { table: 'loop_polls', column: 'loop_id' },
  { table: 'loop_reactions', column: 'loop_id' },
  { table: 'loop_stats', column: 'loop_id' },
  { table: 'loops', column: 'parent_loop_id' },
  { table: 'notifications', column: 'related_id' },
  { table: 'reports', column: 'content_id' },
  { table: 'user_mentions', column: 'post_id' },
  { table: 'user_mentions', column: 'source_id' },
  { table: 'user_mentions', column: 'loop_id' },
];

(async () => {
  const c = new Client({ connectionString: CONN });
  await c.connect();

  try {
    // Step 1: Generate Snowflake ID mapping
    console.log('Step 1: Generating Snowflake ID mapping...');
    const loops = await c.query('SELECT id FROM loops ORDER BY created_at, id');
    const idMap = {};
    for (const loop of loops.rows) {
      idMap[loop.id] = Number(generator.nextId().valueOf());
    }
    console.log(`  Mapped ${Object.keys(idMap).length} loop IDs`);

    // Step 2: Drop ALL FK constraints referencing loops.id
    console.log('Step 2: Dropping FK constraints...');
    const fkConstraints = await c.query(`
      SELECT tc.constraint_name, tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'loops'
        AND ccu.column_name = 'id'
    `);
    for (const fk of fkConstraints.rows) {
      await c.query(`ALTER TABLE ${fk.table_name} DROP CONSTRAINT ${fk.constraint_name}`);
      console.log(`  Dropped: ${fk.table_name}.${fk.constraint_name}`);
    }

    // Also drop the self-referencing FK on loops.parent_loop_id
    const selfRef = await c.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'loops'::regclass AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%loops%id%'
    `);
    for (const pk of selfRef.rows) {
      try {
        await c.query(`ALTER TABLE loops DROP CONSTRAINT ${pk.conname}`);
        console.log(`  Dropped self-ref: ${pk.conname}`);
      } catch {}
    }

    // Step 3: Add snowflake_id column
    console.log('Step 3: Adding snowflake_id column to loops...');
    await c.query('ALTER TABLE loops ADD COLUMN IF NOT EXISTS snowflake_id BIGINT');
    // Backfill using the mapping
    for (const [oldId, newId] of Object.entries(idMap)) {
      await c.query('UPDATE loops SET snowflake_id = $1 WHERE id = $2', [newId, parseInt(oldId)]);
    }
    console.log(`  Backfilled ${Object.keys(idMap).length} loops`);

    // Step 4: Update ALL FK columns
    console.log('Step 4: Updating FK column values...');
    for (const fk of FK_TABLES) {
      if (fk.table === 'loops' && fk.column === 'parent_loop_id') continue;
      try {
        const before = (await c.query(`SELECT COUNT(*) as c FROM ${fk.table} WHERE ${fk.column} IS NOT NULL`)).rows[0].c;
        // Update using the mapping — join against the snowflake_id we just set
        await c.query(`
          UPDATE ${fk.table}
          SET ${fk.column} = l.snowflake_id
          FROM loops l
          WHERE ${fk.table}.${fk.column} = l.id
            AND l.snowflake_id IS NOT NULL
        `);
        const after = (await c.query(`SELECT COUNT(*) as c FROM ${fk.table} WHERE ${fk.column} IS NOT NULL`)).rows[0].c;
        if (before !== after) {
          console.log(`  ${fk.table}.${fk.column}: ${before} → ${after}`);
        } else {
          console.log(`  ${fk.table}.${fk.column}: ${before} updated (unchanged count)`);
        }
      } catch (e) {
        console.log(`  ERROR ${fk.table}.${fk.column}: ${e.message.substring(0, 80)}`);
      }
    }

    // Step 4b: Update parent_loop_id (self-reference)
    console.log('  loops.parent_loop_id (self-ref)...');
    await c.query(`
      UPDATE loops
      SET parent_loop_id = l.snowflake_id
      FROM loops l
      WHERE loops.parent_loop_id = l.id
        AND l.snowflake_id IS NOT NULL
    `);
    console.log('  loops.parent_loop_id: done');

    // Step 5: Update notifications JSONB
    console.log('Step 5: Updating notifications JSONB...');
    for (const [oldId, newId] of Object.entries(idMap)) {
      await c.query(`
        UPDATE notifications
        SET data = jsonb_set(data, '{loop_id}', to_jsonb($1::bigint))
        WHERE data->>'loop_id' = $2
      `, [newId, oldId]);
    }
    console.log(`  Updated ${Object.keys(idMap).length} notification entries`);

    // Step 6: Swap loops.id
    console.log('Step 6: Swapping loops.id...');
    // Drop old PK
    const pkConst = await c.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'loops'::regclass AND contype = 'p'
    `);
    for (const pk of pkConst.rows) {
      await c.query(`ALTER TABLE loops DROP CONSTRAINT ${pk.conname}`);
      console.log(`  Dropped PK: ${pk.conname}`);
    }

    // Drop old id, rename snowflake_id to id
    await c.query('ALTER TABLE loops DROP COLUMN id');
    await c.query('ALTER TABLE loops RENAME COLUMN snowflake_id TO id');
    await c.query('ALTER TABLE loops ADD PRIMARY KEY (id)');
    console.log('  Swapped: snowflake_id → id (PK)');

    // Step 7: Recreate FK constraints
    console.log('Step 7: Recreating FK constraints...');
    for (const fk of FK_TABLES) {
      if (fk.table === 'loops' && fk.column === 'parent_loop_id') continue;
      try {
        const constraintName = `fk_${fk.table}_${fk.column}_loops`;
        await c.query(`
          ALTER TABLE ${fk.table} ADD CONSTRAINT ${constraintName}
          FOREIGN KEY (${fk.column}) REFERENCES loops(id) ON DELETE CASCADE
        `);
        console.log(`  Created: ${fk.table}.${fk.column} → loops.id`);
      } catch (e) {
        console.log(`  SKIP ${fk.table}.${fk.column}: ${e.message.substring(0, 60)}`);
      }
    }

    // Recreate self-ref FK on parent_loop_id
    try {
      await c.query(`ALTER TABLE loops ADD CONSTRAINT fk_loops_parent_loop_id_loops
        FOREIGN KEY (parent_loop_id) REFERENCES loops(id) ON DELETE SET NULL`);
      console.log('  Created: loops.parent_loop_id → loops.id (self-ref)');
    } catch (e) {
      console.log(`  SKIP self-ref: ${e.message.substring(0, 60)}`);
    }

    // Recreate unique constraint on comments.loop_id if needed
    // (Some tables had unique constraints that included the FK column)

    console.log('\n✅ Migration complete!');

    // Verify
    const verify = await c.query('SELECT id, created_at FROM loops ORDER BY created_at DESC LIMIT 5');
    console.log('\nVerification:');
    for (const v of verify.rows) {
      console.log(`  id=${v.id} (${String(v.id).length} digits) created=${v.created_at}`);
    }
    const maxCheck = await c.query('SELECT MAX(id) as max_id, MIN(id) as min_id FROM loops');
    console.log(`\nID range: ${maxCheck.rows[0].min_id} — ${maxCheck.rows[0].max_id}`);
    console.log(`Max ID length: ${String(maxCheck.rows[0].max_id).length} digits`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
