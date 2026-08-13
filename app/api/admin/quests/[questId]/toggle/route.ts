import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  try {
    const { questId } = await params
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { is_active } = await request.json()

    // Toggle quest status
    const { data: quest, error } = await supabase
      .from("quests")
      .update({
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", questId)
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
    console.error("Error in quest toggle POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
