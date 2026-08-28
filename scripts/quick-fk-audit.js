const { Client } = require('pg');
const client = new Client({ 
  connectionString: 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  await client.connect();
  
  // 1. Run migration
  console.log('=== Migration: adding duel custom labels ===');
  await client.query('ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS side_a_label TEXT');
  await client.query('ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS side_b_label TEXT');
  console.log('Columns added ✅');

  // 2. Quick type mismatch check on known problem tables
  console.log('\n=== Quick FK type audit ===');
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
  
  let issues = [];
  for (const [srcTable, srcCol, tgtTable, tgtCol] of checks) {
    const src = await client.query(`SELECT data_type FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 AND table_schema='public'`, [srcTable, srcCol]);
    const tgt = await client.query(`SELECT data_type FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 AND table_schema='public'`, [tgtTable, tgtCol]);
    const srcType = src.rows[0]?.data_type || 'MISSING';
    const tgtType = tgt.rows[0]?.data_type || 'MISSING';
    const ok = srcType === tgtType;
    console.log(`  ${srcTable}.${srcCol}(${srcType}) -> ${tgtTable}.${tgtCol}(${tgtType}) ${ok ? '✅' : '❌'}`);
    if (!ok) issues.push({ srcTable, srcCol, srcType, tgtTable, tgtCol, tgtType });
  }
  
  if (issues.length === 0) {
    console.log('\nAll key FK types match ✅');
  } else {
    console.log(`\n❌ ${issues.length} FK type mismatches found, fixing...`);
    for (const issue of issues) {
      if (issue.srcType === 'uuid' && issue.tgtType === 'bigint') {
        // Fix by changing source column type or dropping bad FK
        console.log(`  Fixing: dropping FK on ${issue.srcTable}.${issue.srcCol} (uuid->bigint mismatch)`);
        const fkName = await client.query(
          `SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass AND conkey = (SELECT attnum FROM pg_attribute WHERE attrelid = $1::regclass AND attname = $2)`,
          [issue.srcTable, issue.srcCol]
        );
        if (fkName.rows[0]) {
          await client.query(`ALTER TABLE ${issue.srcTable} DROP CONSTRAINT IF EXISTS ${fkName.rows[0].conname}`);
          console.log(`    Dropped constraint: ${fkName.rows[0].conname}`);
        }
      } else if (issue.srcType === 'bigint' && issue.tgtType === 'uuid') {
        console.log(`  Fixing: dropping FK on ${issue.srcTable}.${issue.srcCol} (bigint->uuid mismatch)`);
        const fkName = await client.query(
          `SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass AND conkey = (SELECT attnum FROM pg_attribute WHERE attrelid = $1::regclass AND attname = $2)`,
          [issue.srcTable, issue.srcCol]
        );
        if (fkName.rows[0]) {
          await client.query(`ALTER TABLE ${issue.srcTable} DROP CONSTRAINT IF EXISTS ${fkName.rows[0].conname}`);
          console.log(`    Dropped constraint: ${fkName.rows[0].conname}`);
        }
      } else {
        console.log(`  ⚠️  ${issue.srcTable}.${issue.srcCol}: ${issue.srcType} vs ${issue.tgtType} - needs manual review`);
      }
    }
  }

  await client.end();
  console.log('\nDone!');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
