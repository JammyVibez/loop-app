import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: questId } = await params
    const body = await request.json().catch(() => ({}))
    const projectId = body.project_id ? String(body.project_id) : null
    const link = body.link ? String(body.link).trim().slice(0, 500) : ""
    const note = body.note ? String(body.note).trim().slice(0, 2000) : ""

    const supabase = createServerClient()

    // Quest must exist and still be accepting entries.
    const { data: quest, error: questError } = await supabase
      .from("dev_quests")
      .select("id, title, is_active, ends_at")
      .eq("id", questId)
      .maybeSingle()
    if (questError || !quest) {
      return NextResponse.json({ error: "Quest not found" }, { status: 404 })
    }
    if (!quest.is_active) {
      return NextResponse.json({ error: "This quest is no longer accepting entries" }, { status: 400 })
    }
    if (quest.ends_at && new Date(quest.ends_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "This quest has ended" }, { status: 400 })
    }

    // Already submitted? The unique(quest_id, user_id) constraint enforces
    // this too, but check first for a friendly error.
    const { data: existing } = await supabase
      .from("dev_quest_submissions")
      .select("id, status")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "You already submitted to this quest" }, { status: 409 })
    }

    // If a project is linked, it must exist (and be public or yours).
    if (projectId) {
      const { data: project } = await supabase
        .from("developer_projects")
        .select("id, author_id, is_public")
        .eq("id", projectId)
        .maybeSingle()
      if (!project) {
        return NextResponse.json({ error: "Linked project not found" }, { status: 404 })
      }
      if (project.is_public === false && project.author_id !== user.id) {
        return NextResponse.json({ error: "You can only link your own or public projects" }, { status: 403 })
      }
    }

    const { data: submission, error } = await supabase
      .from("dev_quest_submissions")
      .insert({
        quest_id: questId,
        user_id: user.id,
        project_id: projectId,
        link: link || null,
        note: note || null,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      if (/duplicate|unique/i.test(error.message || "")) {
        return NextResponse.json({ error: "You already submitted to this quest" }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, submission }, { status: 201 })
  } catch (error: any) {
    console.error("Dev quest submit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
