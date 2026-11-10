import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("@/lib/server-auth", () => ({
  getUserFromRequest: (...args: unknown[]) => state.getUser(...args),
}))
vi.mock("@/lib/supabase", () => ({
  createServerClient: () => ({ from: state.from, rpc: state.rpc }),
}))

import { POST } from "@/app/api/gifts/manage/route"

const userId = "11111111-1111-4111-8111-111111111111"
const giftId = "987654321"

function request(body: unknown) {
  return new NextRequest("https://loopapp.me/api/gifts/manage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function queryResult(data: unknown, error: unknown = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data, error }),
  }
  return chain
}

function claimedGift(overrides: Record<string, unknown> = {}) {
  return {
    id: giftId,
    recipient_id: userId,
    gift_name: "Pixel Heart",
    gift_type: "badge",
    status: "claimed",
    cost: 250,
    gift_value: {
      coin_conversion: 200,
      delivery_pending: false,
      converted_at: null,
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.getUser.mockResolvedValue({ id: userId })
  state.from.mockImplementation(() => queryResult(claimedGift()))
  state.rpc.mockResolvedValue({
    data: { loop_coins: 1200, converted_coins: 200, already_converted: false },
    error: null,
  })
})

describe("gift conversion route", () => {
  it("converts an accepted gift through the locked RPC using the stored value", async () => {
    const response = await POST(request({ gift_id: giftId, action: "convert" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.converted_coins).toBe(200)
    expect(body.loop_coins).toBe(1200)
    expect(state.rpc).toHaveBeenCalledWith("convert_gift_to_coins", {
      p_user_id: userId,
      p_gift_id: giftId,
      p_coins: 200,
    })
  })

  it("requires authentication before loading or converting a gift", async () => {
    state.getUser.mockResolvedValue(null)
    const response = await POST(request({ gift_id: giftId, action: "convert" }))
    expect(response.status).toBe(401)
    expect(state.from).not.toHaveBeenCalled()
    expect(state.rpc).not.toHaveBeenCalled()
  })

  it("does not convert a gift before it has been accepted", async () => {
    state.from.mockImplementation(() =>
      queryResult(
        claimedGift({
          status: "sent",
          gift_value: { coin_conversion: 200, delivery_pending: true },
        }),
      ),
    )
    const response = await POST(request({ gift_id: giftId, action: "convert" }))
    expect(response.status).toBe(409)
    expect(state.rpc).not.toHaveBeenCalled()
  })

  it("does not convert a coin gift twice", async () => {
    state.from.mockImplementation(() =>
      queryResult(
        claimedGift({
          gift_type: "coins",
          gift_value: { coins_amount: 500, delivery_pending: false },
        }),
      ),
    )
    const response = await POST(request({ gift_id: giftId, action: "convert" }))
    expect(response.status).toBe(409)
    expect(state.rpc).not.toHaveBeenCalled()
  })

  it("maps a missing conversion migration to a safe temporary error", async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code: "42883", message: "function does not exist" },
    })
    const response = await POST(request({ gift_id: giftId, action: "convert" }))
    expect(response.status).toBe(503)
  })
})
