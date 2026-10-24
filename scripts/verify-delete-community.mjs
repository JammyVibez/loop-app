/**
 * End-to-end check of community deletion, run against the preview:
 *
 *   1. an owner creates a community and starts a thread inside it (so a bare
 *      row delete would trip over foreign keys);
 *   2. a stranger is refused;
 *   3. the owner deletes the community and it is really gone.
 *
 *   node scripts/verify-delete-community.mjs [baseUrl]
 */
import { randomBytes } from "node:crypto"

const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const tag = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`

const api = (path, token, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(async (res) => ({ status: res.status, data: await res.json().catch(() => ({})) }))

const signup = async (role) => {
  const { status, data } = await api("/api/auth/signup", null, {
    method: "POST",
    body: JSON.stringify({
      email: `qa-del-${role}-${tag}@example.com`,
      password: `Qa-${tag}-${role}-pass1`,
      username: `qadel${role}${tag}`.replace(/[^a-z0-9]/g, "").slice(0, 24),
      display_name: `QA Delete ${role}`,
    }),
  })
  if (status !== 200 || !data?.session?.access_token) {
    throw new Error(`signup ${role}: ${status} ${JSON.stringify(data).slice(0, 200)}`)
  }
  return data.session.access_token
}

let failed = 0
const check = (label, ok, detail = "") => {
  if (ok) console.log(`  ✓ ${label}`)
  else {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`)
  }
}

const main = async () => {
  console.log(`\nDelete community — ${BASE}\n`)

  const owner = await signup("owner")
  const stranger = await signup("stranger")

  const created = await api("/api/communities", owner, {
    method: "POST",
    body: JSON.stringify({ name: `QA Delete ${tag}`, category: "general" }),
  })
  check("community created", created.status === 201 || created.status === 200, `status ${created.status}`)
  const id = created.data?.circle?.id || created.data?.community?.id || created.data?.id
  if (!id) throw new Error(`no circle id in ${JSON.stringify(created.data).slice(0, 200)}`)

  const thread = await api(`/api/communities/${id}/forum`, owner, {
    method: "POST",
    body: JSON.stringify({ title: `Thread before the end ${tag}`, content: "It was a good run." }),
  })
  check("thread created inside it", thread.status === 200 || thread.status === 201, `status ${thread.status}`)

  const denied = await api(`/api/communities/${id}`, stranger, { method: "DELETE" })
  check("stranger is refused", denied.status === 403, `status ${denied.status}`)

  const stillThere = await api(`/api/communities/${id}`, null)
  check("community still alive after the refusal", stillThere.status === 200, `status ${stillThere.status}`)

  const removed = await api(`/api/communities/${id}`, owner, { method: "DELETE" })
  check(
    "owner deletes it",
    removed.status === 200 && removed.data?.success !== false,
    `status ${removed.status} ${JSON.stringify(removed.data).slice(0, 160)}`,
  )

  const gone = await api(`/api/communities/${id}`, null)
  check("community is gone", gone.status !== 200, `status ${gone.status}`)

  console.log(`\n${failed ? `${failed} check(s) FAILED` : "all checks passed"}\n`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`)
  process.exit(1)
})