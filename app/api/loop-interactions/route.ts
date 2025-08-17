// app/api/loop-interactions/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const token = req.headers.get("authorization")?.replace("Bearer ", "")

  if (!token) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  // Authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ success: false, error: "Invalid user" }, { status: 401 })
  }

  // Parse loop_ids from query string
  const { searchParams } = new URL(req.url)
  const loopIds = searchParams.get("loop_ids")?.split(",").filter(Boolean) || []

  if (loopIds.length === 0) {
    return NextResponse.json({ success: true, interactions: [] })
  }

  // Fetch interactions
  const { data, error } = await supabase
    .from("loop_interactions")
    .select("loop_id, interaction_type")
    .eq("user_id", user.id)
    .in("loop_id", loopIds)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, interactions: data || [] })
}
