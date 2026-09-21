import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { logAdminAction } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/monetization/subscriptions?user_id=<uuid>
 * Returns the user's Pro status with a clearly separated source:
 * stripe_paid (real billing), admin_granted (manual), or none.
 */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")
    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

    const supabase = createServerClient()

    const [{ data: profile, error: profileError }, { data: subs, error: subsError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_premium, premium_expires_at, premium_source, premium_granted_by, premium_granted_at, loop_coins")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ])

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (subsError) return NextResponse.json({ error: subsError.message }, { status: 500 })

    const now = new Date()
    const expired = profile.premium_expires_at ? new Date(profile.premium_expires_at) <= now : true

    return NextResponse.json({
      success: true,
      profile,
      subscriptions: subs || [],
      effective_status: {
        is_pro: Boolean(profile.is_premium) && !expired,
        source: profile.is_premium ? (profile.premium_source === "admin" ? "admin_granted" : "stripe_paid") : "none",
        expires_at: profile.premium_expires_at ?? null,
        expired: Boolean(profile.is_premium) && expired,
      },
    })
  } catch (error: any) {
    console.error("GET admin subscriptions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/monetization/subscriptions
 * Body: { user_id, action: "grant" | "revoke", plan_type?, months?, reason }
 * Grants or revokes Pro independently of Stripe billing. Granting marks the
 * source as "admin" so support staff can tell it apart from Stripe-paid Pro.
 */
export async function POST(request: NextRequest) {
  const { response, user: admin } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const userId = String(body.user_id || "")
    const action = String(body.action || "")
    const reason = String(body.reason || "").trim()

    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    if (!["grant", "revoke"].includes(action))
      return NextResponse.json({ error: "action must be grant or revoke" }, { status: 400 })
    if (!reason) return NextResponse.json({ error: "A reason is required for audit purposes" }, { status: 400 })

    const supabase = createServerClient()

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, is_premium, premium_expires_at, premium_source")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (action === "grant") {
      const planType = ["monthly", "annual"].includes(body.plan_type) ? body.plan_type : "monthly"
      const now = new Date()

      // Extend from the current expiry when the user already has active Pro.
      let base = now
      if (
        profile.is_premium &&
        profile.premium_expires_at &&
        new Date(profile.premium_expires_at) > now
      ) {
        base = new Date(profile.premium_expires_at)
      }

      let expiresAt: Date
      if (body.expires_at) {
        expiresAt = new Date(body.expires_at)
        if (isNaN(expiresAt.getTime())) return NextResponse.json({ error: "Invalid expires_at" }, { status: 400 })
      } else if (planType === "annual") {
        expiresAt = new Date(base)
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      } else {
        const months = Math.max(1, Math.min(36, Math.floor(Number(body.months || 1))))
        expiresAt = new Date(base)
        expiresAt.setMonth(expiresAt.getMonth() + months)
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_premium: true,
          premium_expires_at: expiresAt.toISOString(),
          premium_source: "admin",
          premium_granted_by: admin!.id,
          premium_granted_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", userId)

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

      // Keep a subscriptions row for history (status admin_comps is not a
      // Stripe state — it records manual grants only).
      await supabase.from("subscriptions").insert({
        user_id: userId,
        plan_type: planType,
        status: "active",
        source: "admin",
        granted_by: admin!.id,
        grant_reason: reason,
        current_period_start: now.toISOString(),
        current_period_end: expiresAt.toISOString(),
        amount: 0,
      })

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "pro_grant",
        title: "Loop Pro unlocked",
        message: `You've been granted Loop Pro! It's active until ${expiresAt.toLocaleDateString()}.`,
        // The audit trail records the staff action elsewhere — the user-facing
        // record must not hint that a human intervened.
        data: { source: "loop", expires_at: expiresAt.toISOString() },
      })

      await logAdminAction(supabase, {
        adminId: admin!.id,
        action: "premium_grant",
        targetUserId: userId,
        reason,
        details: {
          username: profile.username,
          plan_type: planType,
          expires_at: expiresAt.toISOString(),
          previous_source: profile.premium_source ?? null,
        },
      })

      return NextResponse.json({ success: true, expires_at: expiresAt.toISOString(), source: "admin_granted" })
    }

    // action === "revoke"
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_premium: false,
        premium_expires_at: null,
        premium_source: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Close out any open admin-granted subscription rows.
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("source", "admin")
      .eq("status", "active")

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "system",
      title: "Loop Pro membership ended",
      message: "Your Loop Pro membership has ended. You can resubscribe anytime.",
      data: { source: "loop" },
    })

    await logAdminAction(supabase, {
      adminId: admin!.id,
      action: "premium_revoke",
      targetUserId: userId,
      reason,
      details: {
        username: profile.username,
        previous_source: profile.premium_source ?? null,
        previous_expires_at: profile.premium_expires_at ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("POST admin subscriptions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/monetization/subscriptions
 * Body: { user_id, expires_at, reason }
 * Edits the expiry of a manually-granted Pro period (extend/shorten).
 * Stripe-paid Pro is protected — only admin-granted Pro can be edited here.
 */
export async function PATCH(request: NextRequest) {
  const { response, user: admin } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const userId = String(body.user_id || "")
    const reason = String(body.reason || "").trim()
    const expiresAt = new Date(body.expires_at || "")

    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    if (!reason) return NextResponse.json({ error: "A reason is required for audit purposes" }, { status: 400 })
    if (isNaN(expiresAt.getTime())) return NextResponse.json({ error: "A valid expires_at is required" }, { status: 400 })
    if (expiresAt <= new Date()) {
      return NextResponse.json({ error: "Expiry must be in the future — revoke instead" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, is_premium, premium_expires_at, premium_source")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (!profile.is_premium) {
      return NextResponse.json({ error: "User doesn't have Pro — grant it first" }, { status: 400 })
    }
    if (profile.premium_source === "stripe") {
      return NextResponse.json(
        { error: "This Pro is Stripe-paid. Edit the billing in Stripe — only admin-granted Pro can be edited here." },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        premium_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    await supabase
      .from("subscriptions")
      .update({ current_period_end: expiresAt.toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("source", "admin")
      .eq("status", "active")

    await logAdminAction(supabase, {
      adminId: admin!.id,
      action: "premium_edit",
      targetUserId: userId,
      reason,
      details: {
        username: profile.username,
        old_expires_at: profile.premium_expires_at,
        new_expires_at: expiresAt.toISOString(),
      },
    })

    return NextResponse.json({ success: true, expires_at: expiresAt.toISOString() })
  } catch (error: any) {
    console.error("PATCH admin subscriptions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
