import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

async function getUser(request: NextRequest) {
  const supabase = createServerClient()
  const user = await getUserFromRequest(request);
  return user || null
}

const AUTHOR_SELECT = `
  *,
  author:profiles!developer_projects_author_id_fkey(
    id,
    username,
    display_name,
    avatar_url, video_avatar_url,
    is_verified,
    verification_level
  )
`

/** Safely fetch the published listing separately to avoid FK join errors */
async function getPublishedListing(supabase: any, listingId: string | null) {
  if (!listingId) return null
  const { data } = await supabase
    .from("community_marketplace_listings")
    .select("id, listing_type, title, price_coins, is_published")
    .eq("id", listingId)
    .maybeSingle()
  return data || null
}

function sanitizeFiles(files: unknown) {
  if (!Array.isArray(files)) return undefined
  return files
    .filter((f: any) => f && typeof f.url === "string" && typeof f.name === "string")
    .slice(0, 5)
    .map((f: any) => ({
      name: String(f.name).slice(0, 200),
      url: f.url,
      size: Number(f.size) || undefined,
      format: f.format || undefined,
    }))
}

function sanitizeFileTree(tree: unknown) {
  if (!Array.isArray(tree)) return undefined
  return tree
    .filter((f: any) => f && typeof f.url === "string" && typeof f.name === "string")
    .slice(0, 300)
    .map((f: any) => ({
      path: String(f.path || f.name).slice(0, 500),
      name: String(f.name).slice(0, 200),
      url: String(f.url),
      size: Number(f.size) || 0,
      language: String(f.language || "Text").slice(0, 50),
    }))
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const { data: project, error } = await supabase
      .from("developer_projects")
      .select(AUTHOR_SELECT)
      .eq("id", id)
      .maybeSingle()

    if (error) {
      // Check if it's a missing table error
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        return NextResponse.json({
          error: "Database not set up",
          needsSetup: true,
          message: "The developer projects table doesn't exist yet. Please run the database setup first.",
        }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    // Fetch published listing separately (no FK join needed)
    const published_listing = await getPublishedListing(supabase, project.published_listing_id)
    if (published_listing) project.published_listing = published_listing
    delete project.published_listing_id

    // Best-effort view increment (ignore failures)
    void supabase
      .from("developer_projects")
      .update({ views: (project.views || 0) + 1 })
      .eq("id", id)

    return NextResponse.json({ project })
  } catch (error) {
    console.error("Get developer project error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: existing, error: existingError } = await supabase
      .from("developer_projects")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle()

    if (existingError) {
      if (existingError.message?.includes("does not exist") || existingError.code === "42P01") {
        return NextResponse.json({ error: "Database not set up", needsSetup: true }, { status: 503 })
      }
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    if (existing.author_id !== user.id) {
      return NextResponse.json({ error: "Only the author can edit this project" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (typeof body.title === "string") updates.title = body.title.trim()
    if (typeof body.description === "string") updates.description = body.description.trim()
    if (typeof body.language === "string") updates.language = body.language.trim()
    if (typeof body.framework === "string") updates.framework = body.framework || "None"
    if (Array.isArray(body.tags)) updates.tags = body.tags.map((t: unknown) => String(t).slice(0, 40)).slice(0, 20)
    if (typeof body.codeSnippet === "string") updates.code_snippet = body.codeSnippet
    if (typeof body.repositoryUrl === "string") updates.repository_url = body.repositoryUrl
    if (typeof body.demoUrl === "string") updates.demo_url = body.demoUrl
    if (body.files !== undefined) {
      const safeFiles = sanitizeFiles(body.files)
      if (safeFiles) updates.files = safeFiles
    }
    if (body.fileTree !== undefined) {
      const safeTree = sanitizeFileTree(body.fileTree)
      if (safeTree) updates.file_tree = safeTree
    }
    if (typeof body.repoZipUrl === "string") {
      updates.repo_zip_url = body.repoZipUrl.trim() ? body.repoZipUrl.trim().slice(0, 2000) : null
    }
    if (typeof body.is_public === "boolean") updates.is_public = body.is_public

    if (updates.title === "") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }
    if (updates.description === "") {
      return NextResponse.json({ error: "Description is required" }, { status: 400 })
    }
    if (updates.language === "") {
      return NextResponse.json({ error: "Language is required" }, { status: 400 })
    }

    const hasCode =
      typeof updates.code_snippet === "string"
        ? (updates.code_snippet as string).trim().length > 0
        : undefined
    const hasFiles = Array.isArray(updates.files) ? (updates.files as unknown[]).length > 0 : undefined
    const hasTree = Array.isArray(updates.file_tree) ? (updates.file_tree as unknown[]).length > 0 : undefined
    if (hasCode === false && hasFiles === false && hasTree === false) {
      return NextResponse.json({ error: "Add a code snippet, attach a file, or upload a project ZIP" }, { status: 400 })
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    let { data: project, error } = await supabase
      .from("developer_projects")
      .update(updates)
      .eq("id", id)
      .select(AUTHOR_SELECT)
      .single()

    // Retry without files if column missing on older schema
    if (error?.code === "PGRST204" && /files/i.test(error.message || "") && "files" in updates) {
      const { files: _files, ...withoutFiles } = updates
      ;({ data: project, error } = await supabase
        .from("developer_projects")
        .update(withoutFiles)
        .eq("id", id)
        .select(AUTHOR_SELECT)
        .single())
    }

    if (error || !project) {
      return NextResponse.json({ error: error?.message || "Failed to update project" }, { status: 500 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error("Update developer project error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: existing, error: existingError } = await supabase
      .from("developer_projects")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle()

    if (existingError) {
      if (existingError.message?.includes("does not exist") || existingError.code === "42P01") {
        return NextResponse.json({ error: "Database not set up", needsSetup: true }, { status: 503 })
      }
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    if (existing.author_id !== user.id) {
      return NextResponse.json({ error: "Only the author can delete this project" }, { status: 403 })
    }

    // Clean up related rows best-effort before delete (ignore missing-table / FK errors)
    await Promise.allSettled([
      supabase.from("project_stars").delete().eq("project_id", id),
      supabase.from("project_forks").delete().or(`original_project_id.eq.${id},forked_project_id.eq.${id}`),
    ])

    const { error } = await supabase.from("developer_projects").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete developer project error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
