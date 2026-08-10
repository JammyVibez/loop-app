import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
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
