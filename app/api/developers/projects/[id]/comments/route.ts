import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { notifyUser } from "@/lib/notifications"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params
    const supabase = createServerClient()

    const { data: comments, error } = await supabase
      .from("project_comments")
      .select(
        `
        *,
        author:profiles!project_comments_user_id_fkey(
          id, username, display_name, avatar_url, is_verified
        )
      `,
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(300)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const roots: any[] = []
    const byParent = new Map<string, any[]>()
    for (const comment of comments || []) {
      if (comment.parent_comment_id) {
        const list = byParent.get(comment.parent_comment_id) || []
        list.push(comment)
        byParent.set(comment.parent_comment_id, list)
      } else {
        roots.push(comment)
      }
    }

    const nested = roots.map((comment) => ({
      ...comment,
      replies: byParent.get(comment.id) || [],
    }))

    return NextResponse.json({ success: true, comments: nested })
  } catch (error) {
    console.error("Project comments GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim()
    const parentCommentId = body.parent_comment_id ? String(body.parent_comment_id) : null

    if (!content) return NextResponse.json({ error: "Comment is required" }, { status: 400 })
    if (content.length > 2000) {
      return NextResponse.json({ error: "Comment is too long (2000 max)" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: project } = await supabase
      .from("developer_projects")
      .select("id, author_id, title")
      .eq("id", projectId)
      .maybeSingle()

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const { data: comment, error } = await supabase
      .from("project_comments")
      .insert({
        project_id: projectId,
        user_id: user.id,
        parent_comment_id: parentCommentId,
        content,
      })
      .select(
        `
        *,
        author:profiles!project_comments_user_id_fkey(
          id, username, display_name, avatar_url, is_verified
        )
      `,
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify the project author (unless they commented on their own project).
    if (project.author_id && project.author_id !== user.id) {
      await notifyUser(supabase, {
        userId: project.author_id,
        actorId: user.id,
        type: "developer_project_comment",
        title: "New comment on your project",
        message: `${user.name || user.user_metadata?.display_name || "Someone"} commented on “${project.title || "your project"}”`,
        actionUrl: `/developers/${projectId}`,
        pushCategory: "social",
      })
    }

    return NextResponse.json({ success: true, comment }, { status: 201 })
  } catch (error) {
    console.error("Project comments POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
