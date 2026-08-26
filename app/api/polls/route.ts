import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

// Used by PollCardWidget's client-side fallback when a loop is rendered
// without a server-attached `poll` (e.g. any page that fetches loops
// without calling enrichLoopsWithPollsAndDuels first). Without this, votes
// on those pages silently never rendered — `if (!poll) return null`.
export async function GET(req: NextRequest) {
  try {
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {


    const authUser = await getUserFromRequest(req)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authUser.id
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
