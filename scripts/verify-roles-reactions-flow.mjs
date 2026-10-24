/**
 * End-to-end check of the community roles + Discord-style comment work, run
 * against the preview:
 *
 *   1. owner creates a community, opens the roles panel (seeds starter Powers),
 *      creates a custom role, gates thread creation onto that role;
 *   2. owner starts a thread, replies, reacts, reads the thread back — role
 *      chips and grouped reactions come back;
 *   3. a second account joins (must receive the default Power), is blocked from
 *      starting a thread by the policy, gets the custom role, and can then
 *      start one;
 *   4. everything it created is removed (community deleted, both throwaway
 *      accounts scheduled for deletion) unless --keep is passed.
 *
 *   node scripts/verify-roles-reactions-flow.mjs [baseUrl]
 */
import { randomBytes } from "node:crypto"

const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const KEEP = process.argv.includes("--keep")
const tag = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`

let failures = 0
const check = (label, ok, detail = "") => {
  if (ok) console.log(`  ✓ ${label}`)
  else {
    failures += 1
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`)
  }
}

const api = (path, token, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  }).then(async (res) => ({ status: res.status, data: await res.json().catch(() => ({})) }))

async function signup(role) {
  const email = `qa-${role}-${tag}@example.com`
  const username = `qa${role}${tag}`.replace(/[^a-z0-9]/g, "").slice(0, 24)
  const { status, data } = await api("/api/auth/signup", null, {
    method: "POST",
    body: JSON.stringify({
      email,
      password: `Qa-${tag}-${role}-pass1`,
      username,
      display_name: `QA ${role} ${tag}`,
    }),
  })
  if (status !== 200 || !data?.session?.access_token) {
    throw new Error(`signup ${role} failed: ${status} ${JSON.stringify(data).slice(0, 200)}`)
  }
  return { token: data.session.access_token, id: data.session.user?.id, username, email }
}

