const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "user-blocks-schema.sql"), "utf8");
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected. Applying user blocks schema...");
  await client.query(sql);
  console.log("Done.");
  await client.end();
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
