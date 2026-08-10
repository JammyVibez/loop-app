import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

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
    const { side } = await req.json() // 'A' or 'B'

    if (!side || (side !== "A" && side !== "B")) {
      return NextResponse.json({ error: "Invalid side. Must be A or B." }, { status: 400 })
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from("loop_duel_votes")
      .select("id")
      .eq("duel_id", duelId)
      .eq("user_id", userId)
      .single()

    if (existingVote) {
      return NextResponse.json({ error: "You have already voted in this duel!" }, { status: 400 })
    }

    // Insert vote
    const { error: voteErr } = await supabase.from("loop_duel_votes").insert({
      duel_id: duelId,
      user_id: userId,
      side,
    })

    if (voteErr) {
      return NextResponse.json({ error: voteErr.message }, { status: 400 })
    }

    // Recalculate entry votes
    const { count: countA } = await supabase
      .from("loop_duel_votes")
      .select("*", { count: "exact", head: true })
      .eq("duel_id", duelId)
      .eq("side", "A")

    const { count: countB } = await supabase
      .from("loop_duel_votes")
      .select("*", { count: "exact", head: true })
      .eq("duel_id", duelId)
      .eq("side", "B")

    await supabase
      .from("loop_duel_entries")
      .update({ votes_count: countA || 0 })
      .eq("duel_id", duelId)
      .eq("side", "A")

    await supabase
      .from("loop_duel_entries")
      .update({ votes_count: countB || 0 })
      .eq("duel_id", duelId)
      .eq("side", "B")

    return NextResponse.json({
      success: true,
      votes: { A: countA || 0, B: countB || 0 },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
