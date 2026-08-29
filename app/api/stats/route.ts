import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(_req: NextRequest) {
  try {
    const supabase = createServerClient()

    // Counts using head + exact count
    const [
      usersRes,
      loopsRes,
      circlesRes,
      coLoopRes,
      duelsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { head: true, count: "exact" }),
      supabase.from("loops").select("id", { head: true, count: "exact" }).eq("visibility", "public"),
      supabase.from("circles").select("id", { head: true, count: "exact" }),
      supabase.from("co_loop_sessions").select("id", { head: true, count: "exact" }).eq("status", "active"),
      (async () => { try { return await supabase.from("loop_duels").select("id", { head: true, count: "exact" }); } catch { return { count: 0 } as any; } })(),
    ])

    const total_users = Number(usersRes?.count || 0)
    const total_loops = Number(loopsRes?.count || 0)
    const total_circles = Number(circlesRes?.count || 0)
    const active_co_loops = Number(coLoopRes?.count || 0)
    const total_duels = Number((duelsRes as any)?.count || 0)

    // Recent public loops (fallback)
    const { data: recentLoopsData } = await supabase
      .from("loops")
      .select(`
        id,
        content_text,
        author:profiles!author_id(username)
      `)
      .is("parent_loop_id", null)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(3)

    // Recent circles (fallback)
    const { data: recentCirclesData } = await supabase
      .from("circles")
      .select("id, name, member_count")
      .order("updated_at", { ascending: false })
      .limit(3)

    const recent_loops = (recentLoopsData || []).map((l: any) => ({
      id: l.id,
      preview: (l.content_text || "").slice(0, 140).trim(),
      author_username: l?.author?.username || null,
    }))

    const recent_circles = (recentCirclesData || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      member_count: typeof c.member_count === "number" ? c.member_count : null,
    }))

    return NextResponse.json({
      success: true,
      total_users,
      total_loops,
      total_circles,
      active_co_loops,
      total_duels,
      recent_loops,
      recent_circles,
    })
  } catch (err: any) {
    console.error("Stats route error:", err)
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 })
  }
}
