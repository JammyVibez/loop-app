import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServerClient()
    const { id: targetUserId } = await params
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const viewerUser = await getUserFromRequest(request)
    const viewerId: string | null = viewerUser?.id || null

    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, username, privacy_settings")
      .eq("id", targetUserId)
      .maybeSingle()

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

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

    const { data: followers, error: followersError } = await supabase
      .from("follows")
      .select(
        `
        id,
        created_at,
        follower:profiles!follower_id(
          id,
          username,
          display_name,
          avatar_url, video_avatar_url,
          is_verified,
          is_premium
        )
      `,
      )
      .eq("following_id", targetUserId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (followersError) {
      return NextResponse.json({ error: followersError.message }, { status: 500 })
    }

    const followerIds = (followers || []).map((f: any) => f.follower?.id).filter(Boolean)
    let currentUserFollowing = new Set<string>()
    if (viewerId && followerIds.length) {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewerId)
        .in("following_id", followerIds)
      currentUserFollowing = new Set((data || []).map((f) => f.following_id))
    }

    const formattedFollowers = (followers || [])
      .map((follow: any) => {
        if (!follow.follower?.id) return null
        return {
          ...follow.follower,
          followed_at: follow.created_at,
          is_following: currentUserFollowing.has(follow.follower.id),
          is_self: follow.follower.id === viewerId,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      followers: formattedFollowers,
      has_more: (followers || []).length === limit,
    })
  } catch (error) {
    console.error("Error fetching followers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
