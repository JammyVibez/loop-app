import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock("@/lib/server-auth", () => ({
  getUserFromRequest: mocks.getUserFromRequest,
}))

vi.mock("@/lib/circle-access", () => ({
  checkCirclePrivateAccess: vi.fn(async () => ({ isPrivate: false, canView: true })),
}))

vi.mock("@/lib/supabase", () => ({
  createClient: mocks.createClient,
}))

beforeEach(() => {
  mocks.getUserFromRequest.mockReset()
  mocks.getUserFromRequest.mockResolvedValue(null)
  mocks.createClient.mockReset()
  mocks.createClient.mockImplementation(() => {
    throw new Error("Database client must not be created before authentication")
  })
})

describe("Circle event write routes", () => {
  it("rejects an unauthenticated event creation before creating a database client", async () => {
    const { POST } = await import("@/app/api/circles/[id]/events/route")
    const response = await POST(
      new NextRequest("https://loopapp.me/api/circles/circle-1/events", {
        method: "POST",
        body: JSON.stringify({ title: "An event" }),
      }),
      { params: Promise.resolve({ id: "circle-1" }) },
    )

    expect(response.status).toBe(401)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated RSVP before creating a database client", async () => {
    const { POST } = await import("@/app/api/circles/[id]/events/[eventId]/participants/route")
    const response = await POST(
      new NextRequest("https://loopapp.me/api/circles/circle-1/events/event-1/participants", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "circle-1", eventId: "event-1" }) },
    )

    expect(response.status).toBe(401)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated RSVP moderation before creating a database client", async () => {
    const { PATCH } = await import("@/app/api/circles/[id]/events/[eventId]/participants/route")
    const response = await PATCH(
      new NextRequest("https://loopapp.me/api/circles/circle-1/events/event-1/participants", {
        method: "PATCH",
        body: JSON.stringify({ user_id: "user-2", action: "approve" }),
      }),
      { params: Promise.resolve({ id: "circle-1", eventId: "event-1" }) },
    )

    expect(response.status).toBe(401)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
})


describe("Circle event RSVP database contract", () => {
  const actorId = "11111111-1111-4111-8111-111111111111"
  const eventId = "22222222-2222-4222-8222-222222222222"

  function configureAuthenticatedMember(options: {
    requiresApproval?: boolean
    member?: boolean
  } = {}) {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: options.requiresApproval ? "pending" : "attending", participant_count: 1 },
      error: null,
    })
    const builder = (result: unknown) => {
      const query: Record<string, any> = {}
      query.select = () => query
      query.eq = () => query
      query.in = () => query
      query.maybeSingle = async () => result
      return query
    }

    mocks.getUserFromRequest.mockResolvedValue({ id: actorId })
    mocks.createClient.mockReturnValue({
      rpc,
      from: (table: string) => {
        if (table === "circle_members") {
          return builder(options.member === false ? null : { id: "membership-1" })
        }
        if (table === "circle_events") {
          return builder({
            id: eventId,
            ends_at: "2026-11-03T12:00:00.000Z",
            requires_approval: options.requiresApproval === true,
          })
        }
        return builder(null)
      },
    })
    return rpc
  }

  it("passes the signed-in member as the actor for a direct attendance RSVP", async () => {
    const rpc = configureAuthenticatedMember()
    const { POST } = await import("@/app/api/circles/[id]/events/[eventId]/participants/route")
    const response = await POST(
      new NextRequest("https://loopapp.me/api/circles/circle-1/events/event-1/participants", { method: "POST" }),
      { params: Promise.resolve({ id: "circle-1", eventId }) },
    )

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith("set_circle_event_rsvp_authorized", {
      p_event_id: eventId,
      p_user_id: actorId,
      p_actor_id: actorId,
      p_status: "attending",
    })
  })

  it("sends approval-required RSVPs to the same authorized transaction as pending", async () => {
    const rpc = configureAuthenticatedMember({ requiresApproval: true })
    const { POST } = await import("@/app/api/circles/[id]/events/[eventId]/participants/route")
    const response = await POST(
      new NextRequest("https://loopapp.me/api/circles/circle-1/events/event-1/participants", { method: "POST" }),
      { params: Promise.resolve({ id: "circle-1", eventId }) },
    )

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith("set_circle_event_rsvp_authorized", expect.objectContaining({
      p_user_id: actorId,
      p_actor_id: actorId,
      p_status: "pending",
    }))
  })

  it("does not reach the RSVP RPC after Circle membership has been revoked", async () => {
    const rpc = configureAuthenticatedMember({ member: false })
    const { POST } = await import("@/app/api/circles/[id]/events/[eventId]/participants/route")
    const response = await POST(
      new NextRequest("https://loopapp.me/api/circles/circle-1/events/event-1/participants", { method: "POST" }),
      { params: Promise.resolve({ id: "circle-1", eventId }) },
    )

    expect(response.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })
})
