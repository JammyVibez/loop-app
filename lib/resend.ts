import { Resend } from "resend"

// Transactional email client (password resets, verification, etc.).
// When RESEND_API_KEY is missing the app degrades gracefully: callers check
// `isResendConfigured()` and log the email instead of crashing.
export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export function isResendConfigured() {
  return Boolean(resend && process.env.RESEND_API_KEY)
}

export const EMAIL_FROM = process.env.EMAIL_FROM || "Loop <no-reply@loop-app.com>"

/**
 * Send a password-reset email. Never throws — logs and returns false on
 * failure so the caller can still show a friendly message to the user.
 */
export async function sendPasswordResetEmail(opts: { to: string; resetUrl: string }) {
  if (!isResendConfigured() || !resend) {
    console.log(`[auth] Password reset requested for ${opts.to}: ${opts.resetUrl}`)
    return false
  }
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: opts.to,
      subject: "Reset your Loop password",
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h1 style="font-size:20px;margin:0 0 8px;">Reset your Loop password</h1>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
            We received a request to reset the password for your Loop account. Click the button below
            to choose a new password. This link expires in 1 hour.
          </p>
          <a href="${opts.resetUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:9999px;">
            Reset password
          </a>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:24px 0 0;">
            If you didn't request this, you can safely ignore this email — your password won't change.
            If the button doesn't work, paste this link into your browser:
            <br /><a href="${opts.resetUrl}" style="color:#7c3aed;word-break:break-all;">${opts.resetUrl}</a>
          </p>
        </div>
      `,
    })
    if (error) {
      console.error("[resend] Password reset email failed:", error)
      return false
    }
    return true
  } catch (err) {
    console.error("[resend] Password reset email error:", err)
    return false
  }
}
