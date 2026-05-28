import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  return authHeader.replace("Bearer ", "")
}

export async function getUserFromRequest(request: NextRequest) {
  const token = getBearerToken(request)
  if (!token) return null

  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
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
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, is_admin, is_moderator")
    .eq("id", user.id)
    .single()

  if (error || !profile?.is_admin) {
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
