import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

type TableState = {
  /** Simulate a database that never got the reactions schema repair. */
  legacy: boolean
  inserts: Array<{ table: string; row: Record<string, unknown> }>
}

const state = vi.hoisted(() => ({
  user: vi.fn(),
  from: vi.fn(),
  broadcast: vi.fn(),
  legacy: true,
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
}))

vi.mock("@/lib/server-auth", () => ({ getUserFromRequest: state.user }))
vi.mock("@/lib/realtime-server", () => ({ broadcastRealtime: state.broadcast }))
vi.mock("@/lib/supabase", () => ({
  createServerClient: () => ({ from: state.from }),
}))

const missingEmoji = {
  code: "42703",
  message: 'column "emoji" of relation "message_reactions" does not exist',
}
const missingReactions = {
  code: "42703",
  message: 'column "reactions" does not exist',
}

function makeBuilder(table: string) {
  const filters: Record<string, unknown> = {}
  let columns = ""
  const api: Record<string, any> = {}

  const resolveSingle = async () => {
    if (table === "messages") {
      if (columns.includes("reactions")) {
        return state.legacy ? { data: null, error: missingReactions } : { data: { id: "m1", conversation_id: "c1", reactions: [] }, error: null }
      }
      return { data: { id: "m1", conversation_id: "c1" }, error: null }
    }
    if (table === "conversation_participants") return { data: { id: "p1" }, error: null }
    if (table === "message_reactions") {
      return state.legacy ? { data: null, error: missingEmoji } : { data: null, error: null }
    }
    return { data: null, error: null }
  }

  const resolveList = async () => {
    if (table === "message_reactions") {
      if (state.legacy) {
        if (columns.includes("emoji")) return { data: null, error: missingEmoji }
        return { data: [{ reaction_type: "🔥", user_id: "u1" }], error: null }
      }
      return { data: [{ emoji: "🔥", user_id: "u1" }], error: null }
    }
    return { data: null, error: null }
  }

  api.select = (value: string) => {
    columns = value
    return api
  }
  api.eq = (column: string, value: unknown) => {
    filters[column] = value
    return api
  }
  api.is = () => api
  api.order = () => api
  api.update = (row: Record<string, unknown>) => {
    state.inserts.push({ table, row })
    return api
  }
  api.delete = () => api
  api.insert = (row: Record<string, unknown>) => {
    state.inserts.push({ table, row })
    return Promise.resolve({ error: null })
  }
  api.maybeSingle = resolveSingle
  api.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    resolveList().then(resolve, reject)
  return api
}

import { POST } from "@/app/api/messages/reactions/route"

function request(body: Record<string, unknown>) {
  return new NextRequest("https://loopapp.me/api/messages/reactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.legacy = true
  state.inserts = []
  state.user.mockResolvedValue({ id: "u1" })
  state.from.mockImplementation((table: string) => makeBuilder(table))
  state.broadcast.mockResolvedValue(true)
})

describe("DM message reactions", () => {
  it("persists a reaction on the legacy schema instead of returning 500", async () => {
    const response = await POST(request({ message_id: "m1", emoji: "🔥", action: "add" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.reactions).toEqual([{ emoji: "🔥", count: 1, users: ["u1"] }])
    expect(state.inserts.some((entry) => entry.table === "message_reactions" && entry.row.reaction_type === "🔥")).toBe(true)
    expect(state.broadcast).toHaveBeenCalledWith(
      "conversation:c1",
      "reaction",
      expect.objectContaining({ message_id: "m1", emoji: "🔥", user_id: "u1" }),
    )
  })

  it("uses the repaired schema when it is present", async () => {
    state.legacy = false
    const response = await POST(request({ message_id: "m1", emoji: "🔥", action: "add" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.reactions).toEqual([{ emoji: "🔥", count: 1, users: ["u1"] }])
    expect(state.inserts.some((entry) => entry.table === "message_reactions" && entry.row.emoji === "🔥")).toBe(true)
  })

  it("accepts a numeric message id (bigint messages.id) instead of 400ing", async () => {
    const response = await POST(request({ message_id: 12345, emoji: "❤️", action: "add" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.inserts.some((entry) => entry.table === "message_reactions" && String(entry.row.message_id) === "12345")).toBe(true)
  })

  it("rejects a reaction from someone outside the conversation", async () => {
    state.user.mockResolvedValue({ id: "intruder" })
    state.from.mockImplementation((table: string) => {
      const builder = makeBuilder(table)
      if (table === "conversation_participants") {
        builder.maybeSingle = async () => ({ data: null, error: null })
      }
      return builder
    })

    const response = await POST(request({ message_id: "m1", emoji: "🔥", action: "add" }))

    expect(response.status).toBe(403)
  })
})
