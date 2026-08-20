import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const { data: project, error } = await supabase
      .from("developer_projects")
      .select("id, title, description, author_id, language, framework, subdomain, is_published")
      .eq("subdomain", slug)
      .eq("is_published", true)
      .maybeSingle()

    if (error || !project) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
