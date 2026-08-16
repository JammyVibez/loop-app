import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pollId } = await params
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
    const { optionId } = await req.json()

    if (!optionId) {
      return NextResponse.json({ error: "Option ID is required" }, { status: 400 })
    }

    // Check if user already voted in this poll
    const { data: existingVote } = await supabase
      .from("loop_poll_votes")
      .select("id")
      .eq("poll_id", pollId)
      .eq("user_id", userId)
      .single()

    if (existingVote) {
      return NextResponse.json({ error: "You have already voted in this poll" }, { status: 400 })
    }

    // Fetch current poll
    const { data: poll, error: pollErr } = await supabase
      .from("loop_polls")
      .select("*")
      .eq("id", pollId)
      .single()

    if (pollErr || !poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 })
    }

    // Insert user vote
    const { error: voteErr } = await supabase.from("loop_poll_votes").insert({
      poll_id: pollId,
      loop_id: poll.loop_id,
      user_id: userId,
      option_id: optionId,
    })

    if (voteErr) {
      return NextResponse.json({ error: voteErr.message }, { status: 400 })
    }

    // Update poll option vote count & total_votes
    const options = Array.isArray(poll.options) ? poll.options : []
    const updatedOptions = options.map((opt: any) =>
      opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
    )

    const newTotalVotes = (poll.total_votes || 0) + 1

    const { data: updatedPoll, error: updateErr } = await supabase
      .from("loop_polls")
      .update({
        options: updatedOptions,
        total_votes: newTotalVotes,
      })
      .eq("id", pollId)
      .select()
      .single()

    if (updateErr) {
      console.error("Failed to update poll options:", updateErr)
    }

    return NextResponse.json({
      success: true,
      poll: updatedPoll || { ...poll, options: updatedOptions, total_votes: newTotalVotes },
      userVotedOptionId: optionId,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
