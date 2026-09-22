import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { notifyUsers } from "@/lib/notifications"
import { maskAdminCopy } from "@/lib/notification-copy"
import { isResendConfigured, resend, EMAIL_FROM } from "@/lib/resend"
import { getUserFromRequest } from "@/lib/server-auth"
import { buildBroadcastEmailHtml, buildBroadcastText } from "@/lib/broadcast-email"

export const dynamic = "force-dynamic"
export const maxDuration = 55

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const title = maskAdminCopy(String(body.title || "").trim()).slice(0, 120)
    const message = maskAdminCopy(String(body.message || "").trim()).slice(0, 2000)
    const actionUrl = body.action_url ? String(body.action_url).slice(0, 500) : body.actionUrl || null
    const previewText = (body.preview_text || body.previewText || "Something important is happening on Loop — jump in while it’s live.").slice(0, 240)
    const ctaLabel = body.cta_label || body.ctaLabel || "Open Loop"
    const brandName = body.brand_name || body.brandName || "loopapp.me"
    const type = body.type === "announcement" ? "announcement" : "trending"
    const scope = body.scope === "random" ? "random" : body.scope === "sample" ? "sample" : "all"
    const sampleSize = Math.min(Math.max(Number(body.sample_size) || 100, 1), 500)
    const sendEmail = Boolean(body.send_email)

    if (!title || !message) {
      return NextResponse.json({ error: "title and message are required" }, { status: 400 })
    }

    let query = supabase.from("profiles").select("id, email, notification_settings").not("id", "is", null)
    const { data: allProfiles, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let targets = (allProfiles || []).map((p: any) => p)
    if (scope === "random" || scope === "sample") {
      targets = targets.sort(() => Math.random() - 0.5).slice(0, sampleSize)
    }

    const userIds = targets.map((p: any) => p.id).filter(Boolean)
    const emailTargets = targets
      .filter((p: any) => {
        const email = typeof p?.email === "string" ? p.email : ""
        if (!email.includes("@")) return false
        const settings = p?.notification_settings || {}
        if (settings.email === false) return false
        if (settings.email_notifications === false) return false
        if (settings.marketing === false) return false
        return true
      })
      .map((p: any) => p.email)

    let notified = 0
    try {
      await notifyUsers(supabase, userIds, {
        type,
        title,
        message,
        actionUrl: actionUrl || undefined,
        data: { broadcast: true, scope },
        pushCategory: "system",
      })
      notified = userIds.length
    } catch (notifyErr) {
      console.warn("Broadcast notification error:", notifyErr)
    }

    let emailed = 0
    if (sendEmail && isResendConfigured() && resend) {
      const BATCH = 25
      const emailHtml = buildBroadcastEmailHtml({
        title,
        message,
        actionUrl,
        ctaLabel,
        previewText,
        brandName,
      })

      for (let i = 0; i < emailTargets.length; i += BATCH) {
        const batch = emailTargets.slice(i, i + BATCH)
        try {
          const { error: batchError } = await resend.batch.send(
            batch.map((to: string) => ({
              from: EMAIL_FROM,
              to,
              subject: title,
              text: buildBroadcastText({
                title,
                message,
                actionUrl,
                ctaLabel,
                previewText,
                brandName,
              }),
              html: emailHtml,
            })),
          )
          if (batchError) {
            console.warn(`[broadcast] resend batch ${i} failed:`, batchError)
          } else {
            emailed += batch.length
          }
        } catch (batchErr) {
          console.warn(`[broadcast] resend batch ${i} error:`, batchErr)
        }
      }
    } else if (sendEmail) {
      console.log(`[broadcast] RESEND_API_KEY not configured — would email ${emailTargets.length} users`)
    }

    return NextResponse.json({
      success: true,
      notified,
      emailed,
      send_email: sendEmail && isResendConfigured(),
      scope,
      targets: targets.length,
      message: "Broadcast sent",
    })
  } catch (error: any) {
    console.error("Broadcast error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
