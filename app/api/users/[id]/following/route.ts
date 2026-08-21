import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServerClient()
    const { id: targetUserId } = await params
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "") || null
    let viewerId: string | null = null
    if (token) {
      const {
        data: { user },
      } = await supabase.auth.getUser(token)
      viewerId = user?.id || null
    }

    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, username, privacy_settings")
      .eq("id", targetUserId)
      .maybeSingle()

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // A private profile's following list is only visible to approved followers
    // (mirrors the followers route so neither list leaks for private users).
    const privacySettings = (targetUser.privacy_settings || {}) as Record<string, any>
    const profileVisibility = privacySettings.profile_visibility || "public"
    if (["private", "followers"].includes(profileVisibility) && targetUserId !== viewerId) {
      if (!viewerId) {
        return NextResponse.json({ error: "This profile is private" }, { status: 403 })
      }
      const { data: followData } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", viewerId)
        .eq("following_id", targetUserId)
        .maybeSingle()
      if (!followData) {
        return NextResponse.json({ error: "This profile is private" }, { status: 403 })
      }
    }

    const { data: following, error: followingError } = await supabase
      .from("follows")
      .select(`
        id,
        created_at,
        following:profiles!following_id(
          id,
          username,
          display_name,
          avatar_url, video_avatar_url,
          is_verified,
          is_premium
        )
      `)
      .eq("follower_id", targetUserId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (followingError) {
      return NextResponse.json({ error: followingError.message }, { status: 500 })
    }

    const followingIds = (following || []).map((f: any) => f.following?.id).filter(Boolean)
    let currentUserFollowing = new Set<string>()
    if (viewerId && followingIds.length) {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewerId)
        .in("following_id", followingIds)
      currentUserFollowing = new Set((data || []).map((f) => f.following_id))
    }

    const formattedFollowing = (following || []).map((follow: any) => ({
      ...follow.following,
      followed_at: follow.created_at,
      is_following: currentUserFollowing.has(follow.following?.id),
      is_self: follow.following?.id === viewerId,
    }))

    return NextResponse.json({
      success: true,
      following: formattedFollowing,
      has_more: (following || []).length === limit,
    })
  } catch (error) {
    console.error("Error fetching following:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
