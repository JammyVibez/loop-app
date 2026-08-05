import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { getVapidPublicKey } from "@/lib/web-push"

export async function GET() {
  return NextResponse.json({
    success: true,
    publicKey: getVapidPublicKey(),
  })
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const subscription = body.subscription || body
  const endpoint = subscription?.endpoint || body.endpoint

  if (!endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json(
      { error: "Invalid push subscription — real browser PushSubscription required" },
      { status: 400 },
    )
  }

  // Reject legacy mock endpoints
  if (/push-fallback-service|demo_p256dh|mozilla\.com\/v1\/sub\/[a-z0-9]+$/i.test(endpoint)) {
    return NextResponse.json({ error: "Mock subscriptions are not allowed" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        subscription: {
          endpoint,
          expirationTime: subscription.expirationTime ?? null,
          keys: subscription.keys,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, subscription: data })
}

export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const endpoint = body.endpoint
  const supabase = createServerClient()

  if (endpoint) {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
