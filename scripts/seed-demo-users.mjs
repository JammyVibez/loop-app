#!/usr/bin/env node
/**
 * Seed ~20 demo users with multiple loops each.
 * Usage: node scripts/seed-demo-users.mjs
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const FIRST = ["Ava","Noah","Mia","Leo","Zoe","Kai","Ivy","Ezra","Luna","Omar","Nina","Theo","Aria","Jude","Sia","Rex","Noa","Eli","Vera","Jon"]
const LAST = ["River","Bloom","Stone","Frost","Sky","Lane","Cruz","Vale","Park","West","Cole","Hart","Quinn","Beck","Shaw","Ray","Fox","Dawn","York","Bell"]
const TOPICS = [
  "Shipping loops feels like planting trees 🌳",
  "Branching this idea with the community tonight",
  "Hot take: Circles > group chats",
  "Just dropped a reel — thoughts?",
  "Building in public on Loop hits different",
  "Who else is grinding Co-Loops today?",
  "Design tip: one job per section",
  "Realtime chat in circles is underrated",
  "Theme shopping then posting — aesthetic unlocked",
  "Morning check-in: streak still alive 🔥",
]

function slug(i) {
  return `loopdemo${String(i + 1).padStart(2, "0")}`
}

async function ensureUser(i) {
  const username = slug(i)
  const email = `${username}@loop.demo`
  const password = "DemoPass123!"
  const display = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`

  const { data: existing } = await supabase.from("profiles").select("id, username").eq("username", username).maybeSingle()
  if (existing?.id) return existing

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: display },
  })
  if (error) {
    // Maybe already in auth
    const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    const found = (list.data?.users || []).find((u) => u.email === email)
    if (!found) throw error
    await supabase.from("profiles").upsert({
      id: found.id,
      email,
      username,
      display_name: display,
      bio: `Demo creator #${i + 1} on Loop`,
      loop_coins: 2500,
      onboarding_completed: true,
      is_verified: i % 4 === 0,
      updated_at: new Date().toISOString(),
    })
    return { id: found.id, username }
  }

  await supabase.from("profiles").upsert({
    id: created.user.id,
    email,
    username,
    display_name: display,
    bio: `Demo creator #${i + 1} exploring Circles, Reels, and Co-Loops.`,
    loop_coins: 2500 + i * 50,
    onboarding_completed: true,
    is_verified: i % 4 === 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return { id: created.user.id, username }
}

async function seedPosts(user, index) {
  const count = 3 + (index % 3)
  for (let p = 0; p < count; p++) {
    const content = `${TOPICS[(index + p) % TOPICS.length]} (#${index + 1}.${p + 1})`
    const { data: loop, error } = await supabase
      .from("loops")
      .insert({
        author_id: user.id,
        content,
        content_text: content,
        content_title: content.slice(0, 60),
        hashtags: ["demo", "loop", "community"],
        created_at: new Date(Date.now() - (index * 3600 + p * 600) * 1000).toISOString(),
      })
      .select("id")
      .maybeSingle()

    if (error) {
      console.warn("loop insert failed", user.username, error.message)
      continue
    }
    if (loop?.id) {
      await supabase.from("loop_stats").upsert({
        loop_id: loop.id,
        likes_count: (index + p) % 12,
        comments_count: (index + p) % 5,
        branches_count: (index + p) % 3,
        shares_count: (index + p) % 4,
        views_count: 20 + index * 3 + p,
      })
    }
  }
}

async function main() {
  console.log("Seeding 20 demo users…")
  const users = []
  for (let i = 0; i < 20; i++) {
    const user = await ensureUser(i)
    users.push(user)
    await seedPosts(user, i)
    console.log(`✓ ${user.username}`)
  }

  // Follow graph: each follows next 3
  for (let i = 0; i < users.length; i++) {
    for (let j = 1; j <= 3; j++) {
      const target = users[(i + j) % users.length]
      if (target.id === users[i].id) continue
      await supabase.from("follows").upsert(
        { follower_id: users[i].id, following_id: target.id },
        { onConflict: "follower_id,following_id", ignoreDuplicates: true },
      )
    }
  }

  console.log("Done. Log in as loopdemo01@loop.demo / DemoPass123!")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
