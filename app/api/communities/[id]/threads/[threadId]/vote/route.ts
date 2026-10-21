import { type NextRequest, NextResponse } from "next/server"
import { communityClient } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

/**
 * Upvote a thread. One vote per member, toggled on a second tap, and the
 * thread's cached like_count is kept in step so the forum list stays honest.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to vote" }, { status: 401 })

    const sb = communityClient()

    const { data: membership } = await sb
      .from("circle_members")
      .select("status")
      .eq("circle_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!membership || !["active", "approved"].includes(String(membership.status || ""))) {
      return NextResponse.json({ error: "Join this community to vote" }, { status: 403 })
    }

    const { data: post } = await sb
      .from("circle_posts")
      .select("id, like_count")
      .eq("id", threadId)
      .eq("circle_id", id)
      .maybeSingle()
    if (!post) return NextResponse.json({ error: "Thread not found" }, { status: 404 })

    const { data: existing } = await sb
      .from("circle_post_interactions")
      .select("id")
      .eq("post_id", threadId)
      .eq("user_id", user.id)
      .eq("interaction_type", "upvote")
      .maybeSingle()

    let voted: boolean
    if (existing) {
      await sb.from("circle_post_interactions").delete().eq("id", existing.id)
      voted = false
    } else {
      const { error } = await sb.from("circle_post_interactions").insert({
        post_id: threadId,
        user_id: user.id,
        interaction_type: "upvote",
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      voted = true
    }

    // Recount instead of incrementing — two fast taps can race.
    const { count } = await sb
      .from("circle_post_interactions")
      .select("id", { count: "exact", head: true })
      .eq("post_id", threadId)
      .eq("interaction_type", "upvote")

    const votes = count || 0
    await sb.from("circle_posts").update({ like_count: votes }).eq("id", threadId)

    return NextResponse.json({ voted, votes })
  } catch (e: any) {
    console.error("[thread/vote] error:", e)
    return NextResponse.json({ error: e.message || "Failed to vote" }, { status: 500 })
  }
}
