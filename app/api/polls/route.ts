import { NextRequest, NextResponse } from "next/server"
import { withUser, withHandler } from "@/lib/api-handler"

// Used by PollCardWidget's client-side fallback when a loop is rendered
// without a server-attached `poll` (e.g. any page that fetches loops
// without calling enrichLoopsWithPollsAndDuels first). Without this, votes
// on those pages silently never rendered — `if (!poll) return null`.
export const GET = withHandler(async (req, { supabase }) => {
  const loopId = req.nextUrl.searchParams.get("loop_id") || req.nextUrl.searchParams.get("loopId")
  if (!loopId) {
    return NextResponse.json({ error: "loop_id is required" }, { status: 400 })
  }

  const { data: poll, error } = await supabase
    .from("loop_polls")
    .select("*")
    .eq("loop_id", loopId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ poll: poll || null })
})

export const POST = withUser(async (req, { user, supabase }) => {
  const body = await req.json()
  const { loopId, question, options, durationHours = 24 } = body

  if (!question || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "Poll requires a question and at least 2 options" }, { status: 400 })
  }

  const formattedOptions = options.map((opt: string, idx: number) => ({
    id: `opt_${idx + 1}`,
    text: opt,
    votes: 0,
  }))

  const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString()

  const { data: poll, error } = await supabase
    .from("loop_polls")
    .insert({
      loop_id: loopId,
      question,
      options: formattedOptions,
      expires_at: expiresAt,
      total_votes: 0,
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create poll:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ poll })
})
