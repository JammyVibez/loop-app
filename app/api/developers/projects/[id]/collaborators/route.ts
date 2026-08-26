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

const COLLABORATOR_SELECT = `
  id,
  project_id,
  user_id,
  role,
  permissions,
  invited_by,
  joined_at,
  user:profiles!project_collaborators_user_id_fkey(
    id,
    username,
    display_name,
    avatar_url, video_avatar_url,
    is_verified,
    verification_level
  )
`

const VALID_ROLES = ["owner", "maintainer", "contributor"]

/**
 * GET /api/developers/projects/[id]/collaborators
 * List everyone working on a project, ordered owner → maintainer → contributor.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    const { data: project, error: projectError } = await supabase
      .from("developer_projects")
      .select("id, author_id, title")
      .eq("id", id)
      .maybeSingle()
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const { data: collaborators, error } = await supabase
      .from("project_collaborators")
      .select(COLLABORATOR_SELECT)
      .eq("project_id", id)
      .order("joined_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const roleRank: Record<string, number> = { owner: 0, maintainer: 1, contributor: 2 }
    const sorted = (collaborators || []).sort(
      (a: any, b: any) => (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9),
    )

    return NextResponse.json({ success: true, collaborators: sorted, author_id: project.author_id })
  } catch (error: any) {
    console.error("List collaborators error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/developers/projects/[id]/collaborators
 * { username, role? } — project author or a maintainer invites someone to the project.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const actor = await getUser(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    const { data: project, error: projectError } = await supabase
      .from("developer_projects")
      .select("id, author_id, title")
      .eq("id", id)
      .maybeSingle()
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    // Permission: author or an owner/maintainer collaborator.
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
        { error: "Only the project author or a maintainer can invite collaborators" },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const username = String(body.username || "").trim().replace(/^@/, "").toLowerCase()
    const role = String(body.role || "contributor")
    if (!username) return NextResponse.json({ error: "username is required" }, { status: 400 })
    if (!VALID_ROLES.includes(role) || role === "owner") {
      return NextResponse.json({ error: "Role must be maintainer or contributor" }, { status: 400 })
    }

    // Find the invitee by username.
    const { data: invitee, error: inviteeError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url")
      .ilike("username", username)
      .maybeSingle()
    if (inviteeError) return NextResponse.json({ error: inviteeError.message }, { status: 500 })
    if (!invitee) return NextResponse.json({ error: "No user found with that username" }, { status: 404 })
    if (invitee.id === actor.id && project.author_id !== actor.id) {
      return NextResponse.json({ error: "You're already on this project" }, { status: 409 })
    }

    const { data: existing } = await supabase
      .from("project_collaborators")
      .select("id")
      .eq("project_id", id)
      .eq("user_id", invitee.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: `@${invitee.username} is already a collaborator on this project` },
        { status: 409 },
      )
    }

    const { data: collaborator, error: insertError } = await supabase
      .from("project_collaborators")
      .insert({
        project_id: id,
        user_id: invitee.id,
        role,
        permissions: {
          read: true,
          write: role === "maintainer",
          admin: role === "maintainer",
        },
        invited_by: actor.id,
      })
      .select(COLLABORATOR_SELECT)
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Notify the invitee so they see it live.
    try {
      await supabase.from("notifications").insert({
        user_id: invitee.id,
        type: "project_collaborator",
        title: `🤝 You were added to "${project.title || "a project"}"`,
        message: `@${actor.user_metadata?.username || "Someone"} added you as a ${role} on this project.`,
        data: { project_id: id, role },
        is_read: false,
      })
    } catch (notifErr) {
      console.error("Collaborator invite notification failed:", notifErr)
    }

    return NextResponse.json({ success: true, collaborator }, { status: 201 })
  } catch (error: any) {
    console.error("Invite collaborator error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
