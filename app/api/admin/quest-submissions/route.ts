import { type NextResponse } from "next/server"
import { } from "@/lib/supabase"
import { } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const VALID_STATUSES = ["approved", "rejected"]

/**
 * GET /api/admin/quest-submissions
 * Every submission (joined with quest + submitter) for admin review.
 *
 * PATCH /api/admin/quest-submissions
 * { submission_id, status } — approving credits the quest's coin bounty to
 * the submitter exactly once, logs a coin_transactions entry, and pushes a
 * notification so the winner sees the payout live.
 */
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { data: submissions, error } = await supabase
      .from("dev_quest_submissions")
      .select(
        `*,
        quest:dev_quests!dev_quest_submissions_quest_id_fkey(id, title, difficulty, reward_coins, tags),
        user:profiles!dev_quest_submissions_user_id_fkey(id, username, display_name, avatar_url),
        project:developer_projects!dev_quest_submissions_project_id_fkey(id, title)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, submissions: submissions || [] })
  } catch (error: any) {
    console.error("Admin quest submissions GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const submissionId = String(body.submission_id || "")
    const status = String(body.status || "")
    if (!submissionId || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "submission_id and a valid status are required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: submission, error: fetchError } = await supabase
      .from("dev_quest_submissions")
      .select("id, quest_id, user_id, status, reward_coins_awarded")
      .eq("id", submissionId)
      .maybeSingle()
    if (fetchError || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }
    if (submission.status !== "pending") {
      return NextResponse.json(
        { error: `This submission was already ${submission.status}` },
        { status: 409 },
      )
    }

    // Rejection is just a status flip.
    if (status === "rejected") {
      const { error: rejectError } = await supabase
        .from("dev_quest_submissions")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submissionId)
      if (rejectError) return NextResponse.json({ error: rejectError.message }, { status: 500 })
      return NextResponse.json({ success: true, submission: { id: submissionId, status: "rejected" } })
    }

    // Approval: fetch the quest's bounty first.
    const { data: quest } = await supabase
      .from("dev_quests")
      .select("id, title, reward_coins")
      .eq("id", submission.quest_id)
      .maybeSingle()
    const bounty = Math.max(0, Number(quest?.reward_coins || 0))

    const { error: approveError } = await supabase
      .from("dev_quest_submissions")
      .update({
        status: "approved",
        reward_coins_awarded: bounty,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
    if (approveError) return NextResponse.json({ error: approveError.message }, { status: 500 })

    // Credit the coins (bounty of 0 still counts as a completion).
    if (bounty > 0) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, username, loop_coins")
          .eq("id", submission.user_id)
          .single()
        if (profile) {
          await supabase
            .from("profiles")
            .update({ loop_coins: (Number(profile.loop_coins) || 0) + bounty })
            .eq("id", submission.user_id)

          await supabase.from("coin_transactions").insert({
            user_id: submission.user_id,
            amount: bounty,
            transaction_type: "dev_quest_reward",
            description: `Dev Quest bounty: ${quest?.title || "Quest"}`,
            created_at: new Date().toISOString(),
          })

          await supabase.from("notifications").insert({
            user_id: submission.user_id,
            type: "dev_quest_reward",
            title: `🏆 Quest approved — +${bounty} coins!`,
            message: `Your submission for "${quest?.title || "Dev Quest"}" was approved. ${bounty} Loop Coins have been added to your balance.`,
            data: { quest_id: submission.quest_id, coins: bounty },
            is_read: false,
          })
        }
      } catch (coinErr) {
        console.error("Admin quest approval: coin credit failed:", coinErr)
      }
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submissionId,
        status: "approved",
        reward_coins_awarded: bounty,
      },
      coins_awarded: bounty,
    })
  } catch (error: any) {
    console.error("Admin quest submissions PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
