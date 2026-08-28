/**
 * Migration: Add 2FA columns to profiles table and create security_audit_log table.
 * Run with: node scripts/add-2fa-columns.js
 */

const { Pool } = require("pg")

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // 1. Add 2FA columns to profiles table
    console.log("Adding 2FA columns to profiles...")
    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
      ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB
    `)
    console.log("✅ 2FA columns added")

    // 2. Create security_audit_log table
    console.log("Creating security_audit_log table...")
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    console.log("✅ security_audit_log table created")

    // 3. Create indexes for fast lookups
    console.log("Creating indexes...")
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_log(ip_address);
      CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_security_audit_user_action ON security_audit_log(user_id, action);
    `)
    console.log("✅ Indexes created")

    // 4. Create composite index for rate limiting checks
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_security_audit_ip_action_time
      ON security_audit_log(ip_address, action, created_at);
    `)
    console.log("✅ Rate limit index created")

    await client.query("COMMIT")
    console.log("\n🎉 Migration complete!")
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("❌ Migration failed:", error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
