import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const subscription = await request.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 })
  const supabase = createServerClient()
  const { data, error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    subscription,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, subscription: data })
}

export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { endpoint } = await request.json().catch(() => ({}))
  if (!endpoint) return NextResponse.json({ error: "Endpoint is required" }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
