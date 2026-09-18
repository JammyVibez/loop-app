import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity } from "@/lib/community-engine"
import { can, viewerAbilities } from "@/lib/community-permissions"
import { getUserFromRequest } from "@/lib/server-auth"

/**
 * POST /api/communities/[id]/roles/assign
 * body: { user_id, role_id, action?: "assign" | "revoke" }
 *
 * Members hold any number of Powers, so this only touches one pairing at a time.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const abilities = await viewerAbilities(sb, id, user.id)
    if (!can(abilities.permissions, "power.assign")) {
      return NextResponse.json({ error: "You can't hand out Powers here" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const userId = String(body.user_id || "")
    const roleId = Number(body.role_id)
    const action = body.action === "revoke" ? "revoke" : "assign"
    if (!userId || !roleId) return NextResponse.json({ error: "Missing member or Power" }, { status: 400 })
    if (userId === user.id && action === "revoke") {
      return NextResponse.json({ error: "You can't take away your own Power" }, { status: 400 })
    }

    const { data: role } = await sb
      .from("community_roles")
      .select("id, name, is_default")
      .eq("id", roleId)
      .eq("circle_id", id)
      .maybeSingle()
    if (!role) return NextResponse.json({ error: "That Power no longer exists" }, { status: 404 })

    const { data: member } = await sb
      .from("circle_members")
      .select("user_id, status, role")
      .eq("circle_id", id)
      .eq("user_id", userId)
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "They aren't a member of this community" }, { status: 404 })

    if (action === "revoke") {
      await sb.from("community_member_roles").delete().eq("role_id", roleId).eq("user_id", userId)
    } else {
      await sb
        .from("community_member_roles")
        .upsert(
          { circle_id: Number(id), user_id: userId, role_id: roleId, assigned_by: user.id },
          { onConflict: "user_id,role_id" },
        )
    }

    await logCommunityActivity(sb, id, user.id, action === "revoke" ? "power_revoked" : "power_assigned", "member", userId, {
      power: role.name,
    })

    return NextResponse.json({ ok: true, action, role_id: roleId, user_id: userId })
  } catch (e: any) {
    console.error("[roles/assign] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to change Powers" }, { status: 500 })
  }
}
