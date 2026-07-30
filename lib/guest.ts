/** Routes guests may browse without signing in */
export const GUEST_PUBLIC_PREFIXES = [
  "/",
  "/landing",
  "/login",
  "/signup",
  "/terms",
  "/privacy",
  "/reset-password",
  "/verify-email",
  "/email-confirmed",
  "/explore",
  "/trending",
  "/profile",
  "/loop",
  "/hashtag",
  "/search",
  "/reels",
  "/marketplace",
  "/invite",
  "/offline",
] as const

/** Interactive / account routes that always require auth */
export const AUTH_REQUIRED_PREFIXES = [
  "/messages",
  "/circles",
  "/shop",
  "/settings",
  "/notifications",
  "/create",
  "/onboarding",
  "/admin",
  "/bookmarks",
  "/premium",
  "/streams",
  "/inventory",
] as const

export function isGuestPublicPath(pathname: string) {
  if (!pathname) return false
  return GUEST_PUBLIC_PREFIXES.some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)) || (route === "/" && pathname === "/"),
  )
}

export function isAuthRequiredPath(pathname: string) {
  return AUTH_REQUIRED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function loginHref(nextPath?: string | null, reason?: string) {
  const params = new URLSearchParams()
  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    params.set("redirect", nextPath)
  }
  if (reason) params.set("reason", reason)
  const qs = params.toString()
  return qs ? `/login?${qs}` : "/login"
}
