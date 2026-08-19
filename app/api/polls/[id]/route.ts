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

    const { id: pollId } = await params
    const body = await req.json()
    const { question, options } = body

    // Fetch existing poll
    const { data: poll, error: fetchErr } = await supabase
      .from("loop_polls")
      .select("*, loop:loop_id(creator_id)")
      .eq("id", pollId)
      .single()

    if (fetchErr || !poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 })
    }

    // Only the poll creator can edit
    const loopData = poll.loop as any
    const creatorId = loopData?.creator_id
    if (creatorId !== authData.user.id) {
      return NextResponse.json({ error: "Only the poll creator can edit" }, { status: 403 })
    }

    // Cannot edit if anyone has voted
    if ((poll.total_votes || 0) > 0) {
      return NextResponse.json({ error: "Cannot edit poll after votes have been cast" }, { status: 400 })
    }

    // Cannot edit if poll has expired
    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      return NextResponse.json({ error: "Cannot edit an expired poll" }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (question && typeof question === "string" && question.trim()) {
      updates.question = question.trim()
    }
    if (Array.isArray(options) && options.length >= 2) {
      const formattedOptions = options.map((opt: string, idx: number) => ({
        id: `opt_${idx + 1}`,
        text: opt,
        votes: 0,
      }))
      updates.options = formattedOptions
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates provided" }, { status: 400 })
    }

    const { error: updateErr } = await supabase
      .from("loop_polls")
      .update(updates)
      .eq("id", pollId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, poll: { id: pollId, ...updates } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
