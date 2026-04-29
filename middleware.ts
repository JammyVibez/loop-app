import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicRoutes = new Set([
  "/",
  "/landing",
  "/login",
  "/signup",
  "/verify-email",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/callback",
])

const protectedPrefixes = ["/messages", "/circles", "/shop", "/settings", "/notifications", "/create"]

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
    pathname.startsWith("/manifest")
  ) {
    return NextResponse.next()
  }

  if (publicRoutes.has(pathname)) {
    return NextResponse.next()
  }

  const isProtectedRoute = protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
  if (!isProtectedRoute) {
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
