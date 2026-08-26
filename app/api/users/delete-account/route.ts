import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

// POST: Request account deletion (3-day grace period)
export async function POST(req: NextRequest) {
  try {

    const authUser = await getUserFromRequest(req)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authUser.id

    // Check if already scheduled
    const { data: existing } = await supabase
      .from("account_deletions")
      .select("id, cancelled, executed, execute_after")
      .eq("user_id", userId)
      .single()

    if (existing && !existing.cancelled && !existing.executed) {
      return NextResponse.json({
        error: "Deletion already scheduled",
        execute_after: existing.execute_after,
      }, { status: 409 })
    }

    // If previously cancelled or executed, allow re-scheduling
    if (existing && (existing.cancelled || existing.executed)) {
      await supabase
        .from("account_deletions")
        .delete()
        .eq("user_id", userId)
    }

    // Schedule deletion
    const executeAfter = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    const { error: insertErr } = await supabase
      .from("account_deletions")
      .insert({
        user_id: userId,
        execute_after: executeAfter,
      })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Update profile timestamp
    await supabase
      .from("profiles")
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq("id", userId)

    return NextResponse.json({
      success: true,
      message: "Account deletion scheduled. You have 3 days to cancel.",
      execute_after: executeAfter,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

// DELETE: Cancel scheduled deletion
export async function DELETE(req: NextRequest) {
  try {

    const authUser = await getUserFromRequest(req)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authUser.id

    const { error: updateErr } = await supabase
      .from("account_deletions")
      .update({ cancelled: true })
      .eq("user_id", userId)
      .eq("cancelled", false)
      .eq("executed", false)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Clear profile timestamp
    await supabase
      .from("profiles")
      .update({ deletion_requested_at: null })
      .eq("id", userId)

    return NextResponse.json({ success: true, message: "Account deletion cancelled." })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

// GET: Check deletion status
export async function GET(req: NextRequest) {
  try {

    const authUser = await getUserFromRequest(req)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: deletion } = await supabase
      .from("account_deletions")
      .select("id, cancelled, executed, execute_after, scheduled_at")
      .eq("user_id", authUser.id)
      .single()

    if (!deletion || deletion.cancelled || deletion.executed) {
      return NextResponse.json({ scheduled: false })
    }

    return NextResponse.json({
      scheduled: true,
      execute_after: deletion.execute_after,
      scheduled_at: deletion.scheduled_at,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
