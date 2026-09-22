import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const MAX_CONTENT = 40_000
const MAX_VERSIONS_LISTED = 100

type CoAuthorEntry = { id?: string; username?: string; display_name?: string; avatar_url?: string | null }

function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 20)
}

function normalizeCoAuthors(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is CoAuthorEntry => Boolean(entry) && typeof entry === "object")
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      username: entry.username,
      display_name: entry.display_name || entry.username,
      avatar_url: entry.avatar_url ?? null,
      role: "Co-Author",
    }))
}

function normalizeMediaUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((url): url is string => typeof url === "string" && url.length > 0).slice(0, 4)
}

/** Confirm the caller owns or co-authors the session before letting them write history. */
async function canWriteToSession(supabase: any, sessionId: string, userId: string) {
  const { data: session } = await supabase
    .from("co_loop_sessions")
    .select("owner_id, co_authors")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (!session) return true // session record not written yet; the owner creates it on first sync
  if (session.owner_id === userId) return true
  return (Array.isArray(session.co_authors) ? session.co_authors : []).some((c: any) => c?.id === userId)
}

/**
 * GET – list the shared, durable version timeline for a session.
 * Query: ?session_id=…  (the session UUID or the studio's text session id)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id") || searchParams.get("session")
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("co_loop_versions")
      .select("*")
      .eq("session_id", sessionId)
      .order("version_number", { ascending: false })
      .limit(MAX_VERSIONS_LISTED)

    if (error) {
      // The table may not be migrated yet on an older deployment — degrade to
      // an empty timeline rather than breaking the studio.
      console.warn("co_loop_versions select failed:", error.message)
      return NextResponse.json({ success: true, versions: [], degraded: true })
    }

    return NextResponse.json({ success: true, versions: data || [] })
  } catch (error: any) {
    console.error("Co-Loop versions GET error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

/** POST – snapshot the current draft into the session's shared timeline. */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const body = await request.json()

    const sessionId = body.session_id || body.sessionId
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }

    if (!(await canWriteToSession(supabase, sessionId, user.id))) {
      return NextResponse.json({ error: "You are not a collaborator on this Co-Loop" }, { status: 403 })
    }

    const content = typeof body.content === "string" ? body.content.slice(0, MAX_CONTENT) : ""
    const title = typeof body.title === "string" ? body.title.slice(0, 300) : ""
    if (!content.trim() && !title.trim()) {
      return NextResponse.json({ error: "Nothing to snapshot yet" }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()

    // Allocate the next version number server-side so two collaborators
    // snapshotting at the same moment cannot collide on the unique key.
    const { data: latest } = await supabase
      .from("co_loop_versions")
      .select("version_number")
      .eq("session_id", sessionId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle()

    const versionNumber = Number(latest?.version_number || 0) + 1
    const mediaUrls = normalizeMediaUrls(body.media_urls)
    const mediaType = ["text", "image", "video"].includes(body.media_type) ? body.media_type : "text"

    const { data: inserted, error: insertError } = await supabase
      .from("co_loop_versions")
      .insert({
        session_id: sessionId,
        version_number: versionNumber,
        title,
        content,
        hashtags: normalizeHashtags(body.hashtags),
        media_url: typeof body.media_url === "string" && body.media_url ? body.media_url : mediaUrls[0] || null,
        media_urls: mediaUrls,
        media_type: mediaType,
        co_authors: normalizeCoAuthors(body.co_authors),
        label:
          typeof body.label === "string" && body.label.trim()
            ? body.label.trim().slice(0, 120)
            : versionNumber === 1
              ? "Initial Draft"
              : `Checkpoint #${versionNumber}`,
        saved_by_id: user.id,
        saved_by_name: profile?.display_name || profile?.username || user.email?.split("@")[0] || "Collaborator",
        saved_by_avatar: profile?.avatar_url || null,
      })
      .select("*")
      .single()

    if (insertError) {
      console.error("co_loop_versions insert failed:", insertError)
      return NextResponse.json({ error: "Could not save this snapshot" }, { status: 500 })
    }

    return NextResponse.json({ success: true, version: inserted })
  } catch (error: any) {
    console.error("Co-Loop versions POST error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
