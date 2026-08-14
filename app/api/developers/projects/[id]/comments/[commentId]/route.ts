import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const { id: projectId, commentId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    const { data: comment } = await supabase
      .from("project_comments")
      .select("id, user_id, project_id")
      .eq("id", commentId)
      .eq("project_id", projectId)
      .maybeSingle()

    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

    const { data: project } = await supabase
      .from("developer_projects")
      .select("author_id")
      .eq("id", projectId)
      .maybeSingle()

    const canDelete = comment.user_id === user.id || project?.author_id === user.id
    if (!canDelete) {
      return NextResponse.json(
        { error: "Only the comment author or project owner can delete this" },
        { status: 403 },
      )
    }

    // Replies hang off the parent — remove them with it.
    await supabase.from("project_comments").delete().eq("parent_comment_id", commentId)
    const { error } = await supabase.from("project_comments").delete().eq("id", commentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Project comment DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
