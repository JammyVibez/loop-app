import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { notifyUser } from "@/lib/notifications"

export const dynamic = "force-dynamic"

async function requireAdmin(token: string | null) {
  if (!token) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) return { error: NextResponse.json({ error: "Invalid authentication" }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  return { user }
}

const VALID_STATUSES = ["pending_review", "approved", "paid", "rejected"]

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
  const auth = await requireAdmin(token)
  if (auth.error) return auth.error

  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("withdrawal_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)

  if (status && VALID_STATUSES.includes(status)) {
    query = query.eq("status", status)
  }

  const { data: requests, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, requests: requests || [] })
}

export async function PATCH(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
  const auth = await requireAdmin(token)
  if (auth.error) return auth.error

  const supabase = createServerClient()
  const body = await request.json().catch(() => ({}))
  const { id, status, admin_note } = body

  if (!id || !status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `id and a valid status (${VALID_STATUSES.join(", ")}) are required` },
      { status: 400 },
    )
  }

  const { data: existing, error: fetchError } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Withdrawal request not found" }, { status: 404 })
  }

  // Rejecting refunds the reserved coins back to the creator — they were
  // never actually removed from circulation, just held pending payout.
  if (status === "rejected" && existing.status !== "rejected") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", existing.user_id)
      .maybeSingle()
    await supabase
      .from("profiles")
      .update({
        loop_coins: Number(profile?.loop_coins || 0) + Number(existing.coins_amount || 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.user_id)
  }

  const { data: updated, error: updateError } = await supabase
    .from("withdrawal_requests")
    .update({
      status,
      admin_note: admin_note || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user!.id,
    })
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    // admin_note/reviewed_at/reviewed_by columns may not exist on older schemas — retry with just status
    const { data: fallbackUpdated, error: fallbackError } = await supabase
      .from("withdrawal_requests")
      .update({ status })
      .eq("id", id)
      .select()
      .single()
    if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 })

    await notifyStatusChange(supabase, fallbackUpdated)
    return NextResponse.json({ success: true, request: fallbackUpdated })
  }

  await notifyStatusChange(supabase, updated)
  return NextResponse.json({ success: true, request: updated })
}

async function notifyStatusChange(supabase: any, request: any) {
  if (!request?.user_id) return
  const statusCopy: Record<string, string> = {
    approved: "Your payout request was approved and is being processed.",
    paid: `Your payout of ${request.coins_amount} coins (~$${request.estimated_usd}) has been sent.`,
    rejected: "Your payout request was declined. The coins have been returned to your balance.",
  }
  const message = statusCopy[request.status]
  if (!message) return
  await notifyUser(supabase, {
    userId: request.user_id,
    type: "payout_status",
    title: "Payout update",
    message,
    actionUrl: "/wallet?tab=withdrawals",
  })
}
