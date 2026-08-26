import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

async function getUser(request: NextRequest) {
  if (!token) return null
  const supabase = createServerClient()
  const user = await getUserFromRequest(request);
  return user || null
}

const VALID_ROLES = ["owner", "maintainer", "contributor"]

/**
 * PATCH /api/developers/projects/[id]/collaborators/[userId]
 * { role } — change a collaborator's role (author or maintainer only).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await params
    const actor = await getUser(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    const { data: project, error: projectError } = await supabase
      .from("developer_projects")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle()
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const { data: actorRow } = await supabase
      .from("project_collaborators")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", actor.id)
      .maybeSingle()

    const canManage =
      project.author_id === actor.id ||
      Boolean(actorRow && ["owner", "maintainer"].includes(actorRow.role))
    if (!canManage) {
      return NextResponse.json(
        { error: "Only the project author or a maintainer can change roles" },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const role = String(body.role || "")
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Role must be owner, maintainer or contributor" }, { status: 400 })
    }

    const { data: collaborator, error: updateError } = await supabase
      .from("project_collaborators")
      .update({
        role,
        permissions: {
          read: true,
          write: role === "owner" || role === "maintainer",
          admin: role === "owner" || role === "maintainer",
        },
      })
      .eq("project_id", id)
      .eq("user_id", userId)
      .select("id, user_id, role")
      .maybeSingle()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    if (!collaborator) {
      return NextResponse.json({ error: "That user is not a collaborator on this project" }, { status: 404 })
    }

    return NextResponse.json({ success: true, collaborator })
  } catch (error: any) {
    console.error("Update collaborator role error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/developers/projects/[id]/collaborators/[userId]
 * Remove a collaborator (author/maintainer) or leave the project yourself.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await params
    const actor = await getUser(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    const { data: project, error: projectError } = await supabase
      .from("developer_projects")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle()
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const { data: target } = await supabase
      .from("project_collaborators")
      .select("id, user_id, role")
      .eq("project_id", id)
      .eq("user_id", userId)
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ error: "That user is not a collaborator on this project" }, { status: 404 })
    }

    // The owner row (which mirrors the author) can't be removed by anyone.
    if (target.role === "owner" && target.user_id === project.author_id) {
      return NextResponse.json({ error: "The project owner can't be removed" }, { status: 400 })
    }

    // Permission: yourself (leave), or author/maintainer (remove others).
    const { data: actorRow } = await supabase
      .from("project_collaborators")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", actor.id)
      .maybeSingle()

    const canManage =
      actor.id === userId ||
      project.author_id === actor.id ||
      Boolean(actorRow && ["owner", "maintainer"].includes(actorRow.role))
    if (!canManage) {
      return NextResponse.json({ error: "You don't have permission to remove this collaborator" }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from("project_collaborators")
      .delete()
      .eq("project_id", id)
      .eq("user_id", userId)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ success: true, removed_user_id: userId })
  } catch (error: any) {
    console.error("Remove collaborator error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
