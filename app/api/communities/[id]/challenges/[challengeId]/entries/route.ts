import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity, canModerate } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; challengeId: string }> }) {
  try {
    const { id, challengeId } = await params
    const user = await getUserFromRequest(request)
    const sb = communityClient()

    const { data: challenge } = await sb.from("circle_challenges").select("id").eq("id", challengeId).eq("circle_id", id).maybeSingle()
    if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 })

    const { data: entries, error } = await sb
      .from("community_challenge_entries")
      .select(`
        *,
        author:profiles!user_id(id, username, display_name, avatar_url, is_verified),
        votes:community_challenge_votes(user_id)
      `)
      .eq("challenge_id", challengeId)
      .order("vote_count", { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: "Failed to load entries" }, { status: 500 })

    const enriched = (entries || []).map((e: any) => ({
      ...e,
      has_voted: Boolean(user && (e.votes || []).some((v: any) => v.user_id === user.id)),
      votes: undefined,
    }))

    return NextResponse.json({ entries: enriched })
  } catch (e: any) {
    console.error("[entries] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load entries" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; challengeId: string }> }) {
  try {
    const { id, challengeId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to submit" }, { status: 401 })
    const sb = communityClient()

    const { data: membership } = await sb.from("circle_members").select("status").eq("circle_id", id).eq("user_id", user.id).maybeSingle()
    if (membership?.status !== "active") return NextResponse.json({ error: "Join the community first" }, { status: 403 })

    const { data: challenge } = await sb
      .from("circle_challenges")
      .select("id, status, ends_at")
      .eq("id", challengeId)
      .eq("circle_id", id)
      .maybeSingle()
    if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    if (challenge.status !== "active") return NextResponse.json({ error: "This challenge has ended" }, { status: 400 })
    if (challenge.ends_at && new Date(challenge.ends_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "This challenge has ended" }, { status: 400 })
    }

    const body = await request.json()
    const { action, content = "", media_url } = body

    // Vote on an entry
    if (action === "vote") {
      const entryId = body.entry_id
      const { data: entry } = await sb.from("community_challenge_entries").select("id, vote_count, user_id").eq("id", entryId).eq("challenge_id", challengeId).maybeSingle()
      if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

      // Toggle vote
      const { data: existing } = await sb.from("community_challenge_votes").select("id").eq("entry_id", entryId).eq("user_id", user.id).maybeSingle()
      if (existing) {
        await sb.from("community_challenge_votes").delete().eq("id", existing.id)
        await sb.from("community_challenge_entries").update({ vote_count: Math.max(0, (entry.vote_count || 0) - 1) }).eq("id", entryId)
        return NextResponse.json({ success: true, voted: false, vote_count: Math.max(0, (entry.vote_count || 0) - 1) })
      }

      await sb.from("community_challenge_votes").insert({ entry_id: entryId, user_id: user.id })
      await sb.from("community_challenge_entries").update({ vote_count: (entry.vote_count || 0) + 1 }).eq("id", entryId)
      await logCommunityActivity(sb, id, user.id, "challenge_vote", "challenge_entry", entryId)
      return NextResponse.json({ success: true, voted: true, vote_count: (entry.vote_count || 0) + 1 })
    }

    // Submit an entry
    if (!content.trim() && !media_url) return NextResponse.json({ error: "Add some content or media" }, { status: 400 })
    const { data: entry, error } = await sb
      .from("community_challenge_entries")
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        content: content.slice(0, 2000),
        media_url: media_url || null,
      })
      .select()
      .single()

    if (error || !entry) return NextResponse.json({ error: "Failed to submit entry" }, { status: 500 })
    await logCommunityActivity(sb, id, user.id, "challenge_entry", "challenge_entry", entry.id, { challenge_id: challengeId })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (e: any) {
    console.error("[entries] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to submit" }, { status: 500 })
  }
}