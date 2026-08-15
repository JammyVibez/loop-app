import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Native (Capacitor) FCM token registration. Web Push uses
 * /api/push/subscribe; native builds use this endpoint so the same
 * notification pipeline can deliver FCM pushes to the app shell.
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const token = String(body.token || "").trim()
  const platform = String(body.platform || "android").trim().toLowerCase()

  if (!token || token.length < 20) {
    return NextResponse.json({ error: "A valid FCM token is required" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("native_push_tokens")
    .upsert(
      {
        user_id: user.id,
        token,
        platform: platform === "ios" ? "ios" : "android",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    )
    .select()
    .single()

  if (error) {
    // Fallback if the table doesn't exist yet — fail loudly so the schema
    // migration (scripts/native-push-schema.sql) is obviously missing.
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: "native_push_tokens table is missing — run scripts/native-push-schema.sql" },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, token: data })
}

export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const token = String(body.token || "").trim()
  const supabase = createServerClient()

  const query = supabase.from("native_push_tokens").delete().eq("user_id", user.id)
  if (token) query.eq("token", token)
  const { error } = await query
  if (error && !/relation .* does not exist/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
