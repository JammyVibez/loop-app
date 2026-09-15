import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/server-auth";
import { getHiddenUserIds } from "@/lib/user-blocks";

// GET /api/users?sort=newest&limit=5
export async function GET(req: NextRequest) {
  const supabase = createServerClient()

  const { searchParams } = new URL(req.url)
  const sort = searchParams.get("sort") || "newest"
  const limit = parseInt(searchParams.get("limit") || "5")
  const q = (searchParams.get("q") || searchParams.get("search") || "").trim()

  // Viewer may be signed out — blocks only filter for signed-in users.
  const viewer = await getUserFromRequest(req).catch(() => null)

  // Fetch users from "profiles" table
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium")

  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
  }

  // Sort logic
  if (sort === "newest") {
    query = query.order("created_at", { ascending: false })
  } else if (sort === "popular") {
    query = query.order("followers_count", { ascending: false })
  }

  // Apply limit
  query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Blocked users (either direction) never appear in people lists/search.
  let users = data ?? []
  if (viewer && users.length > 0) {
    const hiddenIds = await getHiddenUserIds(supabase, viewer.id)
    if (hiddenIds.size > 0) {
      users = users.filter((u) => !hiddenIds.has(u.id))
    }
  }

  return NextResponse.json({
    success: true,
    users,
  })
}
