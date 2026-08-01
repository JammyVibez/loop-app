import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error('No database connection URL found in environment variables.');
  process.exit(1);
}

const sqlFiles = [
  'scripts/wallet-and-events-schema.sql',
  'scripts/complete-database-setup.sql',
  'scripts/launch-schema-alignment.sql',
  'scripts/circles-schema-alignment.sql'
];

async function run() {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL Supabase database.');

    for (const file of sqlFiles) {
      const filePath = resolve(process.cwd(), file);
      if (!existsSync(filePath)) {
        console.warn(`File not found: ${file}, skipping.`);
        continue;
      }
      console.log(`Applying SQL migration: ${file}...`);
      const sql = readFileSync(filePath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`✅ Successfully applied ${file}`);
      } catch (sqlErr) {
        console.warn(`⚠️ Partial error or statement warning applying ${file}:`, sqlErr.message);
      }
    }

    console.log('🎉 Database tables synchronization complete!');
  } catch (err) {
    console.error('Database migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
