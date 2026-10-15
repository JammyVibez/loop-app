import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import {
  DEFAULT_NOTE_THEME,
  NOTE_SURFACES,
  type NoteSurface,
  type NoteVisibility,
  canViewProfileNote,
  isNoteLengthValid,
  isNoteTheme,
  sanitizeNoteText,
  surfaceColumn,
  visibilityFlags,
} from "@/lib/profile-note"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

// Columns that have existed since the feature shipped.
const BASE_COLUMNS =
  "id, user_id, content, show_on_profile, show_on_posts, show_on_communities, created_at, expires_at"
const SELECT_COLUMNS = `${BASE_COLUMNS}, theme`

/**
 * Read notes for a set of authors on one surface.
 *
 * `theme` arrived with the colour picker, so a database that hasn't run the
 * migration yet must still hand back its notes: the fallback query drops the
 * new column and paints everything in the default palette rather than hiding
 * every note on the site.
 */
async function selectNotes(userIds: string[], surface: NoteSurface) {
  const query = (columns: string) =>
    supabase
      .from("profile_notes")
      .select(columns)
      .in("user_id", userIds)
      .eq(surfaceColumn(surface), true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })

  const { data, error } = await query(SELECT_COLUMNS)
  if (!error) return (data || []) as any[]

  const fallback = await query(BASE_COLUMNS)
  return ((fallback.data || []) as any[]).map((row) => ({ ...row, theme: DEFAULT_NOTE_THEME }))
}

function isSurface(value: unknown): value is NoteSurface {
  return typeof value === "string" && (NOTE_SURFACES as readonly string[]).includes(value)
}

/**
 * Read notes for a surface. Accepts `user_id`, `username`, or a batch
 * `user_ids=a,b,c` so a feed can hydrate a page of cards in one call.
 */
async function handleGet(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const surfaceParam = params.get("surface")
  const surface: NoteSurface = isSurface(surfaceParam) ? surfaceParam : "profile"

  const userIdsParam = (params.get("user_ids") || "").trim()
  const singleUserId = (params.get("user_id") || "").trim()
  const username = (params.get("username") || "").trim()

  let userIds: string[] = []
  if (userIdsParam) {
    userIds = userIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50)
  } else if (singleUserId) {
    userIds = [singleUserId]
  } else if (username) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, privacy_settings")
      .eq("username", username)
      .maybeSingle()
    if (!profile?.id) return NextResponse.json({ note: null, notes: [] })

    // A private or followers-only profile hides its bio from strangers, so it
    // must hide its note too — the note sits on the same page, and leaking it
    // would undercut the privacy setting it is supposed to respect.
    const visibility = (profile as any)?.privacy_settings?.profile_visibility
    if (visibility === "private" || visibility === "followers") {
      const viewer = await getUserFromRequest(request)
      const isOwner = Boolean(viewer && viewer.id === profile.id)
      const isFollower =
        viewer && !isOwner
          ? Boolean(
              (
                await supabase
                  .from("follows")
                  .select("id")
                  .eq("follower_id", viewer.id)
                  .eq("following_id", profile.id)
                  .maybeSingle()
              ).data,
            )
          : false
      const allowed = canViewProfileNote({
        visibility,
        viewerId: viewer?.id || null,
        ownerId: String(profile.id),
        isFollower,
      })
      if (!allowed) return NextResponse.json({ note: null, notes: [] })
    }

    userIds = [String(profile.id)]
  } else {
    return NextResponse.json({ error: "user_id, username or user_ids is required" }, { status: 400 })
  }

  if (!userIds.length) return NextResponse.json({ note: null, notes: [] })

  // A missing table (migration not applied yet) must not break profiles — the
  // note simply isn't there.
  let notes: any[] = []
  try {
    notes = await selectNotes(userIds, surface)
  } catch {
    notes = []
  }

  // One note per account, but be defensive about the batch shape.
  const deduped = new Map<string, any>()
  for (const note of notes) if (!deduped.has(note.user_id)) deduped.set(note.user_id, note)

  return NextResponse.json({
    note: deduped.get(userIds[0]) || null,
    notes: [...deduped.values()],
  })
}

/** Create or replace the signed-in user's note. */
async function handlePost(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const rawContent = typeof body?.content === "string" ? body.content : ""
  if (!isNoteLengthValid(rawContent)) {
    return NextResponse.json(
      { error: "A note is 1–60 characters." },
      { status: 400 },
    )
  }
  const content = sanitizeNoteText(rawContent)

  const requestedTheme = body?.theme
  if (requestedTheme !== undefined && requestedTheme !== null && !isNoteTheme(requestedTheme)) {
    return NextResponse.json({ error: "That note colour isn't available." }, { status: 400 })
  }
  const theme = isNoteTheme(requestedTheme) ? requestedTheme : DEFAULT_NOTE_THEME

  const requested: Partial<NoteVisibility> = body?.visibility || {}
  const flags = visibilityFlags({
    profile: requested.profile !== false,
    posts: requested.posts !== false,
    communities: requested.communities !== false,
  })
  if (!flags.show_on_profile && !flags.show_on_posts && !flags.show_on_communities) {
    return NextResponse.json(
      { error: "Pick at least one place to show your note — or delete it." },
      { status: 400 },
    )
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const payload = {
    user_id: user.id,
    content,
    theme,
    ...flags,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  }

  const { data, error } = await supabase
    .from("profile_notes")
    .upsert(payload, { onConflict: "user_id" })
    .select(SELECT_COLUMNS)
    .single()

  if (!error) return NextResponse.json({ note: data })

  // Pre-migration database: losing the colour is survivable, losing the note
  // is not — retry with the columns that certainly exist.
  const { theme: _dropped, ...withoutTheme } = payload
  const retry = await supabase
    .from("profile_notes")
    .upsert(withoutTheme, { onConflict: "user_id" })
    .select(BASE_COLUMNS)
    .single()

  if (retry.error) {
    return NextResponse.json(
      { error: "We couldn't save your note just now. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ note: { ...retry.data, theme: DEFAULT_NOTE_THEME } })
}

/** Remove the signed-in user's note. */
async function handleDelete(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase.from("profile_notes").delete().eq("user_id", user.id)
  if (error) {
    return NextResponse.json({ error: "We couldn't delete your note just now." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
  try {
    return await handleGet(request)
  } catch (error) {
    console.error("profile-note GET failed:", error)
    return NextResponse.json({ note: null, notes: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handlePost(request)
  } catch (error) {
    console.error("profile-note POST failed:", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return await handleDelete(request)
  } catch (error) {
    console.error("profile-note DELETE failed:", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
