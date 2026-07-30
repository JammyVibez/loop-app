import pg from 'pg';

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
console.log('Database URL present:', !!dbUrl);

if (dbUrl) {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Successfully connected to Postgres!');
    const res = await client.query('SELECT current_database(), current_user;');
    console.log('Connected DB:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Postgres Connection Error:', err.message);
  }
}
