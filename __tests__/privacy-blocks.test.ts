import { describe, expect, it } from "vitest"
import { canViewProfile, filterPrivateContent, getBlockedProfileIds } from "@/lib/privacy"

function createSupabaseMock(blockRows: Array<{ blocker_id: string; blocked_id: string }>, privateIds: string[] = []) {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const builder: any = {
        select: () => builder,
        eq: (key: string, value: unknown) => { filters[key] = value; return builder },
        in: (key: string, values: unknown[]) => { filters[key] = values; return builder },
        maybeSingle: async () => {
          if (table === "profiles") return { data: { privacy_settings: { profile_visibility: privateIds.includes(String(filters.id)) ? "private" : "public" } }, error: null }
          if (table === "user_blocks") {
            const match = blockRows.find(row => row.blocker_id === filters.blocker_id && row.blocked_id === filters.blocked_id)
            return { data: match ? { id: 1 } : null, error: null }
          }
          return { data: null, error: null }
        },
        then: (resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) => {
          const data = table === "profiles"
            ? (filters.id as string[]).map(id => ({ id, privacy_settings: { profile_visibility: privateIds.includes(id) ? "private" : "public" } }))
            : table === "user_blocks"
              ? blockRows.filter(row => {
                  const eqMatches = Object.entries(filters).filter(([key]) => key !== "blocked_id" || !Array.isArray(filters.blocked_id)).every(([key, value]) => row[key as keyof typeof row] === value)
                  const incoming = Array.isArray(filters.blocker_id) ? (filters.blocker_id as string[]).includes(row.blocker_id) : true
                  const outgoing = Array.isArray(filters.blocked_id) ? (filters.blocked_id as string[]).includes(row.blocked_id) : true
                  return eqMatches && incoming && outgoing
                })
              : []
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
}

describe("two-way block privacy", () => {
  const viewer = "viewer"
  const blocks = [
    { blocker_id: viewer, blocked_id: "blocked-by-viewer" },
    { blocker_id: "blocked-viewer", blocked_id: viewer },
  ]

  it("removes content from both sides of a block but preserves self and approved private follows", async () => {
    const supabase = createSupabaseMock(blocks, ["private-followed"])
    const rows = ["self", "blocked-by-viewer", "blocked-viewer", "private-followed", "public"]
      .map(author_id => ({ id: author_id, author_id }))
    const result = await filterPrivateContent(supabase, rows, viewer, new Set(["private-followed"]))
    expect(result.map(row => row.id)).toEqual(["self", "private-followed", "public"])
  })

  it("returns both block directions for a bounded author list", async () => {
    const supabase = createSupabaseMock(blocks)
    expect(await getBlockedProfileIds(supabase, viewer, ["blocked-by-viewer", "blocked-viewer", "public"])).toEqual(
      new Set(["blocked-by-viewer", "blocked-viewer"]),
    )
  })

  it("denies profile access when either side has blocked the other", async () => {
    const supabase = createSupabaseMock(blocks)
    expect(await canViewProfile(supabase, viewer, "blocked-by-viewer")).toEqual({ allowed: false, isPrivate: false })
    expect(await canViewProfile(supabase, viewer, "blocked-viewer")).toEqual({ allowed: false, isPrivate: false })
  })

  it("allows a public profile when no block exists", async () => {
    const supabase = createSupabaseMock([])
    expect(await canViewProfile(supabase, viewer, "public")).toEqual({ allowed: true, isPrivate: false })
  })
})
