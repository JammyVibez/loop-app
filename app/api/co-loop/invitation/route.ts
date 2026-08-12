import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const body = await req.json()
    const { sessionId, inviteId, status } = body

    if (!sessionId || !status) {
      return NextResponse.json({ error: "Missing sessionId or status" }, { status: 400 })
    }

    // Attempt updating invitations table if available
    if (inviteId) {
      await supabase
        .from("invitations")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", inviteId)
    }

    // Broadcast status change over Supabase Realtime
    const channel = supabase.channel(`co-loop-invite:${sessionId}`)
    await channel.send({
      type: "broadcast",
      event: "invite_status",
      payload: { sessionId, status },
    })

    return NextResponse.json({ success: true, sessionId, status })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update invitation" }, { status: 500 })
  }
}
