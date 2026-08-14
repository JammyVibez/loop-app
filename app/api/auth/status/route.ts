import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Non-sensitive config flags used by the login/signup UI to show accurate
 * messaging (e.g. "Google sign-in is being set up" vs a hard error). Never
 * returns secret values.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    auth: {
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      emailPassword: true,
      resetPassword: Boolean(process.env.RESEND_API_KEY),
    },
  })
}
