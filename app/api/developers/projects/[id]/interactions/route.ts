import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser(token)
  return user || null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = createServerClient()
  const user = await getUser(request)

  const { data: project, error } = await supabase
    .from("developer_projects")
    .select("id, stars, forks, views")
    .eq("id", projectId)
    .maybeSingle()

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  let isStarred = false
  let isForked = false
  if (user) {
    const [{ data: star }, { data: fork }] = await Promise.all([
      supabase.from("project_stars").select("id").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("project_forks").select("id").eq("original_project_id", projectId).eq("user_id", user.id).maybeSingle(),
    ])
    isStarred = Boolean(star)
    isForked = Boolean(fork)
  }

  return NextResponse.json({
    success: true,
    stars: project.stars || 0,
    forks: project.forks || 0,
    views: project.views || 0,
    is_starred: isStarred,
    is_forked: isForked,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const type = body.type as "star" | "unstar" | "fork" | "view"

    const { data: project, error: projectError } = await supabase
      .from("developer_projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle()

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (type === "star") {
      const { error } = await supabase.from("project_stars").insert({ project_id: projectId, user_id: user.id })
      // Unique constraint violation just means already starred — treat as success.
      if (error && !/duplicate|unique/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, starred: true, stars: (project.stars || 0) + (error ? 0 : 1) })
    }

    if (type === "unstar") {
      const { error } = await supabase
        .from("project_stars")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, starred: false, stars: Math.max(0, (project.stars || 0) - 1) })
    }

    if (type === "view") {
      await supabase
        .from("developer_projects")
        .update({ views: (project.views || 0) + 1 })
        .eq("id", projectId)
      return NextResponse.json({ success: true })
    }

    if (type === "fork") {
      if (project.author_id === user.id) {
        return NextResponse.json({ error: "You can't fork your own project" }, { status: 400 })
      }

      const { data: existingFork } = await supabase
        .from("project_forks")
        .select("id, forked_project_id")
        .eq("original_project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (existingFork?.forked_project_id) {
        return NextResponse.json({ success: true, already_forked: true, forked_project_id: existingFork.forked_project_id })
      }

      // Create a real, independent copy owned by the forking user — not just a counter bump.
      const forkPayload: Record<string, unknown> = {
        author_id: user.id,
        title: project.title,
        description: project.description,
        language: project.language,
        framework: project.framework,
        tags: project.tags,
        code_snippet: project.code_snippet,
        repository_url: project.repository_url,
        demo_url: project.demo_url,
        is_public: true,
        files: Array.isArray(project.files) ? project.files : [],
      }

      let { data: forkedProject, error: forkInsertError } = await supabase
        .from("developer_projects")
        .insert(forkPayload)
        .select("*")
        .single()

      // Retry without files if column missing on older schema
      if (forkInsertError?.code === "PGRST204" && /files/i.test(forkInsertError.message || "")) {
        const { files: _files, ...withoutFiles } = forkPayload
        ;({ data: forkedProject, error: forkInsertError } = await supabase
          .from("developer_projects")
          .insert(withoutFiles)
          .select("*")
          .single())
      }

      if (forkInsertError || !forkedProject) {
        return NextResponse.json({ error: forkInsertError?.message || "Failed to fork project" }, { status: 500 })
      }

      const { error: forkRecordError } = await supabase.from("project_forks").insert({
        original_project_id: projectId,
        user_id: user.id,
        forked_project_id: forkedProject.id,
      })

      if (forkRecordError && !/duplicate|unique/i.test(forkRecordError.message)) {
        console.error("project_forks insert error:", forkRecordError)
      }

      return NextResponse.json({
        success: true,
        forked_project_id: forkedProject.id,
        forks: (project.forks || 0) + 1,
      })
    }

    return NextResponse.json({ error: "Invalid interaction type. Use star, unstar, fork, or view." }, { status: 400 })
  } catch (error) {
    console.error("Project interaction error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
