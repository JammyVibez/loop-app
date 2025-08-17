import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

// GET /api/users?sort=newest&limit=5
export async function GET(req: NextRequest) {
  const supabase = createServerClient()

  const { searchParams } = new URL(req.url)
  const sort = searchParams.get("sort") || "newest"
  const limit = parseInt(searchParams.get("limit") || "5")

  // Fetch users from "profiles" table
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_verified, is_premium")

  // Sort logic
  if (sort === "newest") {
    query = query.order("created_at", { ascending: false })
  } else if (sort === "popular") {
    query = query.order("follower_count", { ascending: false })
  }

  // Apply limit
  query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    users: data ?? [],
  })
}
