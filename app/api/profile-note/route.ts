import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import {
  NOTE_SURFACES,
  type NoteSurface,
  type NoteVisibility,
  isNoteLengthValid,
  sanitizeNoteText,
  surfaceColumn,
  visibilityFlags,
} from "@/lib/profile-note"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

const SELECT_COLUMNS =
  "id, user_id, content, show_on_profile, show_on_posts, show_on_communities, created_at, expires_at"

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
      .select("id")
      .eq("username", username)
      .maybeSingle()
    if (!profile?.id) return NextResponse.json({ note: null, notes: [] })
    userIds = [String(profile.id)]
  } else {
    return NextResponse.json({ error: "user_id, username or user_ids is required" }, { status: 400 })
  }

  if (!userIds.length) return NextResponse.json({ note: null, notes: [] })

  const { data, error } = await supabase
    .from("profile_notes")
    .select(SELECT_COLUMNS)
    .in("user_id", userIds)
    .eq(surfaceColumn(surface), true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (error) {
    // A missing table (migration not applied yet) must not break profiles —
    // the note simply isn't there.
    return NextResponse.json({ note: null, notes: [] })
  }

  const notes = (data || []) as any[]
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
  const { data, error } = await supabase
    .from("profile_notes")
    .upsert(
      {
        user_id: user.id,
        content,
        ...flags,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "user_id" },
    )
    .select(SELECT_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json(
      { error: "We couldn't save your note just now. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ note: data })
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
