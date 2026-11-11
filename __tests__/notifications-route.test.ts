import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({
  user: vi.fn(),
  from: vi.fn(),
  profile: { notification_settings: { theme: "dark", muted_types: ["likes"] } } as Record<string, any>,
  queryRows: [] as any[],
  queries: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
  count: 3 as number | null,
}))

vi.mock("@/lib/server-auth", () => ({ getUserFromRequest: state.user }))
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: (table: string) => {
    const calls: Array<[string, unknown[]]> = []
    state.queries.push({ table, calls })
    const builder: Record<string, any> = {}
    for (const method of ["select", "eq", "order", "range", "in", "update", "delete"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, args])
        if (method === "update" && table === "profiles") state.profile = args[0] as any
        return builder
      }
    }
    builder.maybeSingle = async () => ({ data: state.profile, error: null })
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const result = table === "notifications"
        ? { data: state.queryRows, count: state.count, error: null }
        : { data: null, error: null }
      return Promise.resolve(result).then(resolve, reject)
    }
    return builder
  } }),
}))

import { GET, PATCH } from "@/app/api/notifications/route"

beforeEach(() => {
  vi.clearAllMocks()
  state.user.mockResolvedValue({ id: "viewer-id" })
  state.profile = { notification_settings: { theme: "dark", muted_types: ["likes"] } }
  state.queryRows = []
  state.queries = []
  state.count = 3
})

describe("notifications API filters and read state", () => {
  it("applies saved mute settings and returns the exact unread total", async () => {
    state.queryRows = [
      {
        id: "follow-1",
        user_id: "viewer-id",
        actor_id: "actor-id",
        type: "follow",
        title: "New follow",
        message: "Followed you",
        data: {},
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: "like-1",
        user_id: "viewer-id",
        actor_id: "actor-id",
        type: "like",
        title: "New like",
        message: "Liked your post",
        data: { loop_id: "loop-id" },
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]
    const response = await GET(new NextRequest("https://loopapp.me/api/notifications?limit=40"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.notifications.map((item: any) => item.id)).toEqual(["follow-1"])
    expect(body.unread_count).toBe(3)
    expect(body.muted_types).toEqual(["likes"])
    expect(state.queries.some((query) => query.table === "notifications" && query.calls.some(([method, args]) => method === "eq" && args[0] === "user_id"))).toBe(true)
  })

  it("preserves existing settings when saving notification mutes", async () => {
    const response = await PATCH(new NextRequest("https://loopapp.me/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ muted_types: ["replies", "replies", " "] }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.muted_types).toEqual(["replies"])
    expect(state.profile.notification_settings).toEqual({ theme: "dark", muted_types: ["replies"] })
  })

  it("marks only the authenticated user's requested notifications as read", async () => {
    const response = await PATCH(new NextRequest("https://loopapp.me/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notification_ids: ["one", "two"] }),
    }))
    const update = state.queries.find((query) => query.table === "notifications")

    expect(response.status).toBe(200)
    expect(update?.calls).toContainEqual(["eq", ["user_id", "viewer-id"]])
    expect(update?.calls).toContainEqual(["in", ["id", ["one", "two"]]])
  })
})
