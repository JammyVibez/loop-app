import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

async function getUserFromToken(token: string) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { id: circleId, postId } = await params
    const { optionId } = await request.json()
    if (!optionId) return NextResponse.json({ error: "optionId is required" }, { status: 400 })

    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("status", ["active", "approved"])
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "You must be a member to vote" }, { status: 403 })

    const { data: poll, error: pollError } = await supabase
      .from("circle_post_polls")
      .select("*")
      .eq("post_id", postId)
      .maybeSingle()
    if (pollError || !poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 })

    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      return NextResponse.json({ error: "This poll has ended" }, { status: 400 })
    }

    const { data: existingVote } = await supabase
      .from("circle_post_poll_votes")
      .select("id, option_id")
      .eq("poll_id", poll.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingVote) {
      return NextResponse.json({ error: "You already voted on this poll" }, { status: 400 })
    }

    const { error: voteError } = await supabase.from("circle_post_poll_votes").insert({
      poll_id: poll.id,
      user_id: user.id,
      option_id: optionId,
    })
    if (voteError) {
      return NextResponse.json({ error: voteError.message || "Failed to record vote" }, { status: 500 })
    }

    const nextOptions = (poll.options || []).map((opt: any) =>
      opt.id === optionId ? { ...opt, votes: Number(opt.votes || 0) + 1 } : opt,
    )
    const nextTotal = Number(poll.total_votes || 0) + 1

    const { data: updatedPoll, error: updateError } = await supabase
      .from("circle_post_polls")
      .update({ options: nextOptions, total_votes: nextTotal })
      .eq("id", poll.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Failed to update poll" }, { status: 500 })
    }

    return NextResponse.json({ success: true, poll: updatedPoll, user_vote: optionId })
  } catch (error: any) {
    console.error("Circle poll vote error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
