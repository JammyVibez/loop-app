import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Show or hide one of your own posts on your profile.
 *
 * This is presentation, not moderation: the Loop stays in the feed, in search,
 * and in replies — it just stops appearing on the author's profile grid. The
 * flag lives in `content_metadata` so it needs no schema change.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to change your profile" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const hidden = Boolean(body?.hidden)

    const supabase = createServerClient()
    const { data: loop, error } = await supabase
      .from("loops")
      .select("id, author_id, content_metadata")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      console.error("[profile-visibility] lookup failed:", error.message)
      return NextResponse.json({ error: "Could not find that post" }, { status: 500 })
    }
    if (!loop) return NextResponse.json({ error: "Post not found" }, { status: 404 })
    if (String(loop.author_id) !== user.id) {
      return NextResponse.json({ error: "Only the author can change this" }, { status: 403 })
    }

    const metadata =
      loop.content_metadata && typeof loop.content_metadata === "object"
        ? { ...(loop.content_metadata as Record<string, unknown>) }
        : {}

    if (hidden) metadata.profile_hidden = true
    else delete metadata.profile_hidden

    const { error: updateError } = await supabase
      .from("loops")
      .update({ content_metadata: metadata })
      .eq("id", id)

    if (updateError) {
      console.error("[profile-visibility] update failed:", updateError.message)
      return NextResponse.json({ error: "Could not update your profile" }, { status: 500 })
    }

    return NextResponse.json({ success: true, hidden })
  } catch (error: any) {
    console.error("[profile-visibility] error:", error)
    return NextResponse.json({ error: error?.message || "Failed to update post" }, { status: 500 })
  }
}
