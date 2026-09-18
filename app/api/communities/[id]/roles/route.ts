import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity } from "@/lib/community-engine"
import {
  POWER_COLORS,
  can,
  ensureStarterPowers,
  isPermissionKey,
  listPowers,
  normalizePermissions,
  viewerAbilities,
} from "@/lib/community-permissions"
import { getUserFromRequest } from "@/lib/server-auth"

function cleanPermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(new Set(raw.map((r) => String(r)).filter((r) => isPermissionKey(r))))
}

function cleanColor(raw: unknown): string {
  const value = String(raw || "").trim()
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : POWER_COLORS[0]
}

/**
 * GET /api/communities/[id]/roles
 *
 * Returns every Power with its member count plus the raw assignments, so the UI
 * can show "who holds this" and put chips on member rows without a second call.
 * An admin opening a community that has none yet gets the starter set seeded —
 * same first-visit seeding pattern the spaces system already uses.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    const sb = communityClient()

    const { data: circle } = await sb.from("circles").select("id, is_private").eq("id", id).maybeSingle()
    if (!circle) return NextResponse.json({ error: "Community not found" }, { status: 404 })

    const abilities = await viewerAbilities(sb, id, user?.id || null)
    if (circle.is_private && !abilities.is_member) {
      return NextResponse.json({ error: "This community is private", locked: true }, { status: 403 })
    }

    if (abilities.is_admin) await ensureStarterPowers(sb, id, user?.id || null)

    const payload = await listPowers(sb, id)
    return NextResponse.json({
      ...payload,
      can_assign: can(abilities.permissions, "power.assign"),
      can_edit: can(abilities.permissions, "power.assign"),
      viewer_powers: abilities.powers.map((p) => p.id),
      viewer_permissions: Array.from(abilities.permissions),
    })
  } catch (e: any) {
    console.error("[roles] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load Powers" }, { status: 500 })
  }
}

/** POST — create a Power. */
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
    const name = String(body.name || "").trim().slice(0, 32)
    if (name.length < 2) return NextResponse.json({ error: "Give the Power a name" }, { status: 400 })

    const { data: existing } = await sb
      .from("community_roles")
      .select("id")
      .eq("circle_id", id)
      .ilike("name", name)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: "A Power with that name already exists" }, { status: 409 })

    const { data: role, error } = await sb
      .from("community_roles")
      .insert({
        circle_id: Number(id),
        name,
        description: String(body.description || "").trim().slice(0, 240),
        color: cleanColor(body.color),
        icon: String(body.icon || "shield").slice(0, 24),
        permissions: cleanPermissions(body.permissions),
        priority: Math.max(0, Math.min(100, Number(body.priority) || 0)),
        is_default: Boolean(body.is_default),
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !role) {
      return NextResponse.json({ error: "Failed to create Power: " + (error?.message || "") }, { status: 500 })
    }

    // A new default Power applies to everyone who is already here.
    if (role.is_default) {
      const { data: members } = await sb.from("circle_members").select("user_id").eq("circle_id", id).neq("status", "banned")
      const rows = (members || []).map((m: any) => ({
        circle_id: Number(id),
        user_id: m.user_id,
        role_id: role.id,
        assigned_by: user.id,
      }))
      if (rows.length) await sb.from("community_member_roles").upsert(rows, { onConflict: "user_id,role_id" })
    }

    await logCommunityActivity(sb, id, user.id, "power_created", "role", role.id, { name: role.name })
    return NextResponse.json({ role: { ...role, permissions: normalizePermissions(role.permissions), member_count: 0 } }, { status: 201 })
  } catch (e: any) {
    console.error("[roles] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to create Power" }, { status: 500 })
  }
}

/** PATCH — edit a Power. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const abilities = await viewerAbilities(sb, id, user.id)
    if (!can(abilities.permissions, "power.assign")) {
      return NextResponse.json({ error: "You can't edit Powers here" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const roleId = Number(body.id)
    if (!roleId) return NextResponse.json({ error: "Missing Power id" }, { status: 400 })

    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 32)
      if (name.length < 2) return NextResponse.json({ error: "Give the Power a name" }, { status: 400 })
      patch.name = name
    }
    if (body.description !== undefined) patch.description = String(body.description).trim().slice(0, 240)
    if (body.color !== undefined) patch.color = cleanColor(body.color)
    if (body.icon !== undefined) patch.icon = String(body.icon || "shield").slice(0, 24)
    if (body.permissions !== undefined) patch.permissions = cleanPermissions(body.permissions)
    if (body.priority !== undefined) patch.priority = Math.max(0, Math.min(100, Number(body.priority) || 0))
    if (body.is_default !== undefined) patch.is_default = Boolean(body.is_default)

    const { data: role, error } = await sb
      .from("community_roles")
      .update(patch)
      .eq("id", roleId)
      .eq("circle_id", id)
      .select()
      .single()
    if (error || !role) {
      return NextResponse.json({ error: "Failed to update Power: " + (error?.message || "") }, { status: 500 })
    }

    if (patch.is_default === true) {
      const { data: members } = await sb.from("circle_members").select("user_id").eq("circle_id", id).neq("status", "banned")
      const rows = (members || []).map((m: any) => ({
        circle_id: Number(id),
        user_id: m.user_id,
        role_id: role.id,
        assigned_by: user.id,
      }))
      if (rows.length) await sb.from("community_member_roles").upsert(rows, { onConflict: "user_id,role_id" })
    }

    await logCommunityActivity(sb, id, user.id, "power_updated", "role", roleId, { name: role.name })
    return NextResponse.json({ role: { ...role, permissions: normalizePermissions(role.permissions) } })
  } catch (e: any) {
    console.error("[roles] PATCH error:", e)
    return NextResponse.json({ error: e.message || "Failed to update Power" }, { status: 500 })
  }
}

/** DELETE /api/communities/[id]/roles?id=3 — remove a Power (and its assignments). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const abilities = await viewerAbilities(sb, id, user.id)
    if (!can(abilities.permissions, "power.assign")) {
      return NextResponse.json({ error: "You can't delete Powers here" }, { status: 403 })
    }

    const roleId = Number(new URL(request.url).searchParams.get("id"))
    if (!roleId) return NextResponse.json({ error: "Missing Power id" }, { status: 400 })

    const { error } = await sb.from("community_roles").delete().eq("id", roleId).eq("circle_id", id)
    if (error) return NextResponse.json({ error: "Failed to delete Power" }, { status: 500 })

    await logCommunityActivity(sb, id, user.id, "power_deleted", "role", roleId, {})
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[roles] DELETE error:", e)
    return NextResponse.json({ error: e.message || "Failed to delete Power" }, { status: 500 })
  }
}
