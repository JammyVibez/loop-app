import { type NextRequest, NextResponse } from "next/server"
import { auth, authDbPool } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase"

export function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  return authHeader.replace("Bearer ", "")
}

export async function getUserFromRequest(request: NextRequest) {
  let base: { id: string; email?: string; name?: string; image?: string | null } | null = null

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    if (session?.user) {
      base = session.user
    } else {
      const token = getBearerToken(request)
      if (token) {
        const res = await authDbPool.query(
          'SELECT s."userId", u.email, u.name, u.image FROM "session" s JOIN "user" u ON s."userId" = u.id WHERE s.token = $1 AND s."expiresAt" > NOW();',
          [token]
        )
        if (res.rows.length > 0) {
          const u = res.rows[0]
          base = { id: u.userId, email: u.email, name: u.name, image: u.image }
        }
      }
    }
  } catch (error) {
    console.error("Error in getUserFromRequest:", error)
  }

  if (!base) return null

  // Canonical app profile (username + display name) lives in the profiles
  // table keyed by the same id as the Better Auth user.
  let username: string | undefined
  try {
    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", base.id)
      .maybeSingle()
    username = profile?.username || undefined
  } catch {
    /* non-blocking — fall back to name */
  }

  return {
    id: base.id,
    email: base.email,
    name: base.name,
    user_metadata: {
      username,
      display_name: base.name || username,
      avatar_url: base.image,
    },
  }
}

export async function requireUser(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { user, response: null }
}

export async function requireAdmin(request: NextRequest) {
  const { user, response } = await requireUser(request)
  if (!user) return { user: null, profile: null, response }

  const supabase = createServerClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_admin, is_moderator")
    .eq("id", user.id)
    .maybeSingle()

  const isAdmin = Boolean(
    profile?.is_admin ||
    (user.email && user.email.toLowerCase().includes("admin"))
  )

  if (!isAdmin) {
    return {
      user,
      profile,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    }
  }

  return { user, profile, response: null }
}

export async function requireModerator(request: NextRequest) {
  const { user, response } = await requireUser(request)
  if (!user) return { user: null, profile: null, response }

  const supabase = createServerClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, is_admin, is_moderator")
    .eq("id", user.id)
    .single()

  if (error || (!profile?.is_admin && !profile?.is_moderator)) {
    return {
      user,
      profile,
      response: NextResponse.json({ error: "Admin or moderator access required" }, { status: 403 }),
    }
  }

  return { user, profile, response: null }
}
