import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  try {

    const user = await getUserFromRequest(request)
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

    // Normalize options deterministically (same rule as the frontend) so votes
    // match even for legacy rows whose options lack ids or store text objects.
    const optionText = (raw: any): string => {
      const val = raw && typeof raw === "object" ? (raw.text ?? raw.label ?? raw.name ?? "") : raw
      if (val && typeof val === "object") return String(val.text ?? val.value ?? val.label ?? "")
      return String(val ?? "")
    }
    const normalized = (poll.options || []).map((opt: any, i: number) => {
      if (opt && typeof opt === "object") {
        return {
          id: String(opt.id ?? i),
          text: optionText(opt),
          votes: Number(opt.votes || 0),
          image_url: opt.image_url || opt.media_url ? String(opt.image_url || opt.media_url) : null,
        }
      }
      return { id: String(i), text: String(opt ?? ""), votes: 0, image_url: null }
    })
    const targetIndex = normalized.findIndex((o: any) => o.id === optionId)
    if (targetIndex === -1) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 })
    }
    const nextOptions = normalized.map((o: any, i: number) =>
      i === targetIndex ? { ...o, votes: Number(o.votes || 0) + 1 } : o,
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
