import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  circleLookup: vi.fn(),
  from: vi.fn(),
  notify: vi.fn(),
}))

vi.mock("@/lib/server-auth", () => ({
  getUserFromRequest: (...args: unknown[]) => state.getUser(...args),
}))
vi.mock("@/lib/notifications", () => ({
  notifyUsers: (...args: unknown[]) => state.notify(...args),
}))
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    rpc: state.rpc,
    from: (...args: unknown[]) => state.from(...args),
  }),
}))

import { POST } from "@/app/api/circles/[id]/join/route"

const userId = "11111111-1111-4111-8111-111111111111"
const circleId = "22222222-2222-4222-8222-222222222222"
const context = { params: Promise.resolve({ id: circleId }) }

function request() {
  return new NextRequest(`https://loopapp.me/api/circles/${circleId}/join`, { method: "POST" })
}

beforeEach(() => {
  state.getUser.mockReset()
  state.rpc.mockReset()
  state.circleLookup.mockReset()
  state.from.mockReset()
  state.notify.mockReset()
  state.getUser.mockResolvedValue({ id: userId })
  state.rpc.mockResolvedValue({
    data: { status: "active", already_member: false, is_private: false, member_id: "member-id" },
    error: null,
  })
  state.circleLookup.mockResolvedValue({
    data: { id: circleId, name: "Example", is_private: false, owner_id: null, creator_id: null },
    error: null,
  })
  state.from.mockImplementation((table: string) => {
    const builder: Record<string, any> = {}
    builder.select = () => builder
    builder.eq = () => builder
    builder.in = () => builder
    builder.maybeSingle = table === "circles"
      ? state.circleLookup
      : vi.fn().mockResolvedValue({ data: null, error: null })
    builder.upsert = vi.fn().mockResolvedValue({ error: null })
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
    return builder
  })
})

describe("Circle join route", () => {
  it("delegates membership, account status and capacity to one RPC", async () => {
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    expect(state.rpc).toHaveBeenCalledWith("join_circle", {
      p_circle_id: circleId,
      p_user_id: userId,
    })
  })

  it("maps a full Circle to a conflict", async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "This Circle has reached its member limit" },
    })
    const response = await POST(request(), context)
    expect(response.status).toBe(409)
  })

  it("does not run post-join effects for existing members", async () => {
    state.rpc.mockResolvedValue({
      data: { status: "active", already_member: true, is_private: false },
      error: null,
    })
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    expect(state.from).toHaveBeenCalledTimes(1)
  })

  it("returns accepted for a private Circle join request", async () => {
    state.rpc.mockResolvedValue({
      data: { status: "pending", already_member: false, is_private: true },
      error: null,
    })
    const response = await POST(request(), context)
    expect(response.status).toBe(202)
    expect(state.notify).toHaveBeenCalledOnce()
  })
})
