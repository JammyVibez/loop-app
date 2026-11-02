import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock("@/lib/server-auth", () => ({
  getUserFromRequest: mocks.getUserFromRequest,
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
