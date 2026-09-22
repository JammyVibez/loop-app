import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(200, Number(searchParams.get("limit") || 100))
    const actionFilter = searchParams.get("action")
    const timeRange = searchParams.get("timeRange") || "24h"

    // Calculate date range
    const now = new Date()
    let startDate: Date
    if (timeRange === "1h") startDate = new Date(now.getTime() - 60 * 60 * 1000)
    else if (timeRange === "24h") startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    else if (timeRange === "7d") startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    else if (timeRange === "30d") startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    else startDate = new Date(0)

    let query = supabase
      .from("security_audit_log")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit)

    if (actionFilter) {
      query = query.eq("action", actionFilter)
    }

    const { data: securityLogs, error } = await query

    if (error) {
      console.error("Audit log query error:", error)
      return NextResponse.json({ logs: [] })
    }

    // Merge in admin actions (coin adjustments, premium grants, …) from
    // admin_action_log so the tab shows the full admin trail, not just
    // auth/security events.
    let adminQuery = supabase
      .from("admin_action_log")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit)
    if (actionFilter) adminQuery = adminQuery.eq("action", actionFilter)
    const { data: adminLogs } = await adminQuery

    const logs = [
      ...(securityLogs || []),
      ...(adminLogs || []).map((l: any) => ({
        ...l,
        user_id: l.admin_id,
        ip_address: l.ip_address ?? null,
        user_agent: null,
        action: l.action,
        details: l.details || { reason: l.reason, target_user_id: l.target_user_id },
      })),
    ].sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1))

    // Enrich with user info
    const userIds = [...new Set(logs.map((l: any) => l.user_id).filter(Boolean))]
    let userMap: Record<string, any> = {}

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds)

      if (users) {
        userMap = users.reduce((acc: any, u: any) => {
          acc[u.id] = u
          return acc
        }, {})
      }
    }

    const enrichedLogs = logs.map((log: any) => ({
      ...log,
      details: log.details ? (typeof log.details === "string" ? JSON.parse(log.details) : log.details) : null,
      username: userMap[log.user_id]?.username || null,
      display_name: userMap[log.user_id]?.display_name || null,
      avatar_url: userMap[log.user_id]?.avatar_url || null,
    }))

    return NextResponse.json({ logs: enrichedLogs })
  } catch (error) {
    console.error("Admin audit log API error:", error)
    return NextResponse.json({ logs: [] })
  }
}
