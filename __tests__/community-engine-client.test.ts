import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ createClient: state.createClient }))

import { communityClient, listCommunitiesForDiscovery } from "@/lib/community-engine"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://loop.example.supabase.co")
  vi.stubEnv("SUPABASE_URL", "")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key")
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
})

describe("community discovery", () => {
  it("excludes already-joined Circles before pagination and retains an empty-list result", async () => {
    const calls: Array<[string, unknown[]]> = []
    const builder: Record<string, any> = {}
    for (const method of ["select", "eq", "order", "not", "range"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, args])
        return builder
      }
    }
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
    const circleBuilder: Record<string, any> = {}
    for (const method of ["select", "eq", "in"]) {
      circleBuilder[method] = (...args: unknown[]) => {
        calls.push([`members.${method}`, args])
        return circleBuilder
      }
    }
    circleBuilder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [{ circle_id: "joined-circle" }], error: null }).then(resolve, reject)

    const db = { from: (table: string) => table === "circles" ? builder : circleBuilder }
    const { communities, error } = await listCommunitiesForDiscovery(db, {
      viewerId: "viewer-id",
      excludeJoinedFrom: "viewer-id",
      limit: 10,
      offset: 0,
    })

    expect(error).toBeNull()
    expect(communities).toEqual([])
    const notIndex = calls.findIndex(([method]) => method === "not")
    const rangeIndex = calls.findIndex(([method]) => method === "range")
    expect(notIndex).toBeGreaterThan(-1)
    expect(rangeIndex).toBeGreaterThan(notIndex)
    expect(calls[notIndex]).toEqual(["not", ["id", "in", "(joined-circle)"]])
  })
})

describe("community server client", () => {
  it("never falls back to the public anon key for privileged community operations", () => {
    expect(() => communityClient()).toThrow("SUPABASE_SERVICE_ROLE_KEY")
    expect(state.createClient).not.toHaveBeenCalled()
  })

  it("uses only the configured service role key", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    communityClient()
    expect(state.createClient).toHaveBeenCalledWith(
      "https://loop.example.supabase.co",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  })
})
