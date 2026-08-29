const { Client } = require('pg');
const DB_URL = 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database\n');

  // 1. Find all FK constraints referencing auth.users
  const authFks = await client.query(`
    SELECT 
      conrelid::regclass::text AS table_name,
      conname AS constraint_name,
      pg_get_constraintdef(oid) AS constraint_def
    FROM pg_constraint 
    WHERE contype = 'f' 
    AND connamespace = 'public'::regnamespace
    AND pg_get_constraintdef(oid) LIKE '%auth.users%'
  `);

  console.log(`Found ${authFks.rows.length} FK constraints referencing auth.users:\n`);

  let fixed = 0;
  let skipped = 0;

  for (const fk of authFks.rows) {
    console.log(`  Table: ${fk.table_name}`);
    console.log(`  Constraint: ${fk.constraint_name}`);
    console.log(`  Definition: ${fk.constraint_def}`);

    // Extract column name from constraint definition
    const colMatch = fk.constraint_def.match(/FOREIGN KEY \((\w+)\)/);
    if (!colMatch) {
      console.log('  -> Skipped (could not parse column name)\n');
      skipped++;
      continue;
    }

    const colName = colMatch[1];
    const newConstraintName = `${fk.table_name}_${colName}_fkey`;

    try {
      // Drop old FK
      await client.query(`ALTER TABLE ${fk.table_name} DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`);
      
      // Add new FK referencing profiles(id)
      await client.query(`
        ALTER TABLE ${fk.table_name} 
        ADD CONSTRAINT ${newConstraintName} 
        FOREIGN KEY (${colName}) REFERENCES profiles(id) ON DELETE CASCADE
      `);
      
      console.log(`  -> FIXED: ${fk.table_name}.${colName} -> profiles(id)\n`);
      fixed++;
    } catch (e) {
      console.log(`  -> Error: ${e.message}\n`);
      skipped++;
    }
  }

  // 2. Also check for UUID user_id columns without FK constraints
  console.log('\nChecking for UUID user_id columns without FK constraints...\n');
  
  const userIdCols = await client.query(`
    SELECT 
      c.table_name,
      c.column_name,
      c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name
    WHERE c.table_schema = 'public'
    AND c.column_name = 'user_id'
    AND c.data_type = 'uuid'
    AND t.table_name NOT IN ('profiles', 'user', 'session', 'account', 'verification')
  `);

  let fkAdded = 0;
  for (const col of userIdCols.rows) {
    // Check if FK already exists
    const existingFk = await client.query(`
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = $1::regclass 
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%user_id%'
    `, [col.table_name]);

    if (existingFk.rows.length > 0) continue;

    try {
      await client.query(`
        ALTER TABLE ${col.table_name} 
        ADD CONSTRAINT fk_${col.table_name}_user_id 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
      `);
      console.log(`  Added FK: ${col.table_name}.user_id -> profiles(id)`);
      fkAdded++;
    } catch (e) {
      // Type mismatch or other issue - skip silently
    }
  }

  // 3. Verify
  console.log('\n--- Verification ---\n');
  
  const remaining = await client.query(`
    SELECT 
      conrelid::regclass::text AS table_name,
      conname AS constraint_name,
      pg_get_constraintdef(oid) AS constraint_def
    FROM pg_constraint 
    WHERE contype = 'f' 
    AND connamespace = 'public'::regnamespace
    AND pg_get_constraintdef(oid) LIKE '%auth.users%'
  `);

  if (remaining.rows.length > 0) {
    console.log('WARNING: Still have FK references to auth.users:');
    remaining.rows.forEach(r => console.log(`  ${r.table_name}: ${r.constraint_def}`));
  } else {
    console.log('All FK references to auth.users have been fixed!');
  }

  // 4. Show all profiles FKs
  const profilesFks = await client.query(`
    SELECT 
      conrelid::regclass::text AS table_name,
      conname AS constraint_name,
      pg_get_constraintdef(oid) AS constraint_def
    FROM pg_constraint 
    WHERE contype = 'f' 
    AND connamespace = 'public'::regnamespace
    AND pg_get_constraintdef(oid) LIKE '%profiles%'
    ORDER BY table_name
  `);

  console.log(`\nAll FK references to profiles (${profilesFks.rows.length} total):`);
  profilesFks.rows.forEach(r => console.log(`  ${r.table_name}: ${r.constraint_def}`));

  // 5. Notify PostgREST
  await client.query("SELECT pg_notify('pgrst', 'reload schema')");
  
  console.log(`\nSummary: Fixed ${fixed}, Added ${fkAdded}, Skipped ${skipped}`);
  
  await client.end();
  console.log('Done!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
