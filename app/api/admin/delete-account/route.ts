import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

// POST: Admin instantly deletes a user account
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", authData.user.id)
      .single()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { user_id, reason } = body

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    // Don't allow admin to delete themselves
    if (user_id === authData.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    // Get target user info before deletion
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("username, display_name, is_admin")
      .eq("id", user_id)
      .single()

    // Don't allow deleting other admins
    if (targetProfile?.is_admin) {
      return NextResponse.json({ error: "Cannot delete another admin account" }, { status: 400 })
    }

    // Mark deletion as executed immediately (for the scheduled pipeline)
    await supabase
      .from("account_deletions")
      .upsert({
        user_id,
        executed: true,
        executed_at: new Date().toISOString(),
        cancelled: false,
      }, { onConflict: "user_id" })

    // Update profile to show as deleted
    await supabase
      .from("profiles")
      .update({
        deletion_executed_at: new Date().toISOString(),
        deletion_requested_at: new Date().toISOString(),
        display_name: "Deleted Account",
        bio: null,
        avatar_url: null,
        cover_url: null,
        location: null,
        website: null,
        is_premium: false,
        is_verified: false,
        is_sponsor: false,
      })
      .eq("id", user_id)

    // Log the admin action
    await supabase
      .from("admin_account_deletions")
      .insert({
        admin_id: authData.user.id,
        target_user_id: user_id,
        target_username: targetProfile?.username || "unknown",
        reason: reason || "Admin deletion",
      })

    // Note: We soft-delete the profile rather than hard-delete
    // because posts reference the author_id. The profile stays
    // as "Deleted Account" with no accessible profile page.

    // Optionally: disable the Supabase auth account
    // This prevents them from logging in but keeps the UUID for post references
    try {
      await supabase.auth.admin.updateUserById(user_id, {
        ban_duration: "none",
      })
      // Ban the user to prevent login
      await supabase.auth.admin.updateUserById(user_id, {
        ban_duration: "8760000000", // Ban for ~100 years in seconds
      })
    } catch {
      // Auth ban is best-effort — profile soft-delete is the primary mechanism
    }

    return NextResponse.json({
      success: true,
      message: `Account for @${targetProfile?.username || user_id} has been deleted.`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
