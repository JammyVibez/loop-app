// Puts the Pro profile themes in the shop catalogue.
//
// Each row carries its profile CSS, background artwork and soundtrack inside
// item_data — exactly the shape the admin panel edits and the inventory equip
// endpoint reads. Idempotent: re-running updates the existing rows in place.
//
// Run with: node scripts/seed-profile-theme.mjs
// Add --sync-equipped to also refresh the stored profile CSS of anyone who
// currently has one of these themes equipped (shop theme updates are otherwise
// only picked up when the owner re-equips the item).
import { readFileSync } from "node:fs"
import pg from "pg"

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!databaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required to seed the shop.")
  process.exit(1)
}

const THEMES = [
  {
    name: "Gilded Dusk",
    slug: "gilded-dusk",
    price: 1800,
    audioTitle: "Gilded Dusk — Nocturne",
    colors: {
      primary: "#e8c98b",
      secondary: "#c98f7a",
      accent: "#f7e6c4",
      background: "#140e1a",
      surface: "#221730",
      text: "#f7f0e4",
    },
    description:
      "A smoked-glass profile in champagne gold and rose: warm serif name, gold-lit cover, " +
      "aurora artwork behind the whole page, and an 18-second ambient soundtrack. Pro only.",
  },
  {
    name: "Gojo — Limitless",
    slug: "gojo-limitless",
    price: 2600,
    audioTitle: "Limitless — Infinite Blue",
    colors: {
      primary: "#9fe8ff",
      secondary: "#4a7bff",
      accent: "#f4fdff",
      background: "#050b1c",
      surface: "#0a1430",
      text: "#eaf9ff",
    },
    description:
      "An infinite blue void: glowing infinity mark, ice-glass identity pane, glacial name " +
      "treatment and a shimmering 14-second loop that plays under the whole profile. Pro only.",
  },
  {
    name: "Sukuna — Malevolent Shrine",
    slug: "sukuna-malevolent",
    price: 2600,
    audioTitle: "Malevolent Shrine — Cursed Pulse",
    colors: {
      primary: "#ff3a1f",
      secondary: "#ff9a6a",
      accent: "#ffe6d6",
      background: "#0a0203",
      surface: "#1a0507",
      text: "#ffe6d6",
    },
    description:
      "Crimson lacquer and black timber: a blood moon over a shrine lattice, brushed serif " +
      "name, angled glass and a low 19-second cursed pulse. Pro only.",
  },
  {
    name: "The Weeknd — After Hours",
    slug: "after-hours",
    price: 2200,
    audioTitle: "After Hours — Neon Drive",
    colors: {
      primary: "#ff2e63",
      secondary: "#7fb2ff",
      accent: "#ffe9f0",
      background: "#05030f",
      surface: "#120a2b",
      text: "#ffe9f0",
    },
    description:
      "A midnight drive in neon: retro sun over the skyline, chrome-rose name, wet-street " +
      "reflections and a 15-second synthwave loop. Pro only.",
  },
  // ── Anime themes ─────────────────────────────────────────────────────────
  // Artwork and CSS come from scripts/generate-anime-profile-themes.mjs, the
  // soundtrack from scripts/generate-profile-theme-audio.mjs. Admins can swap
  // any of it afterwards from Admin → Themes → Edit theme (including a GIF or
  // short video background).
  {
    name: "Naruto — Hidden Leaf",
    slug: "naruto-hidden-leaf",
    price: 2600,
    audioTitle: "Hidden Leaf — Will of Fire",
    colors: {
      primary: "#ff8a3d",
      secondary: "#63d29a",
      accent: "#ffe8c9",
      background: "#0a1020",
      surface: "#131f38",
      text: "#f4f0e6",
    },
    description:
      "A village evening in leaf green and ember orange: the leaf crest over the rooftops, a " +
      "warm sunset scrim and a 16-second theme of resolve. Pro only.",
  },
  {
    name: "Demon Slayer — Hinokami",
    slug: "demon-slayer-hinokami",
    price: 2600,
    audioTitle: "Hinokami — Sun Breathing",
    colors: {
      primary: "#ff5a33",
      secondary: "#ffd166",
      accent: "#fff1e6",
      background: "#0a0507",
      surface: "#1b0b0d",
      text: "#ffe9df",
    },
    description:
      "Black timber, bronze checkers and a rising sun flame: the Hinokami crest, embers over " +
      "the profile and a 17-second sun-breathing pulse. Pro only.",
  },
  {
    name: "One Piece — Grand Line",
    slug: "one-piece-grand-line",
    price: 2400,
    audioTitle: "Grand Line — Thousand Sunny",
    colors: {
      primary: "#ffcf5c",
      secondary: "#38a9e0",
      accent: "#fff4d1",
      background: "#04101c",
      surface: "#0a2233",
      text: "#f4fbff",
    },
    description:
      "Open ocean gold and sail blue: a compass crest, a ship on the sunset line and a " +
      "14-second sea-faring loop. Pro only.",
  },
  {
    name: "Sailor Moon — Moon Prism",
    slug: "sailor-moon-prism",
    price: 2400,
    audioTitle: "Moon Prism — Silver Crystal",
    colors: {
      primary: "#ff8fc7",
      secondary: "#9fd8ff",
      accent: "#fff1f9",
      background: "#0a0718",
      surface: "#17102e",
      text: "#fdf2ff",
    },
    description:
      "Silver crystal and pastel ribbon light: a crescent moon, prism sparkles and a " +
      "16-second glassy moonrise loop. Pro only.",
  },
]

