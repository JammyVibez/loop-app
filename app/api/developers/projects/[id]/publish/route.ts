import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.loopapp.me"

async function getUser(request: NextRequest) {
  const supabase = createServerClient()
  const user = await getUserFromRequest(request)
  return user || null
}

// POST: Publish/unpublish a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { subdomain, publish } = body

    const supabase = createServerClient()

    // Verify ownership
    const { data: project, error: projErr } = await supabase
      .from("developer_projects")
      .select("id, author_id, is_published, subdomain")
      .eq("id", id)
      .maybeSingle()

    if (projErr) {
      if (projErr.message?.includes("does not exist") || projErr.code === "42P01") {
        return NextResponse.json({ error: "Database not set up", needsSetup: true }, { status: 503 })
      }
      return NextResponse.json({ error: projErr.message }, { status: 500 })
    }
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    if (project.author_id !== user.id) {
      return NextResponse.json({ error: "Only the author can publish" }, { status: 403 })
    }

    // Unpublish
    if (publish === false) {
      const { error } = await supabase
        .from("developer_projects")
        .update({ is_published: false, subdomain: null })
        .eq("id", id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, published: false })
    }

    // Publish with slug (path-based, not subdomain)
    const slug = (subdomain || project.subdomain || "").toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

    if (!slug || slug.length < 3) {
      return NextResponse.json({ error: "Slug must be at least 3 characters (letters, numbers, hyphens only)" }, { status: 400 })
    }

    if (slug.length > 63) {
      return NextResponse.json({ error: "Slug must be 63 characters or fewer" }, { status: 400 })
    }

    // Reserved slugs
    const reserved = ["www", "api", "admin", "mail", "app", "docs", "help", "status", "blog", "dev", "staging", "test", "auth", "settings", "developers", "preview"]
    if (reserved.includes(slug)) {
      return NextResponse.json({ error: "This slug is reserved" }, { status: 400 })
    }

    // Check if slug is taken by another project
    const { data: existing } = await supabase
      .from("developer_projects")
      .select("id")
      .eq("subdomain", slug)
      .neq("id", id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "This slug is already taken" }, { status: 409 })
    }

    // Publish
    const { error } = await supabase
      .from("developer_projects")
      .update({ is_published: true, subdomain: slug })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      published: true,
      url: `${SITE_URL}/app/${slug}`,
      subdomain: slug,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
