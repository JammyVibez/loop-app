import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let code = ""
  for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/** GET — get current invite link */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const supabase = createServerClient()

    const { data: membership } = await supabase
      .from("conversation_participants")
      .select("role")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 })

    const { data: conv } = await supabase
      .from("conversations")
      .select("invite_link, invite_link_expires_at, invite_link_max_uses, invite_link_uses")
      .eq("id", id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      invite_link: conv?.invite_link || null,
      expires_at: conv?.invite_link_expires_at || null,
      max_uses: conv?.invite_link_max_uses || null,
      uses: conv?.invite_link_uses || 0,
    })
  } catch (error: any) {
    console.error("[group-invite] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST — create or regenerate invite link */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const supabase = createServerClient()

    const { data: membership } = await supabase
      .from("conversation_participants")
      .select("role")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 })

    const hierarchy = ["member", "moderator", "admin", "owner"]
    if (hierarchy.indexOf(membership.role) < hierarchy.indexOf("admin")) {
      return NextResponse.json({ error: "Only admins can manage invite links" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const code = generateInviteCode()
    const expiresAt = body.expires_hours
      ? new Date(Date.now() + body.expires_hours * 3600 * 1000).toISOString()
      : null
    const maxUses = body.max_uses || null

    const { error } = await supabase
      .from("conversations")
      .update({
        invite_link: code,
        invite_link_expires_at: expiresAt,
        invite_link_max_uses: maxUses,
        invite_link_uses: 0,
      })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, invite_link: code, expires_at: expiresAt, max_uses: maxUses })
  } catch (error: any) {
    console.error("[group-invite] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — revoke invite link */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const supabase = createServerClient()

    const { data: membership } = await supabase
      .from("conversation_participants")
      .select("role")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 })

    const hierarchy = ["member", "moderator", "admin", "owner"]
    if (hierarchy.indexOf(membership.role) < hierarchy.indexOf("admin")) {
      return NextResponse.json({ error: "Only admins can revoke invite links" }, { status: 403 })
    }

    const { error } = await supabase
      .from("conversations")
      .update({
        invite_link: null,
        invite_link_expires_at: null,
        invite_link_max_uses: null,
        invite_link_uses: 0,
      })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[group-invite] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
