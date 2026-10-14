#!/usr/bin/env node
/**
 * Check every share card the app can produce.
 *
 * Each quiet template gets a representative query, then the script asserts the
 * response is a real 1200x630 PNG (not a Cloudflare error page that happens to
 * be served with a 200, and not a zero-byte file). Exits non-zero on failure so
 * it can run in CI or in a post-deploy hook.
 *
 * Usage:
 *   node scripts/check-og.mjs                       # against https://loopapp.me
 *   node scripts/check-og.mjs http://127.0.0.1:3000 # against a local server
 *   BASE_URL=... npm run check:og
 */

const BASE = (process.argv[2] || process.env.BASE_URL || "https://loopapp.me").replace(/\/$/, "")

const CASES = [
  ["home", { type: "home", title: "Loop — Build Together, Not Just Post Into The Void", description: "The collaborative social network where you co-write posts live with friends." }],
  ["post", { type: "post", name: "Real", username: "real_io", body: "Ship the thing, then tell everyone about it.", stat: "445", stat_label: "likes", date: "Jul 2, 2026", verified: "true" }],
  ["post/code", { type: "developer", title: "satori-layout-rules", description: "Every div with two children needs display: flex.", category: "TypeScript", stat: "128", stat_label: "stars" }],
  ["profile", { type: "profile", name: "Real", username: "real_io", description: "I'm fresh and soft.", stat: "57", stat_label: "followers", verified: "true" }],
  ["profile/badge", { type: "profile", name: "Real", username: "real_io", stat: "12", stat_label: "loops", premium: "true", badge_colors: "#FF0000|#00FF00" }],
  ["community", { type: "community", name: "Loop Builders", description: "A community for people shipping on Loop.", category: "Gaming", stat: "1204", stat_label: "members" }],
  ["community/private", { type: "community", name: "Secret", description: "Members only.", is_private: "true" }],
  ["space", { type: "space", name: "Design Space", description: "Weekly critique and critique requests.", category: "Design" }],
  ["duel", { type: "duel", title: "Tabs or spaces — settle it publicly", side1: "Ada|", side2: "Grace|", date: "Live now" }],
  ["coloop", { type: "coloop", title: "Co-writing the launch post together", people: "Ada|,Grace|,Linus|", date: "Open invite" }],
  ["reel", { type: "reel", name: "Real", username: "real_io", body: "30 seconds of the studio build.", stat: "812", stat_label: "views" }],
  ["reel/nomedia", { type: "reel", name: "Real", body: "A caption with no artwork attached." }],
  ["project", { type: "project", title: "loop-app", description: "The collaborative social network.", stats: "128|stars,14|forks", category: "TypeScript" }],
  ["event", { type: "event", title: "Founder office hours", description: "Bring your roadmap, leave with feedback.", date_day: "9", date_month: "Mar", category: "Community", stat: "42", stat_label: "going" }],
  ["challenge", { type: "challenge", title: "Ship 30 days in a row", description: "Post something every day for a month.", progress: "57|100|Days shipped" }],
  ["fallback", { type: "fallback", title: "Something went missing", description: "This page is not available." }],
]

async function inspect(label, query) {
  const url = `${BASE}/api/og?${new URLSearchParams(query)}`
  try {
    const response = await fetch(url, { headers: { "user-agent": "loop-og-check" } })
    const body = Buffer.from(await response.arrayBuffer())
    const isPng = body.length > 24 && body[0] === 0x89 && body.toString("latin1", 1, 4) === "PNG"
    const width = isPng ? body.readUInt32BE(16) : 0
    const height = isPng ? body.readUInt32BE(20) : 0
    const ok = response.status === 200 && isPng && width === 1200 && height === 630
    return { label, url, ok, status: response.status, width, height, bytes: body.length, type: (response.headers.get("content-type") || "").split(";")[0], snippet: ok ? "" : body.toString("utf8").replace(/\s+/g, " ").slice(0, 160) }
  } catch (error) {
    return { label, url, ok: false, status: "ERR", width: 0, height: 0, bytes: 0, type: "-", snippet: error.message }
  }
}

const results = await Promise.all(CASES.map(([label, query]) => inspect(label, query)))
for (const r of results) {
  console.log(`${r.ok ? "OK  " : "BAD "} ${r.label.padEnd(18)} ${String(r.status).padEnd(4)} ${r.type.padEnd(10)} ${r.width}x${r.height} ${r.bytes}b`)
  if (!r.ok) {
    console.log(`      ${r.url}`)
    if (r.snippet) console.log(`      ${r.snippet}`)
  }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} cards OK — ${BASE}`)
if (failed.length) {
  console.log("Failing cards:")
  failed.forEach((r) => console.log(`  ${r.label}: ${r.url}`))
  process.exitCode = 1
}
