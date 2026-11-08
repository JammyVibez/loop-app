// Puts the Gilded Dusk Pro profile theme in the shop catalogue.
//
// The item carries its profile CSS, background artwork and soundtrack in
// item_data, exactly the shape the admin panel edits and the inventory equip
// endpoint reads. Idempotent: re-running updates the existing row in place.
//
// Run with: node scripts/seed-profile-theme.mjs
import { readFileSync } from "node:fs"
import pg from "pg"

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!databaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required to seed the shop.")
  process.exit(1)
}

const NAME = "Gilded Dusk"
const css = readFileSync("public/profile-themes/gilded-dusk.css", "utf8")
const cssBytes = Buffer.byteLength(css, "utf8")
if (cssBytes > 21000) {
  console.error(`Theme CSS is ${cssBytes} bytes — the profile limit is 21,000.`)
  process.exit(1)
}

const itemData = {
  // The storefront's card art reader looks for this inside item_data on this
  // schema (shop_items has no image_url column).
  image_url: "/profile-themes/gilded-dusk.svg",
  colors: {
    primary: "#e8c98b",
    secondary: "#c98f7a",
    accent: "#f7e6c4",
    background: "#140e1a",
    surface: "#221730",
    text: "#f7f0e4",
  },
  effects: { glow: true, animations: true, particles: false },
  profile_css: css,
  profile_background_url: "/profile-themes/gilded-dusk.svg",
  profile_audio_url: "/profile-themes/gilded-dusk.wav",
  profile_audio_title: "Gilded Dusk — Nocturne",
}

const description =
  "A smoked-glass profile in champagne gold and rose: warm serif name, gold-lit cover, " +
  "aurora artwork behind the whole page, and an 18-second ambient soundtrack. Pro only."

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const existing = await client.query("SELECT id FROM shop_items WHERE name = $1 LIMIT 1", [NAME])
  if (existing.rows.length) {
    await client.query(
      `UPDATE shop_items
          SET description = $2,
              price_coins = $3,
              category = 'theme',
              item_type = 'profile_theme',
              rarity = 'legendary',
              premium_only = true,
              is_active = true,
              thumbnail_url = $4,
              item_data = $5::jsonb,
              updated_at = now()
        WHERE id = $1`,
      [existing.rows[0].id, description, 1800, "/profile-themes/gilded-dusk.svg", JSON.stringify(itemData)],
    )
    console.log(`Updated ${NAME} (${existing.rows[0].id}) — CSS ${cssBytes} bytes.`)
  } else {
    const inserted = await client.query(
      `INSERT INTO shop_items
         (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, is_active, thumbnail_url, item_data, preview_data, created_at, updated_at)
       VALUES ($1, $2, $3, NULL, 'theme', 'profile_theme', 'legendary', true, true, $4, $5::jsonb, '{}'::jsonb, now(), now())
       RETURNING id`,
      [NAME, description, 1800, "/profile-themes/gilded-dusk.svg", JSON.stringify(itemData)],
    )
    console.log(`Inserted ${NAME} (${inserted.rows[0].id}) — CSS ${cssBytes} bytes.`)
  }
} finally {
  await client.end().catch(() => {})
}
