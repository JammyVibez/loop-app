import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"
import { logSecurityEvent, getRequestIp, getRequestUserAgent } from "@/lib/security-audit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (user) {
      void logSecurityEvent({
        userId: user.id,
        action: "logout",
        ip: getRequestIp(request),
        userAgent: getRequestUserAgent(request),
      })
    }
    await auth.api.signOut({
      headers: request.headers,
    }).catch(() => null)
  } catch (error) {
    console.error("Logout error:", error)
  }

  const response = NextResponse.json({ success: true })
  // Clear any auth cookies if needed
  response.cookies.delete("better-auth.session_token")
  return response
}
