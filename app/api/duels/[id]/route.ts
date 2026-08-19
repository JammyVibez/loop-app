import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: duelId } = await params
    const body = await req.json()
    const { prompt, prediction_question, clip_url } = body

    // Fetch existing duel
    const { data: duel, error: fetchErr } = await supabase
      .from("loop_duels")
      .select("creator_id, status, betting_ends_at")
      .eq("id", duelId)
      .single()

    if (fetchErr || !duel) {
      return NextResponse.json({ error: "Duel not found" }, { status: 404 })
    }

    // Only the duel creator can edit
    if (duel.creator_id !== authData.user.id) {
      return NextResponse.json({ error: "Only the duel creator can edit" }, { status: 403 })
    }

    // Cannot edit if betting has ended
    if (duel.betting_ends_at && new Date(duel.betting_ends_at) < new Date()) {
      return NextResponse.json({ error: "Cannot edit after betting has ended" }, { status: 400 })
    }

    // Cannot edit if duel is revealed or completed
    if (duel.status === "revealed" || duel.status === "completed" || duel.status === "ended") {
      return NextResponse.json({ error: "Cannot edit a completed duel" }, { status: 400 })
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (prompt && typeof prompt === "string" && prompt.trim()) {
      updates.prompt = prompt.trim()
    }
    if (prediction_question && typeof prediction_question === "string") {
      updates.prediction_question = prediction_question.trim()
    }
    if (clip_url !== undefined) {
      updates.clip_url = clip_url || null
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "No valid updates provided" }, { status: 400 })
    }

    const { error: updateErr } = await supabase
      .from("loop_duels")
      .update(updates)
      .eq("id", duelId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, duel: { id: duelId, ...updates } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
