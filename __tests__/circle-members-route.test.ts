import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({
  user: vi.fn(),
  createServerClient: vi.fn(),
  checkAccess: vi.fn(),
}))

vi.mock("@/lib/server-auth", () => ({ getUserFromRequest: state.user }))
vi.mock("@/lib/supabase", () => ({ createServerClient: state.createServerClient }))
vi.mock("@/lib/circle-access", () => ({ checkCirclePrivateAccess: state.checkAccess }))
vi.mock("@/lib/circle-lifecycle", () => ({ syncCircleMemberCount: vi.fn() }))

import { DELETE, GET, PUT } from "@/app/api/circles/[id]/members/route"

const params = { params: Promise.resolve({ id: "circle-1" }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
  state.user.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" })
  state.createServerClient.mockImplementation(() => {
    throw new Error("A database client must not be created without the service role key")
  })
  state.checkAccess.mockResolvedValue({ isPrivate: false, canView: true })
})

describe("Circle member service boundary", () => {
  it("fails closed for public roster reads when the service key is missing", async () => {
    const response = await GET(new NextRequest("https://loopapp.me/api/circles/circle-1/members"), params)
    expect(response.status).toBe(503)
    expect(state.createServerClient).not.toHaveBeenCalled()
    expect(state.checkAccess).not.toHaveBeenCalled()
  })

  it("authenticates role changes before checking the privileged database client", async () => {
    state.user.mockResolvedValue(null)
    const response = await PUT(new NextRequest("https://loopapp.me/api/circles/circle-1/members", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: "22222222-2222-4222-8222-222222222222", newRole: "moderator" }),
    }), params)

    expect(response.status).toBe(401)
    expect(state.createServerClient).not.toHaveBeenCalled()
  })

  it("fails closed for authenticated role changes when the service key is missing", async () => {
    const response = await PUT(new NextRequest("https://loopapp.me/api/circles/circle-1/members", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: "22222222-2222-4222-8222-222222222222", newRole: "moderator" }),
    }), params)

    expect(response.status).toBe(503)
    expect(state.createServerClient).not.toHaveBeenCalled()
  })

  it("fails closed for member removals and bans when the service key is missing", async () => {
    const response = await DELETE(new NextRequest("https://loopapp.me/api/circles/circle-1/members?userId=22222222-2222-4222-8222-222222222222", {
      method: "DELETE",
    }), params)

    expect(response.status).toBe(503)
    expect(state.createServerClient).not.toHaveBeenCalled()
  })

  it("does not expose wallet or account-activity data in public member rosters", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    let selection = ""
    const query: Record<string, any> = {}
    query.select = (value: string) => { selection = value; return query }
    query.eq = () => query
    query.in = () => query
    query.order = () => query
    query.range = () => query
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
    state.createServerClient.mockReturnValue({ from: () => query })
    const response = await GET(new NextRequest("https://loopapp.me/api/circles/circle-1/members"), params)

    expect(response.status).toBe(200)
    expect(selection).toContain("user:profiles(id, username, display_name, avatar_url, video_avatar_url, is_verified)")
    expect(selection).not.toContain("*")
    expect(selection).not.toContain("loop_coins")
    expect(selection).not.toContain("last_active")
    expect(selection).not.toContain("is_premium")
  })
})
