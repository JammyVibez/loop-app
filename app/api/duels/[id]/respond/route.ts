import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: duelId } = await params
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authData.user.id
    const { content, mediaUrl = "" } = await req.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Check if side B entry already exists
    const { data: existingB } = await supabase
      .from("loop_duel_entries")
      .select("id")
      .eq("duel_id", duelId)
      .eq("side", "B")
      .single()

    if (existingB) {
      return NextResponse.json({ error: "Side B take has already been submitted!" }, { status: 400 })
    }

    const { data: entry, error } = await supabase
      .from("loop_duel_entries")
      .insert({
        duel_id: duelId,
        user_id: userId,
        side: "B",
        title: "Opponent Take",
        content,
        media_url: mediaUrl,
        votes_count: 0,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update duel opponent_id if it was open
    await supabase
      .from("loop_duels")
      .update({ opponent_id: userId, status: "active" })
      .eq("id", duelId)

    return NextResponse.json({ entry })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
