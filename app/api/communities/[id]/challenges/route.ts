import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity, canModerate } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"
import { checkCirclePrivateAccess } from "@/lib/circle-access"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const access = await checkCirclePrivateAccess(id, request.headers.get("authorization"))
    if (access.isPrivate && !access.canView) {
      return NextResponse.json({ error: "This Circle is private", locked: true }, { status: 403 })
    }
    const sb = communityClient()

    const { data: challenges, error } = await sb
      .from("circle_challenges")
      .select(`
        *,
        entries:community_challenge_entries(count),
        participants:community_challenge_entries(user_id),
        creator:profiles!created_by(id, username, display_name, avatar_url, is_verified)
      `)
      .eq("circle_id", id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: "Failed to load challenges" }, { status: 500 })

    const enriched = (challenges || []).map((c: any) => {
      const entryRows = c.participants || []
      const uniqueParticipants = new Set(entryRows.map((e: any) => e.user_id)).size
      return {
        ...c,
        entry_count: Number(Array.isArray(c.entries) ? c.entries[0]?.count : c.entries || 0),
        participant_count: uniqueParticipants,
        entries: undefined,
        participants: undefined,
      }
    })

    return NextResponse.json({ challenges: enriched })
  } catch (e: any) {
    console.error("[challenges] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load challenges" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to create a challenge" }, { status: 401 })
    const sb = communityClient()

    const { data: membership } = await sb.from("circle_members").select("role, status").eq("circle_id", id).eq("user_id", user.id).maybeSingle()
    if (membership?.status !== "active") return NextResponse.json({ error: "Join the community first" }, { status: 403 })

    const body = await request.json()
    const { title, description = "", challenge_type = "standard", reward_coins = 0, starts_at, ends_at } = body
    if (!title || !title.trim()) return NextResponse.json({ error: "Challenge needs a title" }, { status: 400 })

    const { data: challenge, error } = await sb
      .from("circle_challenges")
      .insert({
        circle_id: id,
        title: title.trim().slice(0, 120),
        description: description.slice(0, 2000),
        challenge_type,
        reward_coins: Math.max(0, Number(reward_coins) || 0),
        starts_at: starts_at ? new Date(starts_at).toISOString() : new Date().toISOString(),
        ends_at: ends_at ? new Date(ends_at).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
        created_by: user.id,
        status: "active",
      })
      .select()
      .single()

    if (error || !challenge) {
      return NextResponse.json({ error: "Failed to create challenge: " + (error?.message || "") }, { status: 500 })
    }

    await logCommunityActivity(sb, id, user.id, "challenge_created", "challenge", challenge.id, { title: challenge.title })
    return NextResponse.json({ challenge }, { status: 201 })
  } catch (e: any) {
    console.error("[challenges] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to create challenge" }, { status: 500 })
  }
}