const syncEquipped = process.argv.includes("--sync-equipped")

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  for (const theme of THEMES) {
    const css = readFileSync(`public/profile-themes/${theme.slug}.css`, "utf8")
    const cssBytes = Buffer.byteLength(css, "utf8")
    if (cssBytes > 21000) {
      console.error(`${theme.name}: CSS is ${cssBytes} bytes — the profile limit is 21,000.`)
      process.exitCode = 1
      continue
    }

    const image = `/profile-themes/${theme.slug}.svg`
    const audio = `/profile-themes/${theme.slug}.wav`
    const itemData = {
      // The storefront's card art reader looks for this inside item_data on
      // this schema (shop_items has no image_url column).
      image_url: image,
      colors: theme.colors,
      effects: { glow: true, animations: true, particles: false },
      profile_css: css,
      profile_background_url: image,
      profile_audio_url: audio,
      profile_audio_title: theme.audioTitle,
      profile_audio_enabled: true,
      profile_audio_autoplay: true,
    }

    const existing = await client.query("SELECT id FROM shop_items WHERE name = $1 LIMIT 1", [theme.name])
    let themeId
    if (existing.rows.length) {
      themeId = existing.rows[0].id
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
        [themeId, theme.description, theme.price, image, JSON.stringify(itemData)],
      )
      console.log(`Updated ${theme.name} (${themeId}) — CSS ${cssBytes} bytes.`)
    } else {
      const inserted = await client.query(
        `INSERT INTO shop_items
           (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, is_active, thumbnail_url, item_data, preview_data, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, 'theme', 'profile_theme', 'legendary', true, true, $4, $5::jsonb, '{}'::jsonb, now(), now())
         RETURNING id`,
        [theme.name, theme.description, theme.price, image, JSON.stringify(itemData)],
      )
      themeId = inserted.rows[0].id
      console.log(`Inserted ${theme.name} (${themeId}) — CSS ${cssBytes} bytes.`)
    }

    if (syncEquipped) {
      // The equipped theme is normally `active_theme`, but profiles equipped
      // before that column was written only carry the theme name in
      // theme_preferences. Refresh those too, and never inject CSS into a
      // profile that is not actually wearing a theme.
      const synced = await client.query(
        `UPDATE profiles
            SET profile_design_css = $1, updated_at = now()
          WHERE active_theme::text = $2::text
             OR (theme_preferences->>'name' = $3
                 AND profile_design_css IS NOT NULL
                 AND profile_design_css <> '')`,
        [css, themeId, theme.name],
      )
      console.log(`  ↳ refreshed ${synced.rowCount} equipped profile(s).`)
    }
  }
} finally {
  await client.end().catch(() => {})
}
