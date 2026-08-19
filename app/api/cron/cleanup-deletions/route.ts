import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

// GET: Process due account deletions (run via cron or manually)
// This endpoint should be called periodically (e.g., every hour)
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret or internal call
    const authHeader = req.headers.get("authorization")
    const cronSecret = req.nextUrl.searchParams.get("secret")
    const expectedSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET

    if (cronSecret !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date().toISOString()

    // Find all deletions that are due (not cancelled, not executed, execute_after has passed)
    const { data: dueDeletions, error: fetchErr } = await supabase
      .from("account_deletions")
      .select("id, user_id")
      .eq("cancelled", false)
      .eq("executed", false)
      .lte("execute_after", now)
      .limit(50)

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!dueDeletions || dueDeletions.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "No deletions due" })
    }

    let processed = 0
    let failed = 0

    for (const deletion of dueDeletions) {
      try {
        // Soft-delete the profile
        await supabase
          .from("profiles")
          .update({
            deletion_executed_at: now,
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
          .eq("id", deletion.user_id)

        // Mark as executed
        await supabase
          .from("account_deletions")
          .update({
            executed: true,
            executed_at: now,
          })
          .eq("id", deletion.id)

        // Ban the Supabase auth account to prevent login
        try {
          await supabase.auth.admin.updateUserById(deletion.user_id, {
            ban_duration: "8760000000", // ~100 years in seconds
          })
        } catch {
          // Auth ban is best-effort
        }

        processed++
      } catch (err) {
        console.error(`Failed to process deletion for user ${deletion.user_id}:`, err)
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      message: `Processed ${processed} deletions, ${failed} failed.`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
