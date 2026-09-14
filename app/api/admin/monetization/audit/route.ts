import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { logAdminAction } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/monetization/audit?limit=100
 * Returns the coin/pricing/subscription admin audit trail with admin
 * identities resolved for display.
 */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit") || 100), 200)
    const targetUser = searchParams.get("target_user_id")

    const supabase = createServerClient()

    let query = supabase
      .from("admin_action_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (targetUser) {
      query = query.eq("target_user_id", targetUser)
    }

    const { data: logs, error } = await query
    if (error) return NextResponse.json({ logs: [] })

    // Resolve admin + target user identities in bulk.
    const adminIds = [...new Set((logs || []).map((l: any) => l.admin_id).filter(Boolean))]
    const targetIds = [...new Set((logs || []).map((l: any) => l.target_user_id).filter(Boolean))]
    const allIds = [...new Set([...adminIds, ...targetIds])]

    const userMap: Record<string, any> = {}
    if (allIds.length > 0) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", allIds)
      for (const u of users || []) userMap[u.id] = u
    }

    const enriched = (logs || []).map((l: any) => ({
      ...l,
      admin: userMap[l.admin_id] || null,
      target: userMap[l.target_user_id] || null,
    }))

    return NextResponse.json({ logs: enriched })
  } catch (error: any) {
    console.error("GET admin monetization audit error:", error)
    return NextResponse.json({ logs: [] })
  }
}

/**
 * DELETE /api/admin/monetization/audit?id=<uuid>&reason=<text>
 * Removes a mistaken audit entry — itself audit-logged with the full deleted row.
 */
export async function DELETE(request: NextRequest) {
  const { response, user: admin } = await requireAdmin(request)
  if (response) return response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const reason = searchParams.get("reason") || ""
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    if (!reason.trim()) return NextResponse.json({ error: "A reason is required" }, { status: 400 })

    const supabase = createServerClient()

    const { data: existing } = await supabase.from("admin_action_log").select("*").eq("id", id).maybeSingle()
    if (!existing) return NextResponse.json({ error: "Audit entry not found" }, { status: 404 })

    const { error } = await supabase.from("admin_action_log").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAdminAction(supabase, {
      adminId: admin!.id,
      action: "audit_entry_delete" as any,
      reason,
      details: { deleted_entry: existing },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("DELETE admin monetization audit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
