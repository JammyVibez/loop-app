import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** POST — join a group via invite link code */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { code } = await params
    const supabase = createServerClient()

    // Find the conversation with this invite code
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, is_group, invite_link, invite_link_expires_at, invite_link_max_uses, invite_link_uses, member_limit")
      .eq("invite_link", code)
      .eq("is_group", true)
      .maybeSingle()

    if (!conv) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 })

    // Check expiry
    if (conv.invite_link_expires_at && new Date(conv.invite_link_expires_at) < new Date()) {
      return NextResponse.json({ error: "This invite link has expired" }, { status: 410 })
    }

    // Check max uses
    if (conv.invite_link_max_uses && (conv.invite_link_uses || 0) >= conv.invite_link_max_uses) {
      return NextResponse.json({ error: "This invite link has reached its usage limit" }, { status: 410 })
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("conversation_participants")
      .select("id, left_at")
      .eq("conversation_id", conv.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing && !existing.left_at) {
      return NextResponse.json({ error: "Already a member of this group", conversation_id: conv.id }, { status: 400 })
    }

    // Check member limit
    const { count: currentCount } = await supabase
      .from("conversation_participants")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .is("left_at", null)

    if ((currentCount || 0) >= (conv.member_limit || 100)) {
      return NextResponse.json({ error: "This group is full" }, { status: 400 })
    }

    // Add or re-add the member
    if (existing?.left_at) {
      const { error } = await supabase
        .from("conversation_participants")
        .update({ left_at: null, role: "member", joined_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from("conversation_participants").insert({
        conversation_id: conv.id,
        user_id: user.id,
        role: "member",
        joined_at: new Date().toISOString(),
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Increment usage count
    await supabase
      .from("conversations")
      .update({ invite_link_uses: (conv.invite_link_uses || 0) + 1 })
      .eq("id", conv.id)

    // System message
    const { data: profile } = await supabase.from("profiles").select("display_name, username").eq("id", user.id).maybeSingle()
    const name = profile?.display_name || profile?.username || "Someone"
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      author_id: user.id,
      sender_id: user.id,
      content: `${name} joined via invite link`,
      message_type: "system",
      system_event: "member_joined",
      system_metadata: { actor_id: user.id },
    })

    return NextResponse.json({ success: true, conversation_id: conv.id })
  } catch (error: any) {
    console.error("[join] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
