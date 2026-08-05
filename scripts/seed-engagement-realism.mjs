// Follow-up to seed-user-realism.mjs: the seed loops' likes_count/comments_count
// were decorative numbers with almost no backing rows in loop_interactions /
// comments (e.g. displayed ~140 combined likes across 79 posts, only 12 real
// loop_interactions rows existed; comments_count summed to dozens, only 2 real
// comment rows existed). That's exactly the kind of fake engagement the
// product is supposed to have moved away from. This backs each seed loop's
// stats with real rows from the existing user pool, then reconciles the
// displayed counts to match reality exactly.
//
// Usage: node scripts/seed-engagement-realism.mjs

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const SEED_USERNAMES = [
  "avariver", "ninacole", "noahbloom", "theohart", "miastone", "ariaquinn",
  "leofrost", "judebeck", "zoesky", "siashaw", "kailane", "rexray",
  "ivycruz", "noafox", "ezravale", "elidawn", "lunapark", "verayork",
  "omarwest", "jonbell",
]

const COMMENT_BANK = [
  "This is way too real.",
  "Needed to read this today, thank you.",
  "Okay but the specific detail here is what got me.",
  "Same energy, honestly.",
  "Following for updates on this!",
  "Can relate more than I'd like to admit.",
  "This is a great point, hadn't thought of it that way.",
  "Screenshotting this for later.",
  "The way you put this into words \u2014 exactly.",
  "Wait this is actually really helpful, thanks for sharing.",
  "Love seeing the process, not just the finished thing.",
  "Honestly the most relatable post I've seen this week.",
  "More people need to talk about this.",
  "This tracks with what I've been seeing too.",
  "Good reminder, saving this.",
  "The specificity here is what makes it land.",
  "Real question: how long did that take you?",
  "This is why I keep coming back to this app.",
]

function pickRandomDistinct(pool, n) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, shuffled.length))
}

async function main() {
  const { data: allProfiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, username")
  if (profilesErr) throw profilesErr

  const idByUsername = new Map(allProfiles.map((p) => [p.username, p.id]))
  const seedUserIds = new Set(SEED_USERNAMES.map((u) => idByUsername.get(u)).filter(Boolean))
  const allUserIds = allProfiles.map((p) => p.id)

  const { data: loops, error: loopsErr } = await supabase
    .from("loops")
    .select("id, author_id, loop_stats(likes_count, comments_count)")
    .in("author_id", Array.from(seedUserIds))
  if (loopsErr) throw loopsErr

  let likesInserted = 0
  let commentsInserted = 0
  let statsReconciled = 0

  for (const loop of loops || []) {
    const stats = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats
    const targetLikes = Math.min(Number(stats?.likes_count || 0), 14)
    const targetComments = Math.min(Number(stats?.comments_count || 0), 4)

    const candidatePool = allUserIds.filter((id) => id !== loop.author_id)

    // Likes — real loop_interactions rows.
    const { data: existingLikes } = await supabase
      .from("loop_interactions")
      .select("user_id")
      .eq("loop_id", loop.id)
      .eq("interaction_type", "like")
    const existingLikerIds = new Set((existingLikes || []).map((r) => r.user_id))
    const stillNeeded = Math.max(0, targetLikes - existingLikerIds.size)
    if (stillNeeded > 0) {
      const eligible = candidatePool.filter((id) => !existingLikerIds.has(id))
      const chosen = pickRandomDistinct(eligible, stillNeeded)
      if (chosen.length) {
        const { error } = await supabase.from("loop_interactions").insert(
          chosen.map((user_id) => ({ user_id, loop_id: loop.id, interaction_type: "like" })),
        )
        if (error && !/duplicate|unique/i.test(error.message || "")) {
          console.warn(`[likes] loop ${loop.id}:`, error.message)
        } else {
          likesInserted += chosen.length
        }
      }
    }

    // Comments — real rows with actual text.
    const { data: existingComments } = await supabase
      .from("comments")
      .select("id, author_id")
      .eq("loop_id", loop.id)
    const existingCommenterIds = new Set((existingComments || []).map((r) => r.author_id))
    const commentsStillNeeded = Math.max(0, targetComments - (existingComments || []).length)
    if (commentsStillNeeded > 0) {
      const eligible = candidatePool.filter((id) => !existingCommenterIds.has(id))
      const chosen = pickRandomDistinct(eligible, commentsStillNeeded)
      const texts = pickRandomDistinct(COMMENT_BANK, chosen.length)
      if (chosen.length) {
        const rows = chosen.map((author_id, i) => ({
          loop_id: loop.id,
          author_id,
          content: texts[i] || COMMENT_BANK[0],
        }))
        const { error } = await supabase.from("comments").insert(rows)
        if (error) {
          console.warn(`[comments] loop ${loop.id}:`, error.message)
        } else {
          commentsInserted += rows.length
        }
      }
    }

    // Reconcile displayed stats to match exactly what's real now.
    const { count: finalLikes } = await supabase
      .from("loop_interactions")
      .select("id", { count: "exact", head: true })
      .eq("loop_id", loop.id)
      .eq("interaction_type", "like")
    const { count: finalComments } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("loop_id", loop.id)

    const { error: statsErr } = await supabase
      .from("loop_stats")
      .update({ likes_count: finalLikes || 0, comments_count: finalComments || 0 })
      .eq("loop_id", loop.id)
    if (statsErr) {
      console.warn(`[stats] loop ${loop.id}:`, statsErr.message)
    } else {
      statsReconciled += 1
    }
  }

  console.log(`Done. likes inserted: ${likesInserted}, comments inserted: ${commentsInserted}, stats reconciled: ${statsReconciled}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
