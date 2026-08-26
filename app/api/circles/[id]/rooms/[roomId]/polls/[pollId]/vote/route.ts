import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string; pollId: string }> },
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { id: circleId, roomId, pollId } = await params
    const { optionId } = await request.json().catch(() => ({}))
    if (!optionId) return NextResponse.json({ error: "optionId is required" }, { status: 400 })

    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("status", ["active", "approved"])
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "You must be a member to vote" }, { status: 403 })

    const { data: poll, error: pollErr } = await supabase
      .from("circle_room_polls")
      .select("*")
      .eq("id", pollId)
      .eq("room_id", roomId)
      .maybeSingle()
    if (pollErr || !poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 })

    const ended = poll.ended || (poll.ends_at && new Date(poll.ends_at).getTime() <= Date.now())
    if (ended) return NextResponse.json({ error: "This poll has ended" }, { status: 400 })

    const options = Array.isArray(poll.options) ? poll.options : []
    if (!options.some((o: any) => o.id === optionId)) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 })
    }

    // One vote per member (the table has a UNIQUE(poll_id, user_id) guard).
    const { data: existing } = await supabase
      .from("circle_room_poll_votes")
      .select("id")
      .eq("poll_id", pollId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "You already voted on this poll" }, { status: 400 })
    }

    const { error: voteErr } = await supabase.from("circle_room_poll_votes").insert({
      poll_id: pollId,
      user_id: user.id,
      option_id: optionId,
    })
    if (voteErr) {
      const msg = String(voteErr.message || "")
      if (/duplicate key/i.test(msg)) {
        return NextResponse.json({ error: "You already voted on this poll" }, { status: 400 })
      }
      return NextResponse.json({ error: voteErr.message || "Failed to record vote" }, { status: 500 })
    }

    const nextOptions = options.map((opt: any) =>
      opt.id === optionId ? { ...opt, votes: Number(opt.votes || 0) + 1 } : opt,
    )
    const nextTotal = Number(poll.total_votes || 0) + 1
    const { data: updated, error: updateErr } = await supabase
      .from("circle_room_polls")
      .update({ options: nextOptions, total_votes: nextTotal })
      .eq("id", pollId)
      .select()
      .single()
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message || "Failed to update poll" }, { status: 500 })
    }

    return NextResponse.json({ success: true, poll: updated, user_option: optionId })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
