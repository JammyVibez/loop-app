import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

async function getUserFromToken(token: string) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// POST: Publish/unpublish a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { subdomain, publish } = body

    // Verify ownership
    const { data: project, error: projErr } = await supabase
      .from("developer_projects")
      .select("id, author_id, is_published, subdomain")
      .eq("id", id)
      .single()

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

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

    // Publish with subdomain
    const slug = (subdomain || "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "")

    if (!slug || slug.length < 3) {
      return NextResponse.json({ error: "Subdomain must be at least 3 characters (letters, numbers, hyphens only)" }, { status: 400 })
    }

    if (slug.length > 63) {
      return NextResponse.json({ error: "Subdomain must be 63 characters or fewer" }, { status: 400 })
    }

    // Reserved subdomains
    const reserved = ["www", "api", "admin", "mail", "app", "docs", "help", "status", "blog", "dev", "staging", "test"]
    if (reserved.includes(slug)) {
      return NextResponse.json({ error: "This subdomain is reserved" }, { status: 400 })
    }

    // Check if subdomain is taken
    const { data: existing } = await supabase
      .from("developer_projects")
      .select("id")
      .eq("subdomain", slug)
      .neq("id", id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "This subdomain is already taken" }, { status: 409 })
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
      url: `https://${slug}.loopapp.me`,
      subdomain: slug,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
