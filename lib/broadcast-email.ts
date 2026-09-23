/**
 * Broadcast email rendering — HTML + plain-text fallback.
 *
 * Safety rules baked in here:
 * - every piece of copy is HTML-escaped before interpolation (no injection)
 * - action URLs are normalized against https://loopapp.me and only http(s)
 *   survives; javascript:, data:, malformed or empty input falls back to the
 *   site root, so an unsafe link can never ship in a sent email
 * - the plain-text version is always generated for deliverability
 */

export type BroadcastEmailInput = {
  title: string
  message: string
  actionUrl?: string | null
  ctaLabel?: string | null
  previewText?: string | null
  brandName?: string | null
}

export const DEFAULT_BRAND = "Loop"
export const DEFAULT_SITE_URL = "https://loopapp.me"
const PREFERENCES_URL = `${DEFAULT_SITE_URL}/settings?tab=notifications`

export function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Normalize any admin-supplied link to a safe absolute URL.
 * Relative paths ("/explore") resolve against loopapp.me; only http(s)
 * survives; everything else (javascript:, data:, garbage) returns null so
 * callers can fall back to the site root.
 */
export function normalizeBroadcastUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null
  const value = String(rawUrl).trim()
  if (!value) return null
  try {
    const url = new URL(value, DEFAULT_SITE_URL)
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString()
    }
  } catch {
    // ignore malformed input
  }
  if (value.startsWith("/")) return `${DEFAULT_SITE_URL}${value}`
  return null
}

/** Final CTA href: sanitized action URL, or the site root. */
export function safeBroadcastHref(rawUrl?: string | null): string {
  return normalizeBroadcastUrl(rawUrl) || DEFAULT_SITE_URL
}

/**
 * Premium social-product email: dark gradient hero header, white card on a
 * light background, bold headline, preview copy, rounded message panel,
 * gradient CTA, and a footer with preference links.
 */
export function buildBroadcastEmailHtml({
  title,
  message,
  actionUrl,
  ctaLabel,
  previewText,
  brandName,
}: BroadcastEmailInput): string {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />")
  const safePreview = escapeHtml(
    previewText || "Something important is happening on Loop — jump in while it’s live.",
  )
  const safeCta = escapeHtml(ctaLabel || "Open Loop")
  const safeBrand = escapeHtml(brandName || DEFAULT_BRAND)
  const safeUrl = escapeHtml(safeBroadcastHref(actionUrl))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;width:100%;">
          <!-- Dark gradient hero header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0b1226 0%,#131c3f 45%,#312e81 78%,#4338ca 100%);border-radius:22px 22px 0 0;padding:30px 28px 26px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size:15px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#ffffff;">
                    ${safeBrand}
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.28);color:#e0e7ff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
                      From the feed
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:22px;font-size:13px;font-weight:600;color:#a5b4fc;letter-spacing:0.06em;text-transform:uppercase;">
                    ${safePreview}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Premium white card -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 22px 22px;padding:34px 28px 12px;border:1px solid #e2e8f0;border-top:none;box-shadow:0 18px 40px rgba(11,18,38,0.10);">
              <h1 style="margin:0;color:#0b1226;font-size:27px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">
                ${safeTitle}
              </h1>
              <p style="margin:14px 0 0;color:#475569;font-size:15px;line-height:1.75;font-weight:500;">
                ${safePreview}
              </p>
              <!-- Rounded message panel -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;">
                <tr>
                  <td style="padding:20px 20px 18px;color:#334155;font-size:14.5px;line-height:1.75;white-space:pre-line;">
${safeMessage}
                  </td>
                </tr>
              </table>
              <!-- CTA button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
                <tr>
                  <td align="center" style="border-radius:999px;background:linear-gradient(135deg,#4f46e5 0%,#6366f1 55%,#8b5cf6 100%);box-shadow:0 14px 28px rgba(79,70,229,0.32);">
                    <a href="${safeUrl}" style="display:inline-block;padding:15px 30px;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:0.01em;border-radius:999px;">
                      ${safeCta} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer with preferences links -->
          <tr>
            <td style="padding:22px 12px 0;text-align:center;color:#94a3b8;font-size:12px;line-height:1.7;">
              <p style="margin:0;">
                You're receiving this because you have a Loop account.
                <br />
                <a href="${PREFERENCES_URL}" style="color:#6366f1;text-decoration:none;font-weight:600;">Manage email preferences</a>
                &nbsp;•&nbsp;
                <a href="${PREFERENCES_URL}" style="color:#6366f1;text-decoration:none;font-weight:600;">Unsubscribe</a>
              </p>
              <p style="margin:8px 0 0;color:#cbd5e1;">${escapeHtml(DEFAULT_SITE_URL)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Plain-text fallback — always sent alongside the HTML version. */
export function buildBroadcastText({
  title,
  message,
  actionUrl,
  ctaLabel,
  previewText,
  brandName,
}: BroadcastEmailInput): string {
  const url = safeBroadcastHref(actionUrl)
  const lines = [
    title,
    "",
    previewText || "Something important is happening on Loop — jump in while it’s live.",
    "",
    message,
    "",
    `${ctaLabel || "Open Loop"}: ${url}`,
    "",
    `Manage email preferences: ${PREFERENCES_URL}`,
    `Unsubscribe: ${PREFERENCES_URL}`,
    `— ${brandName || DEFAULT_BRAND}`,
  ]
  return lines.join("\n")
}
