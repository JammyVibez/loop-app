export type BroadcastEmailInput = {
  title: string
  message: string
  actionUrl?: string | null
  ctaLabel?: string
  previewText?: string
  brandName?: string
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function normalizeUrl(rawUrl?: string | null) {
  if (!rawUrl) return null
  const value = String(rawUrl).trim()
  if (!value) return null
  try {
    const url = new URL(value, "https://loopapp.me")
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString()
    }
  } catch {
    // ignore invalid protocol or malformed input
  }
  if (value.startsWith("/")) return `https://loopapp.me${value}`
  return null
}

export function buildBroadcastEmailHtml({
  title,
  message,
  actionUrl,
  ctaLabel = "Open Loop",
  previewText,
  brandName = "loopapp.me",
}: BroadcastEmailInput) {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />")
  const safePreview = escapeHtml(previewText || "Something important is happening on Loop — jump in while it’s live.")
  const safeCta = escapeHtml(ctaLabel)
  const safeUrl = normalizeUrl(actionUrl) || "https://loopapp.me"

  const hero = `
    <div style="background:linear-gradient(135deg,#0f172a 0%,#111827 40%,#1d4ed8 100%);padding:32px 24px 20px;">
      <div style="max-width:620px;margin:0 auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="font-size:14px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#e2e8f0;">${escapeHtml(brandName)}</div>
          <div style="padding:6px 10px;border-radius:999px;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.5);color:#a7f3d0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Live now</div>
        </div>
      </div>
    </div>
  `

  const button = `
    <p style="margin:28px 0 0;">
      <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#34d399 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 24px;border-radius:9999px;box-shadow:0 12px 24px rgba(16,185,129,0.25);">
        ${safeCta}
      </a>
    </p>
  `

  return `
    <div style="background:#f8fafc;padding:32px 14px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 20px 48px rgba(15,23,42,0.08);">
        ${hero}
        <div style="padding:32px 24px 10px;">
          <p style="margin:0 0 12px;color:#334155;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
            New on Loop
          </p>
          <h1 style="margin:0;color:#0f172a;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.03em;">${safeTitle}</h1>
          <p style="margin:16px 0 0;color:#475569;font-size:15px;line-height:1.75;">
            ${safePreview}
          </p>
          <div style="margin-top:24px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;padding:18px 18px 16px;">
            <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;line-height:1.6;">${safeTitle}</p>
            <p style="margin:12px 0 0;color:#475569;font-size:14px;line-height:1.7;white-space:pre-line;">${safeMessage}</p>
          </div>
          ${button}
        </div>

        <div style="padding:0 24px 30px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:18px;margin-top:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
            <div style="color:#64748b;font-size:12px;line-height:1.6;">
              You’re receiving this because you have a Loop account.
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;color:#7c3aed;font-size:12px;font-weight:600;">
              <a href="https://loopapp.me/settings?tab=notifications" style="color:#7c3aed;text-decoration:none;">Manage email preferences</a>
              <span style="color:#cbd5e1;">•</span>
              <a href="https://loopapp.me/settings?tab=notifications" style="color:#7c3aed;text-decoration:none;">Unsubscribe</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

export function buildBroadcastText({ title, message, actionUrl, ctaLabel = "Open Loop" }: BroadcastEmailInput) {
  const url = normalizeUrl(actionUrl) || "https://loopapp.me"
  return [
    title,
    "",
    message,
    "",
    `${ctaLabel}: ${url}`,
    "",
    "Manage email preferences: https://loopapp.me/settings?tab=notifications",
  ].join("\n")
}
