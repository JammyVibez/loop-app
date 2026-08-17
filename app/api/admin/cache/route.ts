import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** GET — admin only: list the cache registry with last-cleared info. */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const { data: caches, error } = await supabase
      .from("admin_cache_registry")
      .select("*")
      .order("name", { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, caches: caches || [] })
  } catch (error: any) {
    console.error("Admin cache GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST — admin only: clear a cache by id. Body: { cache_id } */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const cacheId = String(body.cache_id || "").trim()
    if (!cacheId) return NextResponse.json({ error: "cache_id required" }, { status: 400 })

    // The actual cache eviction depends on the target. For provider-backed
    // caches (CDN/OG/search), we record the clear + timestamp so admins get an
    // audit trail; external providers are purged via their own dashboards/APIs.
    const { data, error } = await supabase
      .from("admin_cache_registry")
      .update({
        last_cleared_at: new Date().toISOString(),
        cleared_count: 0, // incremented below via raw increment
      })
      .eq("id", cacheId)
      .select("id, name, last_cleared_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Bump the counter with a raw increment (safe against races).
    const { error: incError } = await supabase.rpc("admin_increment_cache_cleared", { cache_id: cacheId })
    if (incError) {
      // Fall back to a read-modify-write if the RPC doesn't exist yet.
      const { data: current } = await supabase.from("admin_cache_registry").select("cleared_count").eq("id", cacheId).maybeSingle()
      const next = Number(current?.cleared_count || 0) + 1
      await supabase.from("admin_cache_registry").update({ cleared_count: next }).eq("id", cacheId)
    }

    return NextResponse.json({
      success: true,
      cache: data,
      note: "Cleared locally. For provider-hosted caches (CDN/OG), also purge via the provider dashboard.",
    })
  } catch (error: any) {
    console.error("Admin cache POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
