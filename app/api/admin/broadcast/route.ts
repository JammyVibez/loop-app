import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { notifyUsers } from "@/lib/notifications"
import { isResendConfigured, resend, EMAIL_FROM } from "@/lib/resend"

export const dynamic = "force-dynamic"
export const maxDuration = 55

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

function htmlEmail(title: string, message: string, actionUrl?: string | null) {
  const button = actionUrl
    ? `<p style="margin:28px 0 0;"><a href="${actionUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:9999px;">View on loopapp.me</a></p>`
    : ""
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;">
      <p style="font-weight:800;font-size:16px;margin:0 0 16px;color:#0f172a;">loopapp.me</p>
      <h1 style="font-size:20px;margin:0 0 10px;color:#0f172a;">${title}</h1>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;white-space:pre-line;">${message}</p>
      ${button}
      <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
        You're receiving this because you have an account on loopapp.me. You can turn off
        notification emails in Settings → Privacy & notifications.
      </p>
    </div>
  `
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)
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
    const title = String(body.title || "").trim().slice(0, 120)
    const message = String(body.message || "").trim().slice(0, 2000)
    const actionUrl = body.action_url ? String(body.action_url).slice(0, 500) : null
    const type = body.type === "announcement" ? "announcement" : "trending"
    const scope = body.scope === "random" ? "random" : body.scope === "sample" ? "sample" : "all"
    const sampleSize = Math.min(Math.max(Number(body.sample_size) || 100, 1), 500)
    const sendEmail = Boolean(body.send_email)

    if (!title || !message) {
      return NextResponse.json({ error: "title and message are required" }, { status: 400 })
    }

    // Which users? "random"/"sample" = random subset, "all" = everyone with a profile.
    let query = supabase.from("profiles").select("id, email").not("id", "is", null)
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
      .map((p: any) => p.email)
      .filter((email: string) => typeof email === "string" && email.includes("@"))

    // In-app notifications for everyone targeted.
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

    // Optional email to all (batched so we don't hammer the email API).
    let emailed = 0
    if (sendEmail && isResendConfigured() && resend) {
      const BATCH = 25
      for (let i = 0; i < emailTargets.length; i += BATCH) {
        const batch = emailTargets.slice(i, i + BATCH)
        try {
          const { error: batchError } = await resend.batch.send(
            batch.map((to: string) => ({
              from: EMAIL_FROM,
              to,
              subject: title,
              html: htmlEmail(title, message, actionUrl),
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
