const { Client } = require('pg');
const DB_URL = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  // Find ALL bigint FK columns that don't have FK constraints
  const allFks = await client.query(`
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name NOT IN ('profiles','user','session','account','verification','subscription')
    AND c.data_type = 'bigint'
    AND c.column_name LIKE '%_id'
    AND c.column_name != 'id'
    AND c.column_name != 'snowflake_id'
    ORDER BY c.table_name, c.column_name
  `);

  const existingFks = await client.query(`
    SELECT conrelid::regclass::text as table_name, 
           pg_get_constraintdef(oid) as def
    FROM pg_constraint 
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  `);

  const fkDefs = existingFks.rows.map(r => r.def);

  let created = 0;
  let skipped = 0;

  for (const r of allFks.rows) {
    // Check if a FK constraint already covers this column
    const hasFk = fkDefs.some(d => d.includes(r.table_name) && d.includes(r.column_name));
    if (hasFk) { skipped++; continue; }

    // Try to guess the ref table from the column name
    let refTable = r.column_name.replace(/_id$/, '');
    const candidates = [r.table_name, refTable, refTable + 's'];
    
    let foundTable = null;
    for (const t of candidates) {
      if (t === r.table_name && r.column_name.startsWith('parent_')) {
        // Self-reference
        foundTable = r.table_name;
        break;
      }
      const check = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id' AND data_type = 'bigint'`,
        [t]
      );
      if (check.rows.length > 0) {
        foundTable = t;
        break;
      }
    }

    if (!foundTable) { skipped++; continue; }

    try {
      await client.query(
        `ALTER TABLE ${r.table_name} ADD CONSTRAINT fk_${r.table_name}_${r.column_name} FOREIGN KEY (${r.column_name}) REFERENCES ${foundTable}(id) ON DELETE SET NULL`
      );
      console.log(`Created: ${r.table_name}.${r.column_name} -> ${foundTable}`);
      created++;
    } catch (e) {
      // Some may fail due to existing NULL values, try with NOT VALID
      try {
        await client.query(
          `ALTER TABLE ${r.table_name} ADD CONSTRAINT fk_${r.table_name}_${r.column_name} FOREIGN KEY (${r.column_name}) REFERENCES ${foundTable}(id) ON DELETE SET NULL NOT VALID`
        );
        console.log(`Created (NOT VALID): ${r.table_name}.${r.column_name} -> ${foundTable}`);
        created++;
      } catch (e2) {
        // console.log(`Skip: ${r.table_name}.${r.column_name} -> ${foundTable}: ${e2.message.substring(0, 60)}`);
        skipped++;
      }
    }
  }

  console.log(`\nCreated ${created} FK constraints, skipped ${skipped}`);

  // Verify the loops self-ref
  const loopsFk = await client.query(`
    SELECT pg_get_constraintdef(oid) as def FROM pg_constraint 
    WHERE conrelid = 'loops'::regclass AND contype = 'f'
  `);
  console.log('\nloops FK constraints now:');
  loopsFk.rows.forEach(r => console.log('  ' + r.def));

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
