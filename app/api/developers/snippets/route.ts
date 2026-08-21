import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const VALID_LANGUAGES = new Set([
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C++",
  "C#",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "SQL",
  "Bash",
  "HTML",
  "CSS",
  "Other",
])

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const language = searchParams.get("language")
    const q = (searchParams.get("q") || "").trim().toLowerCase()
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100)

    const supabase = createServerClient()
    const user = await getUserFromRequest(request)

    let query = supabase
      .from("code_snippets")
      .select(
        `
        *,
        author:profiles!code_snippets_author_id_fkey(
          id, username, display_name, avatar_url, video_avatar_url, is_verified
        )
      `,
      )
      .eq("is_public", true)

    if (language && language !== "All") query = query.eq("language", language)

    const { data: snippets, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = snippets || []

    // View counts + like state for the current viewer (single batch query).
    let likedIds = new Set<string>()
    let likeCounts = new Map<string, number>()
    if (rows.length) {
      const ids = rows.map((s: any) => s.id)
      const { data: likes } = await supabase
        .from("snippet_likes")
        .select("snippet_id, user_id")
        .in("snippet_id", ids)

      for (const like of likes || []) {
        likeCounts.set(like.snippet_id, (likeCounts.get(like.snippet_id) || 0) + 1)
        if (user && like.user_id === user.id) likedIds.add(like.snippet_id)
      }
    }

    const processed = rows.map((snippet: any) => ({
      ...snippet,
      like_count: likeCounts.get(snippet.id) || Number(snippet.likes || 0),
      is_liked: likedIds.has(snippet.id),
    }))

    return NextResponse.json({ success: true, snippets: processed })
  } catch (error) {
    console.error("Developer snippets GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const title = String(body.title || "").trim()
    const code = String(body.code || "")
    const language = String(body.language || "").trim()
    const description = String(body.description || "").trim()
    const tags = Array.isArray(body.tags)
      ? body.tags.map(String).filter(Boolean).slice(0, 8)
      : []

    if (!title || !code) {
      return NextResponse.json({ error: "title and code are required" }, { status: 400 })
    }
    if (title.length > 140) {
      return NextResponse.json({ error: "Title is too long" }, { status: 400 })
    }
    if (code.length > 50_000) {
      return NextResponse.json({ error: "Snippet is too large (50KB max)" }, { status: 400 })
    }
    if (!VALID_LANGUAGES.has(language)) {
      return NextResponse.json(
        { error: `language must be one of: ${[...VALID_LANGUAGES].join(", ")}` },
        { status: 400 },
      )
    }

    const supabase = createServerClient()
    const { data: snippet, error } = await supabase
      .from("code_snippets")
      .insert({
        author_id: user.id,
        title: title.slice(0, 140),
        description: description || null,
        language,
        code,
        tags,
        is_public: body.is_public !== false,
      })
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

    return NextResponse.json({ success: true, snippet }, { status: 201 })
  } catch (error) {
    console.error("Developer snippets POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
