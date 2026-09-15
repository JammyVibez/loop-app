import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** POST — pin or unpin a message */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const supabase = createServerClient()

    const { data: membership } = await supabase
      .from("conversation_participants")
      .select("role, can_pin_messages")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 })

    // Admin or users with can_pin_messages permission
    const isMod = ["owner", "admin"].includes(membership.role) || membership.can_pin_messages
    if (!isMod) return NextResponse.json({ error: "Only admins/mods can pin messages" }, { status: 403 })

    const body = await request.json()
    const { message_id, unpin } = body
    if (!message_id) return NextResponse.json({ error: "message_id required" }, { status: 400 })

    // Verify the message belongs to this conversation
    const { data: msg } = await supabase
      .from("messages")
      .select("id, content, author_id")
      .eq("id", message_id)
      .eq("conversation_id", id)
      .maybeSingle()
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    if (unpin) {
      const { error } = await supabase
        .from("messages")
        .update({ is_pinned: false, pinned_by: null, pinned_at: null })
        .eq("id", message_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, pinned: false })
    }

    const { error } = await supabase
      .from("messages")
      .update({
        is_pinned: true,
        pinned_by: user.id,
        pinned_at: new Date().toISOString(),
      })
      .eq("id", message_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, pinned: true })
  } catch (error: any) {
    console.error("[group-pin] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
