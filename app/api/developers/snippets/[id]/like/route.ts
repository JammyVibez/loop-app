import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: snippet, error: findError } = await supabase
      .from("code_snippets")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle()

    if (findError || !snippet) {
      return NextResponse.json({ error: "Snippet not found" }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from("snippet_likes")
      .select("id")
      .eq("snippet_id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase.from("snippet_likes").delete().eq("id", existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from("snippet_likes").insert({ snippet_id: id, user_id: user.id })
      if (error && !/duplicate|unique/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const { count } = await supabase
      .from("snippet_likes")
      .select("id", { count: "exact", head: true })
      .eq("snippet_id", id)

    return NextResponse.json({
      success: true,
      liked: !existing,
      like_count: Number(count || 0),
    })
  } catch (error) {
    console.error("Developer snippet like error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
