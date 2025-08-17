import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromToken(token: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const targetUserId = params.id
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Check if target user exists
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, username, privacy_settings")
      .eq("id", targetUserId)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check privacy settings
    const privacySettings = targetUser.privacy_settings || {}
    const profileVisibility = privacySettings.profile_visibility || "public"

    if (profileVisibility === "private" && targetUserId !== user.id) {
      // Check if current user follows the target user
      const { data: followData } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .single()

      if (!followData) {
        return NextResponse.json({ error: "This profile is private" }, { status: 403 })
      }
    }

    // Get followers with user details
    const { data: followers, error: followersError } = await supabase
      .from("follows")
      .select(`
        id,
        created_at,
        follower:profiles!follower_id(
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          verification_level
        )
      `)
      .eq("following_id", targetUserId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (followersError) {
      console.error("Database error:", followersError)
      return NextResponse.json({ error: "Failed to fetch followers" }, { status: 500 })
    }

    // Check if current user follows each follower
    const followerIds = followers?.map((f: any) => f.follower.id) || []
    let currentUserFollowing: string[] = []

    if (followerIds.length > 0) {
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in("following_id", followerIds)

      currentUserFollowing = followingData?.map(f => f.following_id) || []
    }

    // Format response
    const formattedFollowers = followers?.map((follow: any) => ({
      ...follow.follower,
      followed_at: follow.created_at,
      is_following: currentUserFollowing.includes(follow.follower.id),
      is_self: follow.follower.id === user.id,
    })) || []

    return NextResponse.json({
      success: true,
      followers: formattedFollowers,
      has_more: followers?.length === limit,
      total_count: formattedFollowers.length,
    })
  } catch (error) {
    console.error("Error fetching followers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
