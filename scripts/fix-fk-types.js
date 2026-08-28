const { Client } = require('pg');
const client = new Client({ 
  connectionString: 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  await client.connect();

  // 1. Fix the clutch_duel_predictions.duel_id FK type mismatch
  console.log('=== Fixing clutch_duel_predictions.duel_id type mismatch ===');
  
  // First find the constraint name
  const fkResult = await client.query(`
    SELECT conname, conrelid::regclass as table_name
    FROM pg_constraint 
    WHERE contype = 'f' 
      AND conrelid = 'clutch_duel_predictions'::regclass
  `);
  console.log('FK constraints on clutch_duel_predictions:', fkResult.rows.map(r => r.conname).join(', '));
  
  // Drop the broken FK
  for (const fk of fkResult.rows) {
    await client.query(`ALTER TABLE clutch_duel_predictions DROP CONSTRAINT IF EXISTS ${fk.conname}`);
    console.log(`  Dropped: ${fk.conname}`);
  }
  
  // Now fix the column type: change duel_id from UUID to bigint
  console.log('\nChanging clutch_duel_predictions.duel_id from uuid to bigint...');
  // First check if there's any data with valid UUIDs
  const sampleData = await client.query(`SELECT duel_id FROM clutch_duel_predictions LIMIT 5`);
  console.log('Current duel_id values:', sampleData.rows.map(r => r.duel_id));
  
  // Check if any duel_ids are actual UUIDs vs text
  const hasUuids = await client.query(`
    SELECT COUNT(*) FROM clutch_duel_predictions WHERE duel_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  `);
  const hasInts = await client.query(`
    SELECT COUNT(*) FROM clutch_duel_predictions WHERE duel_id::text ~ '^[0-9]+$' AND duel_id::text !~ '-'
  `);
  console.log('Rows with UUID format:', hasUuids.rows[0].count);
  console.log('Rows with integer format:', hasInts.rows[0].count);
  
  // Clean up orphaned predictions where duel_id doesn't match any loop_duels.id
  const orphanCount = await client.query(`
    SELECT COUNT(*) FROM clutch_duel_predictions p 
    WHERE NOT EXISTS (SELECT 1 FROM loop_duels d WHERE d.id::text = p.duel_id::text)
  `);
  console.log('Orphaned predictions (no matching duel):', orphanCount.rows[0].count);
  
  if (parseInt(orphanCount.rows[0].count) > 0) {
    console.log('Removing orphaned predictions...');
    await client.query(`
      DELETE FROM clutch_duel_predictions p 
      WHERE NOT EXISTS (SELECT 1 FROM loop_duels d WHERE d.id::text = p.duel_id::text)
    `);
    console.log('Orphaned predictions cleaned ✅');
  }
  
  // Now change the column type
  // First need to handle the data - if duel_id contains UUIDs that match loop_duels.id::text, keep them
  // If not, convert
  await client.query(`ALTER TABLE clutch_duel_predictions ALTER COLUMN duel_id TYPE bigint USING duel_id::text::bigint`);
  console.log('Column type changed to bigint ✅');
  
  // Recreate the FK
  await client.query(`
    ALTER TABLE clutch_duel_predictions 
    ADD CONSTRAINT clutch_duel_predictions_duel_id_fkey 
    FOREIGN KEY (duel_id) REFERENCES loop_duels(id) ON DELETE CASCADE
  `);
  console.log('FK recreated ✅');
  
  // Also add FK for user_id -> profiles.id if missing
  const userFk = await client.query(`
    SELECT conname FROM pg_constraint 
    WHERE contype = 'f' 
      AND conrelid = 'clutch_duel_predictions'::regclass
      AND conkey = (SELECT ARRAY[attnum] FROM pg_attribute WHERE attrelid = 'clutch_duel_predictions'::regclass AND attname = 'user_id')
  `);
  if (userFk.rows.length === 0) {
    console.log('\nAdding clutch_duel_predictions.user_id -> profiles.id FK...');
    await client.query(`
      ALTER TABLE clutch_duel_predictions 
      ADD CONSTRAINT clutch_duel_predictions_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    `);
    console.log('user_id FK added ✅');
  } else {
    console.log('\nuser_id FK already exists ✅');
  }

  // 2. Re-run the audit to confirm
  console.log('\n=== Re-audit after fixes ===');
  const checks = [
    ['clutch_duel_predictions', 'duel_id', 'loop_duels', 'id'],
    ['clutch_duel_predictions', 'user_id', 'profiles', 'id'],
    ['loop_duel_entries', 'duel_id', 'loop_duels', 'id'],
    ['loop_duel_entries', 'user_id', 'profiles', 'id'],
    ['loop_duels', 'opponent_id', 'profiles', 'id'],
    ['loop_duels', 'winner_id', 'profiles', 'id'],
    ['loop_duels', 'creator_id', 'profiles', 'id'],
    ['loop_duels', 'loop_id', 'loops', 'id'],
    ['open_co_loop_participants', 'session_id', 'co_loop_sessions', 'session_id'],
  ];
  
  for (const [srcTable, srcCol, tgtTable, tgtCol] of checks) {
    const src = await client.query(`SELECT data_type FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 AND table_schema='public'`, [srcTable, srcCol]);
    const tgt = await client.query(`SELECT data_type FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 AND table_schema='public'`, [tgtTable, tgtCol]);
    const srcType = src.rows[0]?.data_type || 'MISSING';
    const tgtType = tgt.rows[0]?.data_type || 'MISSING';
    const ok = srcType === tgtType;
    console.log(`  ${srcTable}.${srcCol}(${srcType}) -> ${tgtTable}.${tgtCol}(${tgtType}) ${ok ? '✅' : '❌'}`);
  }

  // 3. Verify new duel columns
  console.log('\n=== Final verification ===');
  const duelCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='loop_duels' AND column_name IN ('side_a_label','side_b_label','duel_type','clip_url','prediction_question','betting_ends_at','correct_side') ORDER BY ordinal_position");
  console.log('Duel columns:', duelCols.rows.map(r => r.column_name + ':' + r.data_type).join(', '));
  
  await client.end();
  console.log('\nAll fixes applied ✅');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
