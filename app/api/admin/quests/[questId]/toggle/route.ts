import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest, { params }: { params: { questId: string } }) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Verify admin user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { is_active } = await request.json()

    // Toggle quest status
    const { data: quest, error } = await supabase
      .from("quests")
      .update({
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.questId)
      .select()
      .single()

    if (error) {
      console.error("Error toggling quest status:", error)
      return NextResponse.json({ error: "Failed to toggle quest status" }, { status: 500 })
    }

    return NextResponse.json({
      quest,
      message: `Quest ${is_active ? "activated" : "deactivated"} successfully`,
    })
  } catch (error) {
    console.error("Error in quest toggle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
