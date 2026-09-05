import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity, computeReputation, canModerate, canAdmin, isOwnerRole } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

const RECOGNITION_KINDS = [
  { kind: "knowledge_keeper", label: "🧠 Knowledge Keeper", message: "For sharing knowledge that sticks." },
  { kind: "creator", label: "🎨 Creator", message: "For outstanding creative work." },
  { kind: "connector", label: "🤝 Connector", message: "For bringing people together." },
  { kind: "conversation_starter", label: "💬 Conversation Starter", message: "For sparking great discussions." },
  { kind: "organizer", label: "🧭 Organizer", message: "For organizing events and activities." },
  { kind: "top_contributor", label: "🔥 Top Contributor", message: "For exceptional overall contribution." },
]

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    const sb = communityClient()
    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get("role")
    const search = searchParams.get("search")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    let query = sb
      .from("circle_members")
      .select(`
        *,
        user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium, is_team_member, is_sponsor)
      `)
      .eq("circle_id", id)
      .neq("status", "banned")
      .order("joined_at", { ascending: false })
      .limit(limit)

    if (roleFilter) query = query.eq("role", roleFilter)
    if (search) {
      const { data: matchedProfiles } = await sb
        .from("profiles")
        .select("id")
        .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
        .limit(20)
      const ids = (matchedProfiles || []).map((p) => p.id)
      if (ids.length === 0) return NextResponse.json({ members: [] })
      query = query.in("user_id", ids)
    }

    const { data: members, error } = await query
    if (error) return NextResponse.json({ error: "Failed to load members" }, { status: 500 })

    // Recognition counts (no FK from circle_members, count separately)
    const recMap = new Map<string, number>()
    if (members && members.length > 0) {
      const { data: recs } = await sb
        .from("community_recognitions")
        .select("receiver_id")
        .eq("circle_id", id)
        .limit(2000)
      for (const r of recs || []) recMap.set(String(r.receiver_id), (recMap.get(String(r.receiver_id)) || 0) + 1)
    }

    const enriched = (members || []).map((m: any) => ({
      ...m,
      recognition_count: recMap.get(String(m.user_id)) || 0,
    }))

    return NextResponse.json({ members: enriched })
  } catch (e: any) {
    console.error("[members] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load members" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const actor = await getUserFromRequest(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const { data: actorMembership } = await sb.from("circle_members").select("role").eq("circle_id", id).eq("user_id", actor.id).maybeSingle()
    const actorRole = actorMembership?.role

    const body = await request.json()
    const { user_id, role } = body
    if (!user_id) return NextResponse.json({ error: "Missing member" }, { status: 400 })

    const { data: target } = await sb.from("circle_members").select("role, user_id").eq("circle_id", id).eq("user_id", user_id).maybeSingle()
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    // Role changes: owner only for owner/admin changes; admins can promote to moderator
    if (role && role !== target.role) {
      if (!isOwnerRole(actorRole)) {
        if (role === "admin" || role === "owner") return NextResponse.json({ error: "Only the founder can assign that role" }, { status: 403 })
        if (!canAdmin(actorRole)) return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 })
      }
      if (isOwnerRole(target.role) && !isOwnerRole(actorRole)) {
        return NextResponse.json({ error: "You can't change the founder's role" }, { status: 403 })
      }

      const { error } = await sb.from("circle_members").update({ role }).eq("circle_id", id).eq("user_id", user_id)
      if (error) return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
      await logCommunityActivity(sb, id, actor.id, "member_role_changed", "member", user_id, { from: target.role, to: role })
      return NextResponse.json({ success: true, role })
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  } catch (e: any) {
    console.error("[members] PATCH error:", e)
    return NextResponse.json({ error: e.message || "Failed to update member" }, { status: 500 })
  }
}

/** Give a recognition badge (POST { user_id, kind, message? }) */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const actor = await getUserFromRequest(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const { data: actorMembership } = await sb.from("circle_members").select("role, status").eq("circle_id", id).eq("user_id", actor.id).maybeSingle()
    if (actorMembership?.status !== "active") return NextResponse.json({ error: "Join the community first" }, { status: 403 })

    const body = await request.json()
    const { user_id, kind, message = "" } = body
    if (!user_id) return NextResponse.json({ error: "Missing member" }, { status: 400 })
    if (user_id === actor.id) return NextResponse.json({ error: "You can't recognize yourself" }, { status: 400 })

    const def = RECOGNITION_KINDS.find((k) => k.kind === kind)
    if (!def && !canModerate(actorMembership?.role)) {
      return NextResponse.json({ error: "Unknown recognition" }, { status: 400 })
    }

    const { data: target } = await sb.from("circle_members").select("id").eq("circle_id", id).eq("user_id", user_id).maybeSingle()
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    const { data: recognition, error } = await sb
      .from("community_recognitions")
      .insert({
        circle_id: id,
        giver_id: actor.id,
        receiver_id: user_id,
        kind: def?.kind || kind,
        label: def?.label || body.label || kind,
        message: message.slice(0, 300),
      })
      .select()
      .single()

    if (error || !recognition) return NextResponse.json({ error: "Failed to recognize member" }, { status: 500 })
    await logCommunityActivity(sb, id, actor.id, "recognition_given", "member", user_id, { kind: recognition.kind })

    // Slight contribution bump for the receiver
    await sb.from("circle_members").update({ contribution_score: (target as any).contribution_score || 0 }).eq("id", target.id)
    const { data: targetFull } = await sb.from("circle_members").select("contribution_score").eq("id", target.id).maybeSingle()
    await sb.from("circle_members").update({ contribution_score: (targetFull?.contribution_score || 0) + 5 }).eq("id", target.id)

    return NextResponse.json({ recognition }, { status: 201 })
  } catch (e: any) {
    console.error("[members] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to recognize member" }, { status: 500 })
  }
}