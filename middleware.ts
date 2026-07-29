import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isAuthRequiredPath } from "@/lib/guest"

const alwaysPublic = new Set([
  "/",
  "/landing",
  "/login",
  "/signup",
  "/verify-email",
  "/email-confirmed",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/callback",
])

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("supabase") || cookie.name.startsWith("sb-"))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next()
  }

  if (alwaysPublic.has(pathname)) {
    return NextResponse.next()
  }

  // Only hard-block interactive account routes; browse routes stay open for guests
  if (!isAuthRequiredPath(pathname)) {
    return NextResponse.next()
  }

  if (!hasSupabaseSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
}
