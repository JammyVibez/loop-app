import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * Public awards endpoint.
 * GET ?user_id=<uuid>          → that user's awarded badges (grouped by award).
 * GET                          → the active award catalog (definitions).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")

    if (userId) {
      // NOTE: no FK exists on user_awards.awarded_by → profiles in PostgREST's
      // schema cache, so an embedded `awarded_by:profiles!awarded_by(...)`
      // hint fails the ENTIRE query (PGRST200) and the profile tab rendered
      // empty even though grants existed. Fetch granters separately instead.
      const { data: grants, error } = await supabase
        .from("user_awards")
        .select(
          `id, reason, created_at, awarded_by,
           award:awards(id, name, description, emoji, color)`,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Resolve granter display names in one batch (works without an FK).
      const granterIds = [...new Set((grants || []).map((g: any) => g.awarded_by).filter(Boolean))] as string[]
      const grantersById = new Map<string, any>()
      if (granterIds.length) {
        const { data: granters } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", granterIds)
        for (const g of granters || []) grantersById.set(g.id, g)
      }
      const withGranter = (grants || []).map((g: any) => ({
        ...g,
        granted_by: grantersById.get(g.awarded_by) || null,
      }))

      // Group so the profile shelf shows each badge once with its count.
      const grouped = new Map<string, any>()
      for (const grant of withGranter) {
        const award = Array.isArray(grant.award) ? grant.award[0] : grant.award
        if (!award) continue
        const key = award.id
        if (!grouped.has(key)) {
          grouped.set(key, { ...award, count: 0, awarded_at: grant.created_at })
        }
        const entry = grouped.get(key)
        entry.count += 1
        if (!entry.awarded_at || grant.created_at > entry.awarded_at) entry.awarded_at = grant.created_at
      }

      return NextResponse.json({ success: true, awards: Array.from(grouped.values()) })
    }

    const { data: awards, error } = await supabase
      .from("awards")
      .select("id, name, description, emoji, color")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, awards: awards || [] })
  } catch (error: any) {
    console.error("Awards GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
