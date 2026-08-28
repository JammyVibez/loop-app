const { Client } = require('pg');
const client = new Client({ 
  connectionString: 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  await client.connect();
  
  // 1. Run the duel custom labels migration
  console.log('=== Running duel custom labels migration ===');
  await client.query('ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS side_a_label TEXT');
  await client.query('ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS side_b_label TEXT');
  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='loop_duels' AND column_name IN ('side_a_label','side_b_label') ORDER BY ordinal_position");
  console.log('New columns verified:', cols.rows.map(r=>r.column_name).join(', '));
  
  // 2. Audit all FKs for type mismatches
  console.log('\n=== Auditing FK constraints for type mismatches ===');
  const fkCheck = await client.query(`
    SELECT 
      tc.constraint_name,
      tc.table_name as source_table,
      kcu.column_name as source_column,
      ccu.table_name as target_table,
      ccu.column_name as target_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `);
  
  let issues = [];
  for (const fk of fkCheck.rows) {
    const srcType = await client.query(`SELECT data_type FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 AND table_schema='public'`, [fk.source_table, fk.source_column]);
    const tgtType = await client.query(`SELECT data_type FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 AND table_schema='public'`, [fk.target_table, fk.target_column]);
    if (srcType.rows[0] && tgtType.rows[0]) {
      if (srcType.rows[0].data_type !== tgtType.rows[0].data_type) {
        issues.push({ 
          constraint: fk.constraint_name, 
          source: fk.source_table+'.'+fk.source_column+' ('+srcType.rows[0].data_type+')', 
          target: fk.target_table+'.'+fk.target_column+' ('+tgtType.rows[0].data_type+')' 
        });
      }
    }
  }
  if (issues.length === 0) console.log('No FK type mismatches found!');
  else { 
    console.log('FK TYPE MISMATCHES (' + issues.length + '):'); 
    issues.forEach(i => console.log('  -', i.constraint+':', i.source, '->', i.target)); 
  }
  
  // 3. Check for missing FKs on _id columns (app-level only)
  console.log('\n=== Checking for _id columns missing FKs ===');
  const missingFks = await client.query(`
    SELECT c.table_name, c.column_name 
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' 
      AND c.column_name LIKE '%_id'
      AND c.table_name NOT LIKE 'pg_%'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND kcu.table_name = c.table_name 
          AND kcu.column_name = c.column_name
      )
    ORDER BY c.table_name, c.column_name
  `);
  if (missingFks.rows.length === 0) console.log('All _id columns have FKs!');
  else { 
    console.log('MISSING FKs (' + missingFks.rows.length + '):'); 
    missingFks.rows.forEach(r => console.log('  -', r.table_name+'.'+r.column_name)); 
  }
  
  // 4. Check for orphaned records
  console.log('\n=== Checking for orphaned records ===');
  const orphans = [];
  
  const checks = [
    { label: 'loop_duels->loops', query: "SELECT COUNT(*) FROM loop_duels d LEFT JOIN loops l ON d.loop_id = l.id WHERE d.loop_id IS NOT NULL AND l.id IS NULL" },
    { label: 'loop_duel_entries->loop_duels', query: "SELECT COUNT(*) FROM loop_duel_entries e LEFT JOIN loop_duels d ON e.duel_id = d.id WHERE d.id IS NULL" },
    { label: 'open_co_loop_participants->co_loop_sessions', query: "SELECT COUNT(*) FROM open_co_loop_participants p LEFT JOIN co_loop_sessions s ON p.session_id = s.session_id WHERE s.session_id IS NULL" },
    { label: 'notifications->profiles (actor_id)', query: "SELECT COUNT(*) FROM notifications n LEFT JOIN profiles p ON n.actor_id = p.id WHERE n.actor_id IS NOT NULL AND p.id IS NULL" },
    { label: 'user_mentions->profiles (actor_id)', query: "SELECT COUNT(*) FROM user_mentions m LEFT JOIN profiles p ON m.actor_id = p.id WHERE m.actor_id IS NOT NULL AND p.id IS NULL" },
    { label: 'loop_duels->profiles (opponent_id)', query: "SELECT COUNT(*) FROM loop_duels d LEFT JOIN profiles p ON d.opponent_id = p.id WHERE d.opponent_id IS NOT NULL AND p.id IS NULL" },
    { label: 'loop_duels->profiles (winner_id)', query: "SELECT COUNT(*) FROM loop_duels d LEFT JOIN profiles p ON d.winner_id = p.id WHERE d.winner_id IS NOT NULL AND p.id IS NULL" },
    { label: 'loop_duel_entries->profiles (user_id)', query: "SELECT COUNT(*) FROM loop_duel_entries e LEFT JOIN profiles p ON e.user_id = p.id WHERE p.id IS NULL" },
    { label: 'gift_transactions->profiles (recipient_id)', query: "SELECT COUNT(*) FROM gift_transactions t LEFT JOIN profiles p ON t.recipient_id = p.id WHERE t.recipient_id IS NOT NULL AND p.id IS NULL" },
    { label: 'call_sessions->profiles (creator_id)', query: "SELECT COUNT(*) FROM call_sessions c LEFT JOIN profiles p ON c.creator_id = p.id WHERE c.creator_id IS NOT NULL AND p.id IS NULL" },
    { label: 'messages->profiles (recipient_id)', query: "SELECT COUNT(*) FROM messages m LEFT JOIN profiles p ON m.recipient_id = p.id WHERE m.recipient_id IS NOT NULL AND p.id IS NULL" },
  ];
  
  for (const check of checks) {
    const r = await client.query(check.query);
    const count = parseInt(r.rows[0].count);
    if (count > 0) orphans.push(check.label + ': ' + count + ' orphans');
  }
  
  if (orphans.length === 0) console.log('No orphaned records found!');
  else { 
    console.log('ORPHANED RECORDS:'); 
    orphans.forEach(o => console.log('  -', o)); 
  }
  
  // 5. Verify clutch_duel_predictions type match with loop_duels
  console.log('\n=== Type alignment check ===');
  const predType = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name='clutch_duel_predictions' AND column_name='duel_id'");
  const duelIdType = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name='loop_duels' AND column_name='id'");
  const predUidType = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name='clutch_duel_predictions' AND column_name='user_id'");
  const profIdType = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name='profiles' AND column_name='id'");
  console.log('clutch_duel_predictions.duel_id:', predType.rows[0]?.data_type, '| loop_duels.id:', duelIdType.rows[0]?.data_type, predType.rows[0]?.data_type === duelIdType.rows[0]?.data_type ? '✅' : '❌');
  console.log('clutch_duel_predictions.user_id:', predUidType.rows[0]?.data_type, '| profiles.id:', profIdType.rows[0]?.data_type, predUidType.rows[0]?.data_type === profIdType.rows[0]?.data_type ? '✅' : '❌');
  
  // 6. Summary
  const totalFks = await client.query("SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public'");
  console.log('\n=== Summary ===');
  console.log('Total FK constraints:', totalFks.rows[0].count);
  console.log('FK type mismatches:', issues.length);
  console.log('Missing FKs:', missingFks.rows.length);
  console.log('Orphaned record groups:', orphans.length);
  
  await client.end();
  console.log('\nDone!');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
