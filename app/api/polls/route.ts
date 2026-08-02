import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function POST(req: NextRequest) {
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

    const userId = authData.user.id
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
