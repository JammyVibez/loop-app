/**
 * End-to-end verification for the chat fixes.
 *
 * Creates two throwaway accounts, opens a DM between them through the real
 * HTTP API, sends a message from one side, reads it back as the other,
 * reacts as the other and checks the reaction survives a re-read of the
 * thread. Then does the same for a Co-Loop Studio room (send, history,
 * reaction). Everything it creates is removed at the end.
 *
 * Usage: node scripts/verify-chat-fixes.mjs [base-url]
 *        VERIFY_BASE_URL=https://loopapp.me node scripts/verify-chat-fixes.mjs
 */
import pg from "pg"
import { createClient } from "@supabase/supabase-js"

const base = (process.argv[2] || process.env.VERIFY_BASE_URL || "https://loopapp.me").replace(/\/$/, "")
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!url || !service || !databaseUrl) {
  console.error("Missing Supabase env (URL / service role key / database URL)")
  process.exit(1)
}

const admin = createClient(url, service, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
await db.connect()

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const password = `Codebuff-${stamp}-Aa1!`
const createdUserIds = []
const createdConversationIds = []
const createdSessionIds = []
const coLoopSessionId = `verify-chat-${stamp}`
const liveEvents = []
let listener = null
let failures = 0

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures += 1
}

async function makeUser(label) {
  const email = `codebuff-verify-${label}-${stamp}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `vc${label}${stamp.slice(-5)}`.slice(0, 20) },
  })
  if (error) throw new Error(`create ${label}: ${error.message}`)
  createdUserIds.push(data.user.id)

  // Better Auth owns its own user row (and the API resolves sessions through
  // it), so mirror the account there with the same id as the profile.
  await db.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, NOW(), NOW())`,
    [data.user.id, `Codebuff ${label}`, email],
  )

  // A Better Auth session the API will accept as this user.
  const token = `codebuff-${label}-${stamp}-${Math.random().toString(36).slice(2)}`
  const sessionId = `codebuff-sess-${label}-${stamp}`
  await db.query(
    `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
     VALUES ($1, NOW() + INTERVAL '2 hours', $2, NOW(), NOW(), $3)`,
    [sessionId, token, data.user.id],
  )
  createdSessionIds.push(sessionId)
  return { id: data.user.id, email, token }
}

const api = (path, token, init = {}) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })

