import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
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

    // Fetch all quests with completion statistics
    const { data: quests, error } = await supabase
      .from("quests")
      .select(`
        *,
        quest_completions(count)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching quests:", error)
      return NextResponse.json({ error: "Failed to fetch quests" }, { status: 500 })
    }

    // Process completion counts
    const questsWithStats = quests.map((quest) => ({
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
