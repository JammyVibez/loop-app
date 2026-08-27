import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { user: _user, response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()

    // Fetch all quests with completion statistics
    const { data: quests, error } = await supabase
      .from("quests")
      .select(`
        *,
        quest_completions(count)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      // The quests tables may not be provisioned yet — degrade to an empty
      // catalog instead of a hard 500 so the admin section stays usable.
      console.warn("Error fetching quests (returning empty catalog):", error.message)
      return NextResponse.json({ quests: [] })
    }

    // Process completion counts
    const questsWithStats = (quests || []).map((quest: any) => ({
      ...quest,
      completion_count: quest.quest_completions?.[0]?.count || 0,
    }))

    return NextResponse.json({ quests: questsWithStats })
  } catch (error) {
    console.error("Error in quest GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: _user, response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { title, description, type, reward_amount, requirements, is_active } = await request.json()

    // Create new quest
    const { data: quest, error } = await supabase
      .from("quests")
      .insert({
        title,
        description,
        type,
        reward_amount,
        requirements: requirements || {},
        is_active: is_active ?? true,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating quest:", error)
      return NextResponse.json({ error: "Failed to create quest" }, { status: 500 })
    }

    return NextResponse.json({ quest, message: "Quest created successfully" })
  } catch (error) {
    console.error("Error in quest POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
