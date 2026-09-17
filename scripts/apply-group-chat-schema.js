#!/usr/bin/env node
/**
 * Apply group-chat schema to Supabase.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://..." node scripts/apply-group-chat-schema.js
 *   — or —
 *   DATABASE_URL="postgresql://..." node scripts/apply-group-chat-schema.js
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Set SUPABASE_DB_URL or DATABASE_URL environment variable.");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "group-chat-schema.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await client.connect();
    console.log("Connected to database.");
    await client.query(sql);
    console.log("Group chat schema applied successfully.");
    await client.end();
  } catch (error) {
    console.error("Error applying schema:", error.message);
    process.exit(1);
  }
})();
