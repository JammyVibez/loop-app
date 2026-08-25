import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

/**
 * Suggest people to follow based on shared interests, activity, and not-already-following.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 8), 20)
    const user = await getUser(request)

    let followingIds: string[] = []
    let myInterests: string[] = []

    if (user) {
      const [{ data: following }, { data: me }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("profiles").select("interests").eq("id", user.id).maybeSingle(),
      ])
      followingIds = (following || []).map((row) => row.following_id).filter(Boolean)
      myInterests = Array.isArray(me?.interests) ? me!.interests.map(String) : []
    }

    const exclude = new Set<string>([...(user ? [user.id] : []), ...followingIds])

    // Prefer users with overlapping interests when available
    let { data: candidates, error } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, is_admin, is_organization, organization_badge_url, organization_name, bio, interests, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(80)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const scored = (candidates || [])
      .filter((profile) => !exclude.has(profile.id) && profile.username)
      .map((profile) => {
        const interests = Array.isArray(profile.interests) ? profile.interests.map(String) : []
        const overlap = interests.filter((interest) =>
          myInterests.some((mine) => mine.toLowerCase() === interest.toLowerCase()),
        ).length
        const premiumBoost = profile.is_premium ? 2 : 0
        const verifiedBoost = profile.is_verified ? 1 : 0
        // Official accounts (admins) always rank first so new users follow
        // the platform's team during onboarding.
        const adminBoost = profile.is_admin ? 1000 : 0
        return {
          ...profile,
          shared_interests: overlap,
          score: adminBoost + overlap * 5 + premiumBoost + verifiedBoost,
          reason:
            profile.is_admin
              ? "Official Loop account"
              : overlap > 0
                ? `Shares ${overlap} interest${overlap > 1 ? "s" : ""} with you`
                : profile.is_premium
                  ? "Active premium creator"
                  : "New on Loop",
        }
      })
      .sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at))
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      suggestions: scored,
    })
  } catch (error: any) {
    console.error("suggestions error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
