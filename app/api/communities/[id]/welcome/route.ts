import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

/**
 * Post-join onboarding: the member picks the spaces they want to follow and
 * their interests. Stored on their circle_members row so the world can
 * personalize the feed and future highlights.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sb = communityClient()
    const body = await request.json().catch(() => ({}))

    const { data: membership, error: membershipError } = await sb
      .from("circle_members")
      .select("id, role, status")
      .eq("circle_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (membershipError || !membership) {
      return NextResponse.json({ error: "Join the community first" }, { status: 403 })
    }

    const interests = Array.isArray(body.interests)
      ? (body.interests as unknown[]).map((i) => String(i || "").trim().slice(0, 40)).filter(Boolean).slice(0, 8)
      : []

    let followedSpaces: number[] = []
    if (Array.isArray(body.followed_spaces)) {
      const raw = (body.followed_spaces as unknown[]).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0)
      if (raw.length) {
        const { data: owned } = await sb
          .from("community_spaces")
          .select("id")
          .eq("circle_id", id)
          .eq("is_archived", false)
          .in("id", raw)
        const valid = new Set((owned || []).map((s) => Number(s.id)))
        followedSpaces = raw.filter((s) => valid.has(s))
      }
    }

    const { data: updated, error } = await sb
      .from("circle_members")
      .update({
        interests,
        followed_spaces: followedSpaces,
        welcome_completed_at: body.completed === false ? null : new Date().toISOString(),
      })
      .eq("circle_id", id)
      .eq("user_id", user.id)
      .select("interests, followed_spaces, welcome_completed_at, role")
      .single()

    if (error) return NextResponse.json({ error: "Failed to save your preferences" }, { status: 500 })

    await logCommunityActivity(sb, id, user.id, "member_onboarded", "member", user.id, {
      interests: interests.length,
      spaces: followedSpaces.length,
    })

    return NextResponse.json({ success: true, prefs: updated })
  } catch (e: any) {
    console.error("[welcome] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to save preferences" }, { status: 500 })
  }
}