const main = async () => {
  console.log(`\nCommunity roles + comment reactions — ${BASE}\n`)

  const owner = await signup("owner")
  const joiner = await signup("joiner")
  let circleId = null

  try {
    /* ── 1. community + roles ── */
    console.log("1. community, Powers, thread policy")
    const created = await api("/api/communities", owner.token, {
      method: "POST",
      body: JSON.stringify({ name: `QA Roles ${tag}`, category: "general" }),
    })
    check("community created", created.status === 201 || created.status === 200, `status ${created.status}`)
    circleId = created.data?.circle?.id || created.data?.community?.id || created.data?.id
    if (!circleId) throw new Error(`no circle id in ${JSON.stringify(created.data).slice(0, 200)}`)

    const seeded = await api(`/api/communities/${circleId}/roles`, owner.token)
    check("roles panel seeds starter Powers", (seeded.data?.roles || []).length >= 1)
    const defaultRole = (seeded.data?.roles || []).find((r) => r.is_default)
    check("a default (on-join) Power exists", Boolean(defaultRole))
    check("policy defaults to members", seeded.data?.thread_creation?.mode === "members")

    const made = await api(`/api/communities/${circleId}/roles`, owner.token, {
      method: "POST",
      body: JSON.stringify({
        name: `Editors ${tag}`.slice(0, 32),
        description: "May open threads in QA",
        color: "#14b8a6",
        icon: "hammer",
        permissions: ["post.create", "thread.create", "chat.send"],
      }),
    })
    check("custom role created", made.status === 201, `status ${made.status} ${JSON.stringify(made.data)}`)
    const editorId = made.data?.role?.id
    check("role carries its permissions", (made.data?.role?.permissions || []).includes("thread.create"))

    const policy = await api(`/api/communities/${circleId}/roles`, owner.token, {
      method: "PATCH",
      body: JSON.stringify({ thread_creation: { mode: "roles", roles: [editorId] } }),
    })
    check(
      "thread policy saved",
      policy.status === 200 && policy.data?.thread_creation?.mode === "roles",
      `status ${policy.status} ${JSON.stringify(policy.data)}`,
    )

    /* ── 2. thread, reply, reaction ── */
    console.log("2. thread, reply, reactions, role chips")
    const thread = await api(`/api/communities/${circleId}/forum`, owner.token, {
      method: "POST",
      body: JSON.stringify({ title: `QA thread ${tag}`, content: "Hello from the QA script." }),
    })
    check("owner (staff) starts a thread", thread.status === 200, `status ${thread.status} ${JSON.stringify(thread.data)}`)
    const threadId = thread.data?.thread?.id
    if (!threadId) throw new Error("no thread id")

    const reply = await api(`/api/communities/${circleId}/threads/${threadId}`, owner.token, {
      method: "POST",
      body: JSON.stringify({ content: "First reply, ready for a reaction." }),
    })
    check("reply posted", reply.status === 200, `status ${reply.status} ${JSON.stringify(reply.data)}`)
    const replyId = reply.data?.reply?.id
    check("reply carries a role chip", reply.data?.reply?.author?.role_badge?.name === "Owner")

    const reacted = await api(`/api/communities/${circleId}/threads/${threadId}/reactions`, owner.token, {
      method: "POST",
      body: JSON.stringify({ comment_id: replyId, emoji: "🔥" }),
    })
    check(
      "reaction saved",
      reacted.status === 200 && reacted.data?.reacted === true && (reacted.data?.reactions || [])[0]?.count === 1,
      `status ${reacted.status} ${JSON.stringify(reacted.data)}`,
    )

    const toggled = await api(`/api/communities/${circleId}/threads/${threadId}/reactions`, owner.token, {
      method: "POST",
      body: JSON.stringify({ comment_id: replyId, emoji: "🔥" }),
    })
    check(
      "reaction toggles off",
      toggled.status === 200 && toggled.data?.reacted === false && (toggled.data?.reactions || []).length === 0,
      `status ${toggled.status} ${JSON.stringify(toggled.data)}`,
    )

    const reread = await api(`/api/communities/${circleId}/threads/${threadId}`, owner.token)
    const loaded = (reread.data?.replies || []).find((r) => String(r.id) === String(replyId))
    check("thread read returns the reply", Boolean(loaded))
    check("reply reactions render grouped", Array.isArray(loaded?.reactions))
    check("reply author chip on read-back", loaded?.author?.role_badge?.name === "Owner")
    check("thread author chip", reread.data?.thread?.author?.role_badge?.name === "Owner")

    const badReaction = await api(`/api/communities/${circleId}/threads/${threadId}/reactions`, owner.token, {
      method: "POST",
      body: JSON.stringify({ comment_id: 9_999_999_999, emoji: "🔥" }),
    })
    check("unknown comment is rejected", badReaction.status === 404, `status ${badReaction.status}`)

    /* ── 3. joiner: default Power + policy gate ── */
    console.log("3. second account joins and hits the thread policy")
    const joined = await api(`/api/circles/${circleId}/join`, joiner.token, { method: "POST" })
    check("join succeeded", joined.status === 200 && joined.data?.status === "active", JSON.stringify(joined.data))

    const asOwner = await api(`/api/communities/${circleId}/roles`, owner.token)
    const assigned = asOwner.data?.by_user?.[joiner.id] || []
    check("new member received the default Power", assigned.includes(defaultRole?.id), JSON.stringify(assigned))

    const gated = await api(`/api/communities/${circleId}/forum`, joiner.token, {
      method: "POST",
      body: JSON.stringify({ title: `QA gated ${tag}`, content: "Should be blocked." }),
    })
    check("member without the role is blocked", gated.status === 403, `status ${gated.status}`)

    const forumAsMember = await api(`/api/communities/${circleId}/forum`, joiner.token)
    check("member sees can_create=false", forumAsMember.data?.viewer?.can_create === false)

    const granted = await api(`/api/communities/${circleId}/roles/assign`, owner.token, {
      method: "POST",
      body: JSON.stringify({ user_id: joiner.id, role_id: editorId }),
    })
    check("role assigned to member", granted.status === 200, `status ${granted.status}`)

    const allowed = await api(`/api/communities/${circleId}/forum`, joiner.token, {
      method: "POST",
      body: JSON.stringify({ title: `QA allowed ${tag}`, content: "Now allowed." }),
    })
    check("member with the role can start a thread", allowed.status === 200, `status ${allowed.status} ${JSON.stringify(allowed.data)}`)

    const forumAgain = await api(`/api/communities/${circleId}/forum`, joiner.token)
    check("member sees can_create=true", forumAgain.data?.viewer?.can_create === true)

    /* ── 4. unauthenticated reads still work ── */
    console.log("4. public reads")
    const anonForum = await api(`/api/communities/${circleId}/forum`)
    check("guest can read the forum", anonForum.status === 200)
    check("guest cannot create", anonForum.data?.viewer?.can_create === false)
    const anonThread = await api(`/api/communities/${circleId}/threads/${threadId}`)
    check("guest can read the thread", anonThread.status === 200)
    const anonReact = await api(`/api/communities/${circleId}/threads/${threadId}/reactions`, null, {
      method: "POST",
      body: JSON.stringify({ comment_id: replyId, emoji: "🔥" }),
    })
    check("guest cannot react", anonReact.status === 401, `status ${anonReact.status}`)
  } finally {
    if (!KEEP && circleId) {
      const del = await api(`/api/communities/${circleId}`, owner.token, { method: "DELETE" })
      console.log(`\ncleanup: community delete → ${del.status}`)
      for (const [label, who] of [
        ["owner", owner],
        ["joiner", joiner],
      ]) {
        const r = await api("/api/users/delete-account", who.token, { method: "POST" })
        console.log(`cleanup: ${label} deletion scheduled → ${r.status}`)
      }
    }
  }

  console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nAll checks passed\n")
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error("\nFATAL:", e.message || e)
  process.exit(1)
})
