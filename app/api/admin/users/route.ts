import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", authData.user.id)
      .single()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const search = req.nextUrl.searchParams.get("search") || ""
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20"), 50)

    let query = supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, email, is_admin, is_premium, is_verified, is_team_member, is_banned, created_at, deletion_executed_at, loop_coins, followers_count, following_count, loops_count, level, reputation_score")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (search.trim()) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: users, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: users || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
