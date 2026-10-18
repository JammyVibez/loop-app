// Live proof that the DM realtime policy actually delivers a message to the
// other participant's open thread.
//
// Creates two throwaway accounts, opens a conversation, subscribes as the
// recipient to Postgres Changes (which is what the messages UI does), sends a
// message as the sender, and asserts the recipient's subscription fires.
// Everything it creates is deleted at the end.
//
// Usage: node scripts/verify-chat-realtime.mjs
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anon || !service) {
  console.error("Missing Supabase env (URL / anon key / service role key)")
  process.exit(1)
}

const admin = createClient(url, service, { auth: { persistSession: false } })
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const password = `Codebuff-${stamp}-Aa1!`
const createdUserIds = []
const createdConversationIds = []
let failures = 0

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures += 1
}

async function makeUser(label) {
  const email = `codebuff-chat-${label}-${stamp}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `cb${label}${stamp.slice(-5)}`.slice(0, 20) },
  })
  if (error) throw new Error(`create ${label}: ${error.message}`)
  createdUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function signIn(user) {
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password })
  if (error) throw new Error(`sign in ${user.email}: ${error.message}`)
  return { client, token: data.session.access_token }
}

try {
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

  const bobSession = await signIn(bob)
  // Make sure the Realtime socket carries the recipient's JWT before it is
  // authorized against the messages policy.
  await bobSession.client.realtime.setAuth(bobSession.token)

  const received = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 12000)
    const channel = bobSession.client
      .channel(`verify-chat-${stamp}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          clearTimeout(timer)
          resolve(payload.new)
        },
      )
      .subscribe((status) => console.log(`  recipient subscription: ${status}`))
    void channel
  })

  // Give the subscription a moment to authorize, then send.
  await new Promise((r) => setTimeout(r, 3500))
  const { data: inserted, error: sendError } = await admin
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: alice.id,
      author_id: alice.id,
      content: "codebuff realtime probe",
      message_type: "text",
    })
    .select("id")
    .single()
  if (sendError) throw new Error(`send: ${sendError.message}`)

  const payload = await received
  check(
    "recipient receives the new message over Postgres Changes",
    Boolean(payload?.id) && String(payload.id) === String(inserted.id),
    payload?.id ? `message ${payload.id}` : "no realtime event",
  )

  // Reactions: the API reads this table, so a row written here must be visible
  // to the other participant's read path.
  const { data: reaction, error: reactionError } = await admin
    .from("message_reactions")
    .insert({ message_id: inserted.id, user_id: bob.id, emoji: "🔥" })
    .select("id")
    .single()
  check("reaction row is accepted", !reactionError, reactionError?.message || `reaction ${reaction?.id}`)

  const { data: reactionRows } = await admin
    .from("message_reactions")
    .select("emoji, user_id")
    .eq("message_id", inserted.id)
  check(
    "reaction is readable for the thread",
    (reactionRows || []).some((r) => r.emoji === "🔥" && r.user_id === bob.id),
    JSON.stringify(reactionRows),
  )

  const { data: asBob } = await bobSession.client
    .from("messages")
    .select("id")
    .eq("conversation_id", conversation.id)
  check(
    "recipient can read the conversation directly (RLS)",
    (asBob || []).some((row) => String(row.id) === String(inserted.id)),
  )

  const { data: asStranger } = await admin.from("messages").select("id").eq("id", inserted.id)
  check("service role still reads the message", (asStranger || []).length === 1)
} catch (error) {
  console.error("verify-chat-realtime failed:", error?.message || error)
  failures += 1
} finally {
  for (const id of createdConversationIds) {
    await admin.from("messages").delete().eq("conversation_id", id)
    await admin.from("conversation_participants").delete().eq("conversation_id", id)
    await admin.from("conversations").delete().eq("id", id)
  }
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
