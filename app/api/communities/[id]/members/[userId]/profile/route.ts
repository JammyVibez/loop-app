import { type NextRequest, NextResponse } from "next/server"
import { communityClient } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/communities/[id]/members/[userId]/profile
 *
 * Everything a mini profile shows, in one round trip: their base role and
 * Powers, the about text, how many threads they have started here, and the
 * badges/cosmetics the card decorates itself with. Private communities still
 * require membership, so the popover cannot be used to scout a closed world.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const { id, userId } = await params
    const viewer = await getUserFromRequest(request)
    const sb = communityClient()

    const { data: circle } = await sb
      .from("circles")
      .select("id, is_private")
      .eq("id", id)
      .maybeSingle()
    if (!circle) return NextResponse.json({ error: "Community not found" }, { status: 404 })

    if (circle.is_private && viewer) {
      const { data: viewerMember } = await sb
        .from("circle_members")
        .select("status")
        .eq("circle_id", id)
        .eq("user_id", viewer.id)
        .maybeSingle()
      if (!viewerMember || !["active", "approved"].includes(String(viewerMember.status || ""))) {
        return NextResponse.json({ error: "This community is private" }, { status: 403 })
      }
    }

    const [{ data: member }, { data: profile }] = await Promise.all([
      sb
        .from("circle_members")
        .select("role, status, contribution_score, joined_at")
        .eq("circle_id", id)
        .eq("user_id", userId)
        .maybeSingle(),
      sb
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, bio, is_verified, is_premium, equipped_frame_id",
        )
        .eq("id", userId)
        .maybeSingle(),
    ])

    if (!profile) return NextResponse.json({ error: "That member no longer exists" }, { status: 404 })

    // Powers (custom roles) held in this community.
    const { data: roleRows } = await sb
      .from("community_member_roles")
      .select("role_id, community_roles:community_roles(id, name, color, icon)")
      .eq("circle_id", id)
      .eq("user_id", userId)
      .limit(8)

    const powers = (roleRows || []).flatMap((row: any) => {
      const role = Array.isArray(row.community_roles) ? row.community_roles[0] : row.community_roles
      return role ? [{ id: String(role.id), name: role.name, color: role.color || null, icon: role.icon || null }] : []
    })

    const { count: postCount } = await sb
      .from("circle_posts")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", id)
      .eq("author_id", userId)
      .neq("status", "hidden")

    return NextResponse.json({
      profile,
      membership: member
        ? {
            role: member.role || null,
            status: member.status || null,
            contribution_score: Number(member.contribution_score || 0),
            joined_at: member.joined_at || null,
          }
        : null,
      powers,
      post_count: postCount || 0,
    })
  } catch (e: any) {
    console.error("[mini-profile] GET error:", e)
    return NextResponse.json({ error: e.message || "Could not load profile" }, { status: 500 })
  }
}