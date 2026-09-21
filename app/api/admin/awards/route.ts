import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { maskAdminCopy } from "@/lib/notification-copy"

export const dynamic = "force-dynamic"

/** List award definitions (with grant counts) + recent grants. */
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()

    const { data: awards, error } = await supabase
      .from("awards")
      .select(
        `*,
         grants:user_awards(count)`,
      )
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: recentGrants, error: grantsError } = await supabase
      .from("user_awards")
      .select(
        `id, reason, created_at,
         award:awards(id, name, emoji, color),
         user:profiles!user_id(id, username, display_name, avatar_url),
         awarded_by:profiles!awarded_by(id, username, display_name)`,
      )
      .order("created_at", { ascending: false })
      .limit(30)

    if (grantsError) {
      return NextResponse.json({ error: grantsError.message }, { status: 500 })
    }

    const normalized = (awards || []).map((award: any) => ({
      ...award,
      grant_count: Array.isArray(award.grants) ? award.grants[0]?.count ?? 0 : Number(award.grants || 0),
    }))

    return NextResponse.json({ success: true, awards: normalized, recent_grants: recentGrants || [] })
  } catch (error: any) {
    console.error("Admin awards GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Create an award definition. */
export async function POST(request: NextRequest) {
  try {
    const { user: _user, response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const name = String(body.name || "").trim()
    const emoji = String(body.emoji || "🏆").trim().slice(0, 8)
    const color = String(body.color || "#f59e0b").trim()
    const description = String(body.description || "").trim()

    if (!name) {
      return NextResponse.json({ error: "Award name is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: award, error } = await supabase
      .from("awards")
      .insert({ name, emoji, color, description, is_active: true })
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, award })
  } catch (error: any) {
    console.error("Admin awards POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Update (PATCH) or delete (DELETE) an award definition; /grant grants one. */
export async function PATCH(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Award ID is required" }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const payload: Record<string, unknown> = {}
    if (typeof body.name === "string" && body.name.trim()) payload.name = body.name.trim()
    if (typeof body.emoji === "string") payload.emoji = body.emoji.trim().slice(0, 8)
    if (typeof body.color === "string") payload.color = body.color.trim()
    if (typeof body.description === "string") payload.description = body.description.trim()
    if (typeof body.is_active === "boolean") payload.is_active = body.is_active

    if (!Object.keys(payload).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: award, error } = await supabase.from("awards").update(payload).eq("id", id).select("*").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, award })
  } catch (error: any) {
    console.error("Admin awards PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Award ID is required" }, { status: 400 })

    const supabase = createServerClient()
    const { error } = await supabase.from("awards").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Admin awards DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Grant an award to a user. Body: { user_id, award_id, reason? } */
export async function PUT(request: NextRequest) {
  try {
    const { user: admin, response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const userId = String(body.user_id || body.userId || "").trim()
    const awardId = String(body.award_id || body.awardId || "").trim()
    const reason = String(body.reason || "").trim().slice(0, 500)

    if (!userId || !awardId) {
      return NextResponse.json({ error: "user_id and award_id are required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const [{ data: award }, { data: profile }] = await Promise.all([
      supabase.from("awards").select("id, name, emoji, color").eq("id", awardId).maybeSingle(),
      supabase.from("profiles").select("id, username, display_name").eq("id", userId).maybeSingle(),
    ])

    if (!award) return NextResponse.json({ error: "Award not found" }, { status: 404 })
    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Avoid duplicate identical grants by the same admin.
    const { data: existing } = await supabase
      .from("user_awards")
      .select("id")
      .eq("award_id", awardId)
      .eq("user_id", userId)
      .eq("awarded_by", admin.id)
      .eq("reason", reason)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "This award was already granted to that user" }, { status: 409 })
    }

    const { data: grant, error } = await supabase
      .from("user_awards")
      .insert({ award_id: awardId, user_id: userId, awarded_by: admin.id, reason: reason || null })
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify the recipient.
    try {
      const { notifyUser } = await import("@/lib/notifications")
      await notifyUser(supabase, {
        userId,
        type: "award",
        title: `You earned the ${award.emoji} ${award.name} award!`,
        // Platform voice — the recipient must never learn that staff granted it.
        message: maskAdminCopy(reason || "You earned this award for being awesome. It now shows on your profile."),
        actionUrl: `/profile/${profile.username}`,
        data: { award_id: awardId, user_award_id: grant.id },
        pushCategory: "system",
      })
    } catch (notifyErr) {
      console.warn("Award notify failed:", notifyErr)
    }

    return NextResponse.json({ success: true, grant })
  } catch (error: any) {
    console.error("Admin awards grant error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
