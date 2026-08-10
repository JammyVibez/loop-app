import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"
import { notifyUser } from "@/lib/notifications"
import { sendWebPushToUser } from "@/lib/web-push"

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const title = String(body.title || "").trim()
  const message = String(body.message || body.body || "").trim()
  const url = body.url || body.link || "/"
  const targetUserId = body.target_user_id || body.user_id || user.id
  const pushOnly = Boolean(body.push_only)
  const category = body.category || "system"

  if (!title || !message) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 })
  }

  const supabase = createServerClient()
  if (targetUserId !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (!(profile as any)?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  if (pushOnly) {
    const result = await sendWebPushToUser(
      targetUserId,
      { title, body: message, url, tag: body.tag || "loop-test" },
      { category, skipPrefsCheck: targetUserId === user.id },
    )
    return NextResponse.json({
      success: true,
      deliveredCount: result.delivered,
      failedCount: result.failed,
      skipped: result.skipped,
    })
  }

  const result = await notifyUser(supabase, {
    userId: targetUserId,
    type: body.type || "system",
    title,
    message,
    actionUrl: url,
    actorId: user.id,
    pushCategory: category,
  })

  return NextResponse.json({
    success: true,
    deliveredCount: result.pushDelivered,
    notificationId: result.notificationId,
  })
}
