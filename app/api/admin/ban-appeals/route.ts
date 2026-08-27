import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireModerator } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/admin/ban-appeals?status=pending
export async function GET(request: NextRequest) {
  try {
    const { user: _user, response } = await requireModerator(request)
    if (response) return response

    const supabase = createServerClient()
    const status = request.nextUrl.searchParams.get("status") || "pending"
    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50")
    const offset = Number.parseInt(request.nextUrl.searchParams.get("offset") || "0")

    let query = supabase
      .from("ban_appeals")
      .select(`*, user:profiles!user_id(id, username, display_name, avatar_url, email, is_banned, ban_reason, is_deleted, created_at)`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status !== "all") query = query.eq("status", status)

    const { data: appeals, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, appeals: appeals || [] })
  } catch (error) {
    console.error("Ban appeals admin error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/ban-appeals — review an appeal
// body: { appeal_id, decision: "approve" | "deny", admin_notes? }
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireModerator(request)
    if (response) return response

    const supabase = createServerClient()
    const body = await request.json()
    const appealId = body.appeal_id as string
    const decision = body.decision as string
    const adminNotes = String(body.admin_notes || "").trim() || null

    if (!appealId || !["approve", "deny"].includes(decision)) {
      return NextResponse.json({ error: "appeal_id and decision (approve|deny) are required" }, { status: 400 })
    }

    const { data: appeal } = await supabase.from("ban_appeals").select("*").eq("id", appealId).maybeSingle()
    if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 })
    if (appeal.status !== "pending") {
      return NextResponse.json({ error: "This appeal was already reviewed" }, { status: 400 })
    }

    const status = decision === "approve" ? "approved" : "denied"
    const { error: updateError } = await supabase
      .from("ban_appeals")
      .update({
        status,
        admin_notes: adminNotes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", appealId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    if (decision === "approve") {
      // Lift the suspension and clear the ban reason.
      await supabase
        .from("profiles")
        .update({
          is_banned: false,
          ban_reason: null,
          suspended_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appeal.user_id)

      await supabase.from("notifications").insert({
        user_id: appeal.user_id,
        type: "system",
        title: "Appeal approved 🎉",
        message: "Your suspension has been lifted. Welcome back to Loop!",
        data: { appeal_id: appealId },
      })
    } else {
      await supabase.from("notifications").insert({
        user_id: appeal.user_id,
        type: "system",
        title: "Appeal denied",
        message: adminNotes || "Your appeal was denied. Contact support if you have more context.",
        data: { appeal_id: appealId },
      })
    }

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error("Ban appeal review error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
