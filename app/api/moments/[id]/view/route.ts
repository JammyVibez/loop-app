import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** POST — increment the view count on a moment (idempotent per moment per user via a lightweight guard). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createServerClient()

    // Only count views on live moments.
    const { data: moment } = await supabase
      .from("moments")
      .select("id, view_count")
      .eq("id", id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()
    if (!moment) return NextResponse.json({ error: "Moment not found or expired" }, { status: 404 })

    const { data, error } = await supabase
      .from("moments")
      .update({ view_count: (Number(moment.view_count) || 0) + 1 })
      .eq("id", id)
      .select("view_count")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, view_count: data?.view_count ?? Number(moment.view_count) + 1 })
  } catch (error: any) {
    console.error("Moment view error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
