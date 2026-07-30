import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const supabase = createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) }

  const { data: profile } = await supabase.from("profiles").select("id, is_admin, username").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  return { user, profile, supabase }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error
    const { supabase } = auth
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") || "").trim()
    const filter = searchParams.get("filter") || "all"
    const limit = Number.parseInt(searchParams.get("limit") || "40")

    let query = supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, email, is_verified, is_premium, is_admin, is_banned, ban_reason, premium_expires_at, loop_coins, created_at, last_active",
      )
      .order("created_at", { ascending: false })
      .limit(limit)

    if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`)
    if (filter === "verified") query = query.eq("is_verified", true)
    if (filter === "premium") query = query.eq("is_premium", true)
    if (filter === "admin") query = query.eq("is_admin", true)
    if (filter === "unverified") query = query.eq("is_verified", false)
    if (filter === "banned") query = query.eq("is_banned", true)

    const { data: users, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { count: totalUsers } = await supabase.from("profiles").select("id", { count: "exact", head: true })
    const { count: verifiedCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_verified", true)
    const { count: premiumCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_premium", true)
    const { count: bannedCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_banned", true)

    return NextResponse.json({
      success: true,
      users: users || [],
      stats: {
        total_users: totalUsers || 0,
        verified: verifiedCount || 0,
        premium: premiumCount || 0,
        banned: bannedCount || 0,
      },
    })
  } catch (error) {
    console.error("Admin users GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error
    const { supabase, user: adminUser, profile: adminProfile } = auth

    const body = await request.json()
    const userId = body.user_id as string
    const action = String(body.action || "")
    if (!userId || !action) {
      return NextResponse.json({ error: "user_id and action are required" }, { status: 400 })
    }

    const { data: target } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    switch (action) {
      case "verify":
        updates.is_verified = true
        break
      case "unverify":
        updates.is_verified = false
        break
      case "grant_premium": {
        updates.is_premium = true
        const months = Number(body.months) || 1
        const base =
          target.premium_expires_at && new Date(target.premium_expires_at) > new Date()
            ? new Date(target.premium_expires_at)
            : new Date()
        base.setMonth(base.getMonth() + months)
        updates.premium_expires_at = base.toISOString()
        break
      }
      case "revoke_premium":
        updates.is_premium = false
        updates.premium_expires_at = null
        break
      case "make_admin":
        updates.is_admin = true
        break
      case "remove_admin":
        if (userId === adminUser.id) {
          return NextResponse.json({ error: "You cannot remove your own admin role" }, { status: 400 })
        }
        updates.is_admin = false
        break
      case "add_coins": {
        const amount = Math.max(0, Number(body.amount) || 0)
        updates.loop_coins = Number(target.loop_coins || 0) + amount
        break
      }
      case "ban":
        if (userId === adminUser.id) {
          return NextResponse.json({ error: "You cannot ban yourself" }, { status: 400 })
        }
        updates.is_banned = true
        updates.ban_reason = String(body.reason || "Violated community guidelines")
        break
      case "unban":
        updates.is_banned = false
        updates.ban_reason = null
        break
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select(
        "id, username, display_name, avatar_url, email, is_verified, is_premium, is_admin, is_banned, ban_reason, premium_expires_at, loop_coins, created_at, last_active",
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "admin_action",
      title: "Account updated",
      message: `An admin updated your account (${action.replace(/_/g, " ")}).`,
      data: { action, admin_id: adminUser.id, admin_username: adminProfile.username },
      actor_id: adminUser.id,
    })

    try {
      await supabase.channel("admin:users").send({
        type: "broadcast",
        event: "user_updated",
        payload: { user: updated, action, admin_id: adminUser.id },
      })
      await supabase.channel(`user:${userId}`).send({
        type: "broadcast",
        event: "profile_updated",
        payload: { user: updated, action },
      })
    } catch {}

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error("Admin users POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
