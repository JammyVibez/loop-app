import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

export async function POST(request: NextRequest) {
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    },
  )

  await supabase.auth.signOut()

  const response = NextResponse.json({ success: true })
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}
