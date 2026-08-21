import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: existing, error: findError } = await supabase
      .from("code_snippets")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle()

    if (findError || !existing) {
      return NextResponse.json({ error: "Snippet not found" }, { status: 404 })
    }
    if (existing.author_id !== user.id) {
      return NextResponse.json({ error: "Only the author can edit this snippet" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (typeof body.title === "string" && body.title.trim()) {
      if (body.title.trim().length > 140) {
        return NextResponse.json({ error: "Title is too long" }, { status: 400 })
      }
      updates.title = body.title.trim()
    }
    if (typeof body.description === "string") {
      updates.description = body.description.trim() || null
    }
    if (typeof body.code === "string") {
      if (body.code.length > 50_000) {
        return NextResponse.json({ error: "Snippet is too large (50KB max)" }, { status: 400 })
      }
      updates.code = body.code
    }
    if (typeof body.language === "string" && body.language.trim()) {
      updates.language = body.language.trim()
    }
    if (Array.isArray(body.tags)) {
      updates.tags = body.tags.map(String).filter(Boolean).slice(0, 8)
    }
    if (typeof body.is_public === "boolean") {
      updates.is_public = body.is_public
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data: snippet, error } = await supabase
      .from("code_snippets")
      .update(updates)
      .eq("id", id)
      .select(
        `
        *,
        author:profiles!code_snippets_author_id_fkey(
          id, username, display_name, avatar_url, video_avatar_url, is_verified
        )
      `,
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, snippet })
  } catch (error) {
    console.error("Developer snippet PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: existing, error: findError } = await supabase
      .from("code_snippets")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle()

    if (findError || !existing) {
      return NextResponse.json({ error: "Snippet not found" }, { status: 404 })
    }
    if (existing.author_id !== user.id) {
      return NextResponse.json({ error: "Only the author can delete this snippet" }, { status: 403 })
    }

    await supabase.from("snippet_likes").delete().eq("snippet_id", id)

    const { error } = await supabase.from("code_snippets").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Developer snippet DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