try {
  console.log(`Verifying ${base}\n`)
  const alice = await makeUser("a")
  const bob = await makeUser("b")

  const { data: conversation, error: convError } = await admin
    .from("conversations")
    .insert({ is_group: false, created_by: alice.id })
    .select("id")
    .single()
  if (convError) throw new Error(`conversation: ${convError.message}`)
  createdConversationIds.push(conversation.id)

  const { error: partError } = await admin.from("conversation_participants").insert([
    { conversation_id: conversation.id, user_id: alice.id, role: "member" },
    { conversation_id: conversation.id, user_id: bob.id, role: "member" },
  ])
  if (partError) throw new Error(`participants: ${partError.message}`)

  // Listen exactly like an open thread does: anonymous Realtime broadcast on
  // the conversation topic. This is the path that makes a sent message show
  // up on the other device without a reload.
  if (anonKey) {
    listener = createClient(url, anonKey, { auth: { persistSession: false } })
    const channel = listener
      .channel(`conversation:${conversation.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "new_message" }, ({ payload }) => liveEvents.push({ type: "new_message", payload }))
      .on("broadcast", { event: "reaction" }, ({ payload }) => liveEvents.push({ type: "reaction", payload }))
    await new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve()
      })
      setTimeout(resolve, 8000)
    })
  }

  /* ── DM: send as Alice, read as Bob ────────────────────────────── */
  const sendRes = await api("/api/messages", alice.token, {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversation.id, content: "codebuff dm probe", message_type: "text" }),
  })
  const sendData = await sendRes.json().catch(() => ({}))
  check("sender POST /api/messages", sendRes.status === 200 && Boolean(sendData?.message?.id), `status ${sendRes.status}`)
  const messageId = sendData?.message?.id

  await new Promise((r) => setTimeout(r, 1500))
  check(
    "new message is broadcast to the other open thread",
    liveEvents.some((e) => e.type === "new_message" && String(e.payload?.id) === String(messageId)),
  )

  const bobRead = await api(`/api/messages?conversation_id=${conversation.id}`, bob.token)
  const bobData = await bobRead.json().catch(() => ({}))
  const bobMessage = (bobData.messages || []).find((m) => String(m.id) === String(messageId))
  check("recipient sees the message in the thread", Boolean(bobMessage), `status ${bobRead.status}`)

  /* ── DM: react as Bob, re-read as Alice ────────────────────────── */
  const reactRes = await api("/api/messages/reactions", bob.token, {
    method: "POST",
    body: JSON.stringify({ message_id: messageId, emoji: "🔥", action: "add" }),
  })
  const reactData = await reactRes.json().catch(() => ({}))
  const reacted = (reactData.reactions || []).find((r) => r.emoji === "🔥")
  check(
    "reaction saves and returns counts",
    reactRes.status === 200 && reacted?.count === 1,
    `status ${reactRes.status} ${JSON.stringify(reactData.reactions || null)}`,
  )

  await new Promise((r) => setTimeout(r, 1500))
  check(
    "reaction is broadcast live",
    liveEvents.some((e) => e.type === "reaction" && String(e.payload?.message_id) === String(messageId)),
  )

  const aliceRead = await api(`/api/messages?conversation_id=${conversation.id}`, alice.token)
  const aliceData = await aliceRead.json().catch(() => ({}))
  const aliceMessage = (aliceData.messages || []).find((m) => String(m.id) === String(messageId))
  const aliceReaction = (aliceMessage?.reactions || []).find((r) => r.emoji === "🔥")
  check(
    "the other participant reads the reaction back",
    Boolean(aliceReaction) && (aliceReaction.users || []).includes(bob.id),
    JSON.stringify(aliceMessage?.reactions || null),
  )

  const toggleOff = await api("/api/messages/reactions", bob.token, {
    method: "POST",
    body: JSON.stringify({ message_id: messageId, emoji: "🔥", action: "remove" }),
  })
  const toggledOff = await toggleOff.json().catch(() => ({}))
  check(
    "reaction toggles off",
    (toggledOff.reactions || []).length === 0,
    JSON.stringify(toggledOff.reactions || null),
  )

  /* ── Co-Loop Studio chat ───────────────────────────────────────── */
  const sendChat = await api("/api/co-loop/chat", alice.token, {
    method: "POST",
    body: JSON.stringify({ session_id: coLoopSessionId, content: "room probe" }),
  })
  const sendChatData = await sendChat.json().catch(() => ({}))
  check(
    "studio POST stores the message",
    sendChat.status === 200 && Boolean(sendChatData?.message?.id),
    `status ${sendChat.status} ${sendChatData?.error || ""}`,
  )
  const chatMessageId = sendChatData?.message?.id

  const bobHistory = await api(`/api/co-loop/chat?session_id=${encodeURIComponent(coLoopSessionId)}`, bob.token)
  const bobHistoryData = await bobHistory.json().catch(() => ({}))
  check(
    "co-author sees the message in room history",
    (bobHistoryData.messages || []).some((m) => String(m.id) === String(chatMessageId)),
    `status ${bobHistory.status}`,
  )

  const reactChat = await api("/api/co-loop/chat", bob.token, {
    method: "PATCH",
    body: JSON.stringify({ message_id: chatMessageId, emoji: "🎉" }),
  })
  const reactChatData = await reactChat.json().catch(() => ({}))
  check(
    "studio reaction saves",
    reactChat.status === 200 && (reactChatData.reactions?.["🎉"] || []).includes(bob.id),
    `status ${reactChat.status} ${JSON.stringify(reactChatData.reactions || null)}`,
  )

  const aliceHistory = await api(`/api/co-loop/chat?session_id=${encodeURIComponent(coLoopSessionId)}`, alice.token)
  const aliceHistoryData = await aliceHistory.json().catch(() => ({}))
  const stored = (aliceHistoryData.messages || []).find((m) => String(m.id) === String(chatMessageId))
  check(
    "studio reaction is readable by everyone in the room",
    (stored?.reactions?.["🎉"] || []).includes(bob.id),
    JSON.stringify(stored?.reactions || null),
  )

  /* ── Unauthenticated writes are refused ────────────────────────── */
  const anonChat = await api("/api/co-loop/chat", null, {
    method: "POST",
    body: JSON.stringify({ session_id: coLoopSessionId, content: "nope" }),
  })
  check("studio chat POST without a session is refused", anonChat.status === 401, `status ${anonChat.status}`)

  const anonReaction = await api("/api/messages/reactions", null, {
    method: "POST",
    body: JSON.stringify({ message_id: messageId, emoji: "🔥" }),
  })
  check("DM reaction without a session is refused", anonReaction.status === 401, `status ${anonReaction.status}`)
} catch (error) {
  console.error("verify-chat-fixes failed:", error?.message || error)
  failures += 1
} finally {
  for (const id of createdConversationIds) {
    const { data: rows } = await admin.from("messages").select("id").eq("conversation_id", id)
    const ids = (rows || []).map((r) => r.id)
    if (ids.length) await admin.from("message_reactions").delete().in("message_id", ids)
    await admin.from("messages").delete().eq("conversation_id", id)
    await admin.from("conversation_participants").delete().eq("conversation_id", id)
    await admin.from("conversations").delete().eq("id", id)
  }
  await admin.from("co_loop_chat_messages").delete().eq("session_id", coLoopSessionId)
  if (createdSessionIds.length) {
    await db.query(`DELETE FROM session WHERE id = ANY($1::text[])`, [createdSessionIds])
  }
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  if (listener) {
    try {
      await listener.removeAllChannels()
    } catch {
      /* ignore */
    }
  }
  await db.end().catch(() => {})
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
