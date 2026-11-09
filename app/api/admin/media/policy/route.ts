import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import {
  MEDIA_POLICY_FIELDS,
  getMediaPolicy,
  normalizeMediaPolicy,
  refreshMediaPolicy,
  saveMediaPolicy,
} from "@/lib/media/policy"
import { getDiskUsage } from "@/lib/media/storage"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response
    const supabase = createServerClient()
    const [policy, disk] = await Promise.all([getMediaPolicy(supabase), getDiskUsage()])
    return NextResponse.json({ success: true, policy, fields: MEDIA_POLICY_FIELDS, disk })
  } catch (error) {
    console.error("[admin/media/policy] GET failed:", error)
    return NextResponse.json({ error: "Could not read upload rules" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response || !user) return response!
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const patch = body.policy || body
    const policy = await saveMediaPolicy(supabase, normalizeMediaPolicy(patch))
    await refreshMediaPolicy(supabase)

    // Upload rules are operationally significant — record who changed them.
    try {
      await supabase.from("security_audit_log").insert({
        user_id: user.id,
        action: "media_policy_update",
        details: patch,
        created_at: new Date().toISOString(),
      })
    } catch {
      /* non-blocking */
    }

    return NextResponse.json({ success: true, policy, message: "Upload rules saved" })
  } catch (error) {
    console.error("[admin/media/policy] POST failed:", error)
    return NextResponse.json({ error: "Could not save upload rules" }, { status: 500 })
  }
}
