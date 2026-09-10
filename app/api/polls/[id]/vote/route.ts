import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

/** Generate a deterministic UUID from a seed string. */
function deterministicUuid(seed: string): string {
  const { createHash } = require("crypto") as typeof import("crypto")
  const hex = createHash("sha1").update(seed).digest("hex")
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "5" + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-")
}

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
    const body = await req.json().catch(() => ({} as any))
    const optionIndex: number | undefined = body.optionIndex
    const optionId: string | undefined = body.optionId

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

    // Resolve by index first (most reliable), then fall back to optionId matching
    let resolvedIndex = -1
    if (typeof optionIndex === "number" && optionIndex >= 0 && optionIndex < options.length) {
      resolvedIndex = optionIndex
    } else if (optionId !== undefined && optionId !== null) {
      const norm = (o: any) => {
        if (o && typeof o === "object") {
          const val = o.text ?? o.label ?? o.name ?? ""
          return String(val && typeof val === "object" ? val.text ?? val.value ?? val.label ?? "" : val ?? "")
        }
        return String(o ?? "")
      }
      resolvedIndex = options.findIndex((o: any) => norm(o) === String(optionId))
      if (resolvedIndex < 0) {
        resolvedIndex = options.findIndex((o: any) => String((o as any)?.id ?? "") === String(optionId))
      }
      // Also try matching by numeric index string
      if (resolvedIndex < 0 && !isNaN(Number(optionId))) {
        const idx = Number(optionId)
        if (idx >= 0 && idx < options.length) resolvedIndex = idx
      }
    }

    if (resolvedIndex < 0) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 })
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from("loop_poll_votes")
      .select("id, option_id")
      .eq("poll_id", pollId)
      .eq("user_id", userId)
      .maybeSingle()

    if (existingVote) {
      return NextResponse.json({ error: "You have already voted in this poll" }, { status: 400 })
    }

    // Always use a deterministic UUID — works on both UUID-typed and TEXT columns
    const uuidOptionId = deterministicUuid(`${pollId}:${resolvedIndex}`)

    const { error: voteErr } = await supabase.from("loop_poll_votes").insert({
      poll_id: pollId,
      loop_id: poll.loop_id,
      user_id: userId,
      option_id: uuidOptionId,
    } as any)

    if (voteErr) {
      return NextResponse.json({ error: voteErr.message }, { status: 400 })
    }

    // Update poll option vote counts
    const updatedOptions = options.map((opt: any, i: number) => {
      const base = opt && typeof opt === "object" ? opt : { id: `opt_${i + 1}`, text: String(opt ?? ""), votes: 0 }
      return i === resolvedIndex ? { ...base, votes: (base.votes || 0) + 1 } : base
    })

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
      userVotedOptionId: uuidOptionId,
      userVotedIndex: resolvedIndex,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
