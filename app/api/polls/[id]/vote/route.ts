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
    const { optionId, optionIndex } = await req.json()

    // Fetch current poll
    const { data: poll, error: pollErr } = await supabase
      .from("loop_polls")
      .select("*")
      .eq("id", pollId)
      .single()

    if (pollErr || !poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 })
    }

    const options = Array.isArray(poll.options) ? poll.options : []

    // Resolve option: accept index (number) or string ID
    let resolvedIndex = -1
    if (typeof optionIndex === "number" && optionIndex >= 0 && optionIndex < options.length) {
      resolvedIndex = optionIndex
    } else if (optionId) {
      const idx = options.findIndex((o: any) => String(o.id) === String(optionId))
      if (idx >= 0) resolvedIndex = idx
    }

    if (resolvedIndex < 0) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 })
    }

    const selectedOption = options[resolvedIndex]
    const resolvedOptionId = selectedOption?.id || `opt_${resolvedIndex + 1}`

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

    // option_id column is UUID in production — generate a deterministic UUID from poll+index
    const voteOptionId = (() => {
      // Simple deterministic UUID v5-like: sha1(pollId + optionIndex)
      const hash = require("crypto").createHash("sha1")
      hash.update(`${pollId}:${resolvedIndex}`)
      const hex = hash.digest("hex")
      return [
        hex.slice(0, 8), hex.slice(8, 12), "5" + hex.slice(13, 16),
        "8" + hex.slice(17, 20), hex.slice(20, 32),
      ].join("-")
    })()

    const { error: voteErr } = await supabase.from("loop_poll_votes").insert({
      poll_id: pollId,
      loop_id: poll.loop_id,
      user_id: userId,
      option_id: voteOptionId,
    } as any)

    if (voteErr) {
      return NextResponse.json({ error: voteErr.message }, { status: 400 })
    }

    // Update poll option vote count & total_votes
    const updatedOptions = options.map((opt: any, i: number) =>
      i === resolvedIndex ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
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
      userVotedOptionId: resolvedOptionId,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
