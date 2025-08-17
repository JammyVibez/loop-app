import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PUT(request: NextRequest, { params }: { params: { questId: string } }) {
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
      .eq("id", params.questId)
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

export async function DELETE(request: NextRequest, { params }: { params: { questId: string } }) {
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

    // Delete quest
    const { error } = await supabase.from("quests").delete().eq("id", params.questId)

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
