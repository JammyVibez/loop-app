import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { AVAILABLE_PERMISSIONS } from "@/lib/team-permissions"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)



async function verifyAdmin(token: string) {
  const { data: authData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authData.user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", authData.user.id)
    .single()
  if (!profile?.is_admin) return null
  return authData.user.id
}

// GET: List all team members with their permissions
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const adminId = await verifyAdmin(token)
    if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 })

    // Get all team members
    const { data: teamMembers, error: tmErr } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, email, is_team_member, created_at")
      .eq("is_team_member", true)
      .order("username", { ascending: true })

    if (tmErr) return NextResponse.json({ error: tmErr.message }, { status: 500 })

    // Get all permissions
    const { data: perms } = await supabase
      .from("team_permissions")
      .select("user_id, permission_key, granted_at")

    // Group permissions by user
    const permissionsByUser: Record<string, string[]> = {}
    for (const p of perms || []) {
      if (!permissionsByUser[p.user_id]) permissionsByUser[p.user_id] = []
      permissionsByUser[p.user_id].push(p.permission_key)
    }

    const membersWithPerms = (teamMembers || []).map(m => ({
      ...m,
      permissions: permissionsByUser[m.id] || [],
    }))

    return NextResponse.json({
      members: membersWithPerms,
      available_permissions: AVAILABLE_PERMISSIONS,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

// POST: Set permissions for a team member (replaces all permissions)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const adminId = await verifyAdmin(token)
    if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 })

    const body = await req.json()
    const { user_id, permissions } = body

    if (!user_id || !Array.isArray(permissions)) {
      return NextResponse.json({ error: "user_id and permissions array required" }, { status: 400 })
    }

    // Verify target is a team member
    const { data: target } = await supabase
      .from("profiles")
      .select("is_team_member, username")
      .eq("id", user_id)
      .single()

    if (!target?.is_team_member) {
      return NextResponse.json({ error: "User is not a team member" }, { status: 400 })
    }

    // Validate permission keys
    const validKeys = new Set(AVAILABLE_PERMISSIONS.map(p => p.key))
    const invalidKeys = permissions.filter((k: string) => !validKeys.has(k))
    if (invalidKeys.length > 0) {
      return NextResponse.json({ error: `Invalid permission keys: ${invalidKeys.join(", ")}` }, { status: 400 })
    }

    // Delete existing permissions
    await supabase.from("team_permissions").delete().eq("user_id", user_id)

    // Insert new permissions
    if (permissions.length > 0) {
      const rows = permissions.map((key: string) => ({
        user_id,
        permission_key: key,
        granted_by: adminId,
      }))
      const { error: insErr } = await supabase.from("team_permissions").insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Updated permissions for @${target.username}: ${permissions.length} section${permissions.length !== 1 ? "s" : ""}`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
