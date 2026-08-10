#!/usr/bin/env node
/**
 * Seed ~20 community users with multiple loops each.
 * Usernames look natural — no "loopdemo" / "demo" markers.
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

const PEOPLE = [
  { first: "Ava", last: "River", username: "avariver", email: "ava.river@mailnest.app" },
  { first: "Noah", last: "Bloom", username: "noahbloom", email: "noah.bloom@mailnest.app" },
  { first: "Mia", last: "Stone", username: "miastone", email: "mia.stone@mailnest.app" },
  { first: "Leo", last: "Frost", username: "leofrost", email: "leo.frost@mailnest.app" },
  { first: "Zoe", last: "Sky", username: "zoesky", email: "zoe.sky@mailnest.app" },
  { first: "Kai", last: "Lane", username: "kailane", email: "kai.lane@mailnest.app" },
  { first: "Ivy", last: "Cruz", username: "ivycruz", email: "ivy.cruz@mailnest.app" },
  { first: "Ezra", last: "Vale", username: "ezravale", email: "ezra.vale@mailnest.app" },
  { first: "Luna", last: "Park", username: "lunapark", email: "luna.park@mailnest.app" },
  { first: "Omar", last: "West", username: "omarwest", email: "omar.west@mailnest.app" },
  { first: "Nina", last: "Cole", username: "ninacole", email: "nina.cole@mailnest.app" },
  { first: "Theo", last: "Hart", username: "theohart", email: "theo.hart@mailnest.app" },
  { first: "Aria", last: "Quinn", username: "ariaquinn", email: "aria.quinn@mailnest.app" },
  { first: "Jude", last: "Beck", username: "judebeck", email: "jude.beck@mailnest.app" },
  { first: "Sia", last: "Shaw", username: "siashaw", email: "sia.shaw@mailnest.app" },
  { first: "Rex", last: "Ray", username: "rexray", email: "rex.ray@mailnest.app" },
  { first: "Noa", last: "Fox", username: "noafox", email: "noa.fox@mailnest.app" },
  { first: "Eli", last: "Dawn", username: "elidawn", email: "eli.dawn@mailnest.app" },
  { first: "Vera", last: "York", username: "verayork", email: "vera.york@mailnest.app" },
  { first: "Jon", last: "Bell", username: "jonbell", email: "jon.bell@mailnest.app" },
]

const BIOS = [
  "Building in public. Circles & late-night loops.",
  "Designer who ships. Always iterating.",
  "Music + code. Dropping reels weekly.",
  "Coffee-first creator. Ask me about Co-Loops.",
  "Exploring themes and community vibes.",
  "Product nerd. Here for the conversation.",
  "Photographer turned looper.",
  "Night owl. Realtime chat enjoyer.",
  "Small wins, daily. Streaks matter.",
  "Just here to share what I’m making.",
]

const TOPICS = [
  "Shipping loops feels like planting trees",
  "Branching this idea with the community tonight",
  "Hot take: Circles beat group chats",
  "Just dropped a reel — thoughts?",
  "Building in public on Loop hits different",
  "Who else is grinding Co-Loops today?",
  "Design tip: one job per section",
  "Realtime chat in circles is underrated",
  "Theme shopping then posting — aesthetic unlocked",
  "Morning check-in: streak still alive",
]

const LEGACY_EMAIL_PREFIX = "loopdemo"
const PASSWORD = "LoopAlive2026!"

function person(i) {
  return PEOPLE[i % PEOPLE.length]
}

async function findLegacyUser(i) {
  const legacyEmail = `${LEGACY_EMAIL_PREFIX}${String(i + 1).padStart(2, "0")}@loop.demo`
  const legacyUsername = `${LEGACY_EMAIL_PREFIX}${String(i + 1).padStart(2, "0")}`
  const { data: byUser } = await supabase.from("profiles").select("id, username, email").eq("username", legacyUsername).maybeSingle()
  if (byUser?.id) return byUser
  const { data: byEmail } = await supabase.from("profiles").select("id, username, email").eq("email", legacyEmail).maybeSingle()
  if (byEmail?.id) return byEmail
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  const authUser = (list.data?.users || []).find((u) => u.email === legacyEmail)
  if (authUser) return { id: authUser.id, username: legacyUsername, email: legacyEmail }
  return null
}

async function ensureUser(i) {
  const p = person(i)
  const display = `${p.first} ${p.last}`
  const bio = BIOS[i % BIOS.length]

  // Prefer existing natural username
  const { data: existingNatural } = await supabase.from("profiles").select("id, username").eq("username", p.username).maybeSingle()
  if (existingNatural?.id) {
    await supabase
      .from("profiles")
      .update({
        display_name: display,
        bio,
        email: p.email,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingNatural.id)
    await supabase.auth.admin.updateUserById(existingNatural.id, {
      email: p.email,
      email_confirm: true,
      password: PASSWORD,
      user_metadata: { username: p.username, display_name: display },
    })
    return { id: existingNatural.id, username: p.username }
  }

  // Rename legacy loopdemo* accounts in place
  const legacy = await findLegacyUser(i)
  if (legacy?.id) {
    await supabase
      .from("profiles")
      .update({
        username: p.username,
        display_name: display,
        email: p.email,
        bio,
        onboarding_completed: true,
        is_verified: i % 4 === 0,
        loop_coins: 2500 + i * 50,
        updated_at: new Date().toISOString(),
      })
      .eq("id", legacy.id)

    await supabase.auth.admin.updateUserById(legacy.id, {
      email: p.email,
      email_confirm: true,
      password: PASSWORD,
      user_metadata: { username: p.username, display_name: display },
    })
    return { id: legacy.id, username: p.username }
  }

  // Fresh create
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: p.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: p.username, display_name: display },
  })
  if (error) {
    const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    const found = (list.data?.users || []).find((u) => u.email === p.email)
    if (!found) throw error
    await supabase.from("profiles").upsert({
      id: found.id,
      email: p.email,
      username: p.username,
      display_name: display,
      bio,
      loop_coins: 2500 + i * 50,
      onboarding_completed: true,
      is_verified: i % 4 === 0,
      updated_at: new Date().toISOString(),
    })
    return { id: found.id, username: p.username }
  }

  await supabase.from("profiles").upsert({
    id: created.user.id,
    email: p.email,
    username: p.username,
    display_name: display,
    bio,
    loop_coins: 2500 + i * 50,
    onboarding_completed: true,
    is_verified: i % 4 === 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return { id: created.user.id, username: p.username }
}

async function seedPosts(user, index) {
  const { count } = await supabase
    .from("loops")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)

  if ((count || 0) >= 3) return

  const target = 3 + (index % 3)
  for (let p = 0; p < target; p++) {
    const content = TOPICS[(index + p) % TOPICS.length]
    const { data: loop, error } = await supabase
      .from("loops")
      .insert({
        author_id: user.id,
        content,
        content_text: content,
        content_title: content.slice(0, 60),
        hashtags: ["community", "loops", "circles"],
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
        likes_count: 2 + ((index + p) % 18),
        comments_count: (index + p) % 7,
        branches_count: (index + p) % 4,
        shares_count: (index + p) % 5,
        views_count: 40 + index * 7 + p * 3,
      })
    }
  }
}

async function scrubLegacyMarkers(userIds) {
  // Soften any leftover posts that still shout "demo"
  for (const id of userIds) {
    const { data: loops } = await supabase.from("loops").select("id, content, hashtags").eq("author_id", id)
    for (const loop of loops || []) {
      const nextContent = String(loop.content || "")
        .replace(/\s*\(#\d+\.\d+\)\s*/g, "")
        .replace(/🌳|🔥/g, "")
        .trim()
      const tags = Array.isArray(loop.hashtags)
        ? loop.hashtags.filter((t) => !/demo/i.test(String(t)))
        : ["community", "loops"]
      if (nextContent !== loop.content || JSON.stringify(tags) !== JSON.stringify(loop.hashtags)) {
        await supabase
          .from("loops")
          .update({
            content: nextContent,
            content_text: nextContent,
            content_title: nextContent.slice(0, 60),
            hashtags: tags.length ? tags : ["community", "loops"],
          })
          .eq("id", loop.id)
      }
    }
  }
}

async function main() {
  console.log("Seeding / renaming 20 community users…")
  const users = []
  for (let i = 0; i < PEOPLE.length; i++) {
    const user = await ensureUser(i)
    users.push(user)
    await seedPosts(user, i)
    console.log(`✓ @${user.username}`)
  }

  await scrubLegacyMarkers(users.map((u) => u.id))

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

  console.log("Done. Example login: ava.river@mailnest.app / LoopAlive2026!")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
