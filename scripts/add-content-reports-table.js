/**
 * Migration: Create content_reports table.
 * Run with: node scripts/add-content-reports-table.js
 */

const { Pool } = require("pg")
const connectionString = process.env.DATABASE_URL
if (!connectionString) { console.error("DATABASE_URL required"); process.exit(1) }

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })

async function run() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    console.log("Creating content_reports table...")
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        content_id UUID NOT NULL,
        content_type TEXT NOT NULL CHECK (content_type IN ('loop', 'comment', 'message', 'profile')),
        reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'misinformation', 'copyright', 'self_harm', 'other')),
        details TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        reviewed_by UUID REFERENCES profiles(id),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    console.log("✅ content_reports table created")

    console.log("Creating indexes...")
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
      CREATE INDEX IF NOT EXISTS idx_content_reports_content ON content_reports(content_id, content_type);
      CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports(reporter_id);
      CREATE INDEX IF NOT EXISTS idx_content_reports_created ON content_reports(created_at);
    `)
    console.log("✅ Indexes created")

    await client.query("COMMIT")
    console.log("\n🎉 Content reports migration complete!")
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("❌ Migration failed:", error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((err) => { console.error(err); process.exit(1) })
