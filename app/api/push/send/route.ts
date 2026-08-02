import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { target_user_id, title, message, url } = await request.json()

  if (!title || !message) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 })
  }

  const supabase = createServerClient()
  const recipientId = target_user_id || user.id

  // Fetch push subscriptions for the targeted user
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", recipientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also log in user notifications table for fallback
  await supabase.from("notifications").insert({
    user_id: recipientId,
    type: "system",
    title,
    content: message,
    link: url || "/dashboard",
    read: false,
    created_at: new Date().toISOString()
  }).select().maybeSingle()

  return NextResponse.json({
    success: true,
    deliveredCount: subscriptions?.length || 0,
    subscriptions: subscriptions || []
  })
}
