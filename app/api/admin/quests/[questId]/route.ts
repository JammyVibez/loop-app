import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  try {
    const { questId } = await params
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { title, description, type, reward_amount, requirements, is_active } = await request.json()

    // Update quest
    const { data: quest, error } = await supabase
      .from("quests")
      .update({
        title,
        description,
        type,
        reward_amount,
        requirements: requirements || {},
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", questId)
      .select()
      .single()

    if (error) {
      console.error("Error updating quest:", error)
      return NextResponse.json({ error: "Failed to update quest" }, { status: 500 })
    }

    return NextResponse.json({ quest, message: "Quest updated successfully" })
  } catch (error) {
    console.error("Error in quest PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  try {
    const { questId } = await params
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { error } = await supabase.from("quests").delete().eq("id", questId)

    if (error) {
      console.error("Error deleting quest:", error)
      return NextResponse.json({ error: "Failed to delete quest" }, { status: 500 })
    }

    return NextResponse.json({ message: "Quest deleted successfully" })
  } catch (error) {
    console.error("Error in quest DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
