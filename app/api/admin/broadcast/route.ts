import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { notifyUsers } from "@/lib/notifications"
import { maskAdminCopy } from "@/lib/notification-copy"
import { isResendConfigured, resend, EMAIL_FROM } from "@/lib/resend"
import { getUserFromRequest } from "@/lib/server-auth"
import {
  buildBroadcastEmailHtml,
  buildBroadcastText,
  safeBroadcastHref,
} from "@/lib/broadcast-email"

export const dynamic = "force-dynamic"
export const maxDuration = 55

/**
 * Whether a profile's notification_settings allow marketing/broadcast email.
 *
 * Consent model: email is allowed unless the user has explicitly turned it
 * off — either globally (`email` / `email_notifications`) or for marketing
 * (`marketing`, `email_marketing`, `marketing_emails`, `promotions`).
 * Missing settings mean the user never changed preferences → allowed.
 */
function allowsMarketingEmail(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return true
  const s = settings as Record<string, unknown>

  // Global email kill-switchs
  if (s.email === false || s.email_notifications === false || s.email_enabled === false) {
    return false
  }

  // Marketing-specific opt-outs (any key present and false → excluded)
  const marketingKeys = ["marketing", "email_marketing", "marketing_emails", "promotions"]
  for (const key of marketingKeys) {
    if (s[key] === false) return false
  }

  return true
}

type ProfileRow = {
  id: string
  email: string | null
  notification_settings: Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth + admin gate ──────────────────────────────────────
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

    // ── 2. Validate + sanitize payload ────────────────────────────
    const body = await request.json().catch(() => ({}))

    const title = maskAdminCopy(String(body.title || "").trim()).slice(0, 120)
    const message = maskAdminCopy(String(body.message || "").trim()).slice(0, 2000)
    const previewText = maskAdminCopy(
      String(
        body.preview_text ||
          body.previewText ||
          "Something important is happening on Loop — jump in while it’s live.",
      ).trim(),
    ).slice(0, 240)
    const ctaLabel = maskAdminCopy(String(body.cta_label || body.ctaLabel || "Open Loop").trim()).slice(0, 60)
    const brandName = maskAdminCopy(String(body.brand_name || body.brandName || "Loop").trim()).slice(0, 60)

    // Normalize against https://loopapp.me; unsafe/invalid links fall back
    // to the site root so a javascript: or malformed URL can never ship.
    const rawActionUrl = body.action_url ?? body.actionUrl ?? null
    const actionUrl = rawActionUrl ? safeBroadcastHref(String(rawActionUrl)) : null

    const type = body.type === "trending" ? "trending" : "announcement"
    const preset =
      typeof body.preset === "string" && /^[a-z0-9_]{1,40}$/.test(body.preset) ? body.preset : null
    const scope = body.scope === "random" || body.scope === "sample" ? "random" : "all"
    const sampleSize = Math.min(Math.max(Number(body.sample_size) || 100, 1), 500)
    const sendEmail = Boolean(body.send_email)

    if (!title || !message) {
      return NextResponse.json({ error: "title and message are required" }, { status: 400 })
    }

    // ── 3. Select recipients from profiles ────────────────────────
    const { data: allProfiles, error } = await supabase
      .from("profiles")
      .select("id, email, notification_settings")
      .not("id", "is", null)
      .limit(10_000)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let targets: ProfileRow[] = (allProfiles || []) as ProfileRow[]
    if (scope === "random") {
      // Fisher–Yates on a copy — unbiased sample without mutating source
      targets = [...targets]
      for (let i = targets.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[targets[i], targets[j]] = [targets[j], targets[i]]
      }
      targets = targets.slice(0, sampleSize)
    }

    const userIds = targets.map((p) => p.id).filter(Boolean)

    // Email only users whose notification_settings allow marketing email
    const emailTargets = targets
      .filter((p) => {
        const email = typeof p.email === "string" ? p.email : ""
        if (!email.includes("@")) return false
        return allowsMarketingEmail(p.notification_settings)
      })
      .map((p) => p.email as string)

    // ── 4. In-app notifications (platform-originated copy) ────────
    let notified = 0
    try {
      await notifyUsers(supabase, userIds, {
        type,
        title,
        message,
        actionUrl: actionUrl || undefined,
        data: { broadcast: true, scope, ...(preset ? { preset } : {}) },
        pushCategory: "system",
      })
      notified = userIds.length
    } catch (notifyErr) {
      console.warn("Broadcast notification error:", notifyErr)
    }

    // ── 5. Batched emails via Resend ──────────────────────────────
    let emailed = 0
    if (sendEmail && isResendConfigured() && resend) {
      const emailInput = { title, message, actionUrl, ctaLabel, previewText, brandName }
      const emailHtml = buildBroadcastEmailHtml(emailInput)
      const emailText = buildBroadcastText(emailInput)

      const BATCH = 25
      for (let i = 0; i < emailTargets.length; i += BATCH) {
        const batch = emailTargets.slice(i, i + BATCH)
        try {
          const { error: batchError } = await resend.batch.send(
            batch.map((to) => ({
              from: EMAIL_FROM,
              to,
              subject: title,
              text: emailText,
              html: emailHtml,
              headers: {
                "List-Unsubscribe": `<${safeBroadcastHref("/settings?tab=notifications")}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
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
      preset,
      targets: targets.length,
      message: "Broadcast sent",
    })
  } catch (error: any) {
    console.error("Broadcast error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
