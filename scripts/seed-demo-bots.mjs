#!/usr/bin/env node
/**
 * Seed two demo bots for the Developers Forum community and list them on the
 * Bot Marketplace. Idempotent — safe to re-run.
 *
 * Usage: node scripts/seed-demo-bots.mjs "postgresql://..."
 */
import { readFileSync } from "node:fs"
import pg from "pg"

const url = process.argv[2]
if (!url) {
  console.error("Usage: node scripts/seed-demo-bots.mjs <DATABASE_URL>")
  process.exit(1)
}

const client = new pg.Client(url)
await client.connect()

// Owner = the app's main admin account ("Loop")
const { rows: owners } = await client.query(
  `SELECT id FROM profiles WHERE is_admin = true ORDER BY loop_coins DESC LIMIT 1`,
)
const ownerId = owners[0]?.id
if (!ownerId) {
  console.error("No admin profile found — cannot seed bots.")
  await client.end()
  process.exit(1)
}

// Attach to the Developers Forum community (id 1); fall back to the first circle
const { rows: circles } = await client.query(
  `SELECT id FROM circles WHERE id = 1 OR id = (SELECT min(id) FROM circles) ORDER BY id LIMIT 1`,
)
const communityId = circles[0]?.id
if (!communityId) {
  console.error("No community found — cannot seed bots.")
  await client.end()
  process.exit(1)
}

const bots = [
  {
    name: "LoopGuard",
    slug: "loopguard",
    description:
      "Auto-moderation sentinel for your community. Warns, mutes, filters spam and keeps discussions clean — runs 24/7 on Loop's hosted edge.",
    category: "moderation",
    avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=LoopGuard&backgroundColor=8b5cf6",
    status: "online",
    deployment_type: "hosted",
    auto_reply:
      "LoopGuard here. I scan new posts and flag anything against your community rules. Try /warn @user or /modhelp for commands.",
    commands: ["/warn", "/mute", "/unmute", "/purge", "/filter", "/modhelp"],
    price_coins: 250,
    allows_hosted: true,
    allows_source: false,
    rating_sum: 24,
    rating_count: 6,
    purchase_count: 3,
  },
  {
    name: "CoinKeeper",
    slug: "coinkeeper",
    description:
      "Storefront & rewards bot. Sell products, run giveaways and track member balances — everything your community shop needs, with source code included.",
    category: "ecommerce",
    avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=CoinKeeper&backgroundColor=f59e0b",
    status: "online",
    deployment_type: "source",
    auto_reply:
      "CoinKeeper is your community shopkeeper. Try /shop to browse items, /balance to check coins, or /giveaway to run one.",
    commands: ["/shop", "/balance", "/buy", "/inventory", "/giveaway", "/earn"],
    price_coins: 500,
    allows_hosted: true,
    allows_source: true,
    rating_sum: 30,
    rating_count: 8,
    purchase_count: 5,
  },
]

let created = 0
for (const b of bots) {
  const { rows: existing } = await client.query(
    `SELECT id FROM community_bots WHERE community_id = $1 AND name = $2`,
    [communityId, b.name],
  )
  if (existing.length > 0) {
    console.log(`→ Bot "${b.name}" already exists — skipping`)
    continue
  }

  const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  const { rows: inserted } = await client.query(
    `INSERT INTO community_bots (
       community_id, owner_id, name, slug, description, avatar_url, category, status,
       deployment_type, auto_reply, commands, secret_token, is_listed, price_coins,
       allows_hosted, allows_source, rating_sum, rating_count, purchase_count, last_active_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, $14, $15, $16, $17, $18, NOW())
     RETURNING id`,
    [
      communityId, ownerId, b.name, b.slug, b.description, b.avatar_url, b.category, b.status,
      b.deployment_type, b.auto_reply, b.commands, token, b.price_coins,
      b.allows_hosted, b.allows_source, b.rating_sum, b.rating_count, b.purchase_count,
    ],
  )
  const botId = inserted[0].id

  await client.query(
    `INSERT INTO bot_activity (bot_id, community_id, actor_id, type, title, message)
     VALUES ($1, $2, $3, 'created', $4, $5)`,
    [botId, communityId, ownerId, `${b.name} deployed`, `${b.name} is online and listed on the Bot Marketplace.`],
  )
  await client.query(
    `UPDATE community_bots SET purchase_count = $1 WHERE id = $2`,
    [b.purchase_count, botId],
  )
  console.log(`✓ Created bot "${b.name}" (${botId}) — listed at ${b.price_coins} coins`)
  created += 1
}

await client.end()
console.log(created > 0 ? `\nDone — ${created} bot(s) created and listed.` : "\nNothing to do — both bots already exist.")