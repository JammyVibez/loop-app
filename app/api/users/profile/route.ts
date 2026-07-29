import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoops } from "@/lib/normalize-loop"

async function getUserFromToken(token: string) {
  try {
    const supabase = createServerClient()
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

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const username = request.nextUrl.searchParams.get("username")
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : ""
    const authedUser = token ? await getUserFromToken(token) : null

    // Public profile lookup by username (used by /profile/[username]).
    // If username is omitted, require auth and return the current user's profile.
    let profileQuery = supabase.from("profiles").select("*")
    if (username) {
      profileQuery = profileQuery.eq("username", username)
    } else {
      if (!authedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      profileQuery = profileQuery.eq("id", authedUser.id)
    }

    const { data: profile, error: profileError } = await profileQuery.single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const [{ count: followersCount }, { count: followingCount }, { count: loopsCount }, { count: branchesCount }, { data: recentLoops }, { data: recentBranches }, { data: mediaLoops }, { data: followRecord }, { data: activeItems }] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", profile.id),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", profile.id),
      supabase.from("loops").select("id", { count: "exact", head: true }).eq("author_id", profile.id).is("parent_loop_id", null),
      supabase.from("loops").select("id", { count: "exact", head: true }).eq("author_id", profile.id).not("parent_loop_id", "is", null),
      supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .eq("author_id", profile.id)
        .is("parent_loop_id", null)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .eq("author_id", profile.id)
        .not("parent_loop_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("loops")
        .select(`
          id, content, content_text, content_media_url, content_type, media_url, media_urls, media_type, hashtags, created_at,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .eq("author_id", profile.id)
        .or("media_url.not.is.null,content_media_url.not.is.null")
        .order("created_at", { ascending: false })
        .limit(36),
      authedUser
        ? supabase
            .from("follows")
            .select("id")
            .eq("follower_id", authedUser.id)
            .eq("following_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase
        .from("user_inventory")
        .select("id, item_id, item_type, is_active, shop_item:shop_items(id, name, category, item_type, item_data, preview_data)")
        .eq("user_id", profile.id)
        .eq("is_active", true)
        .limit(12),
    ])

    const likesReceived = (recentLoops || []).reduce((sum, loop: any) => {
      const stats = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats
      return sum + Number(stats?.likes_count || 0)
    }, 0)

    const { cosmeticsFromInventory } = await import("@/lib/cosmetics")
    const derivedCosmetics = cosmeticsFromInventory(activeItems || [])

    const profileWithSocial = {
      ...profile,
      followers_count: followersCount ?? profile.followers_count ?? 0,
      following_count: followingCount ?? profile.following_count ?? 0,
      loops_count: loopsCount ?? profile.loops_count ?? 0,
      branches_count: branchesCount ?? profile.branches_count ?? 0,
      likes_received: likesReceived,
      level: profile.level ?? 1,
      xp_points: profile.xp_points ?? 0,
      achievements: profile.achievements ?? [],
      active_theme: profile.active_theme ?? null,
      theme_preferences: profile.theme_preferences ?? null,
      active_effects: activeItems || [],
      active_cosmetics:
        profile.active_cosmetics && Object.keys(profile.active_cosmetics || {}).length
          ? profile.active_cosmetics
          : derivedCosmetics,
      available_earnings: profile.available_earnings ?? 0,
      total_earnings: profile.total_earnings ?? 0,
      recent_loops: normalizeLoops(recentLoops || []),
      recent_branches: normalizeLoops(recentBranches || []),
      media_loops: normalizeLoops(mediaLoops || []),
      is_following: Boolean(followRecord),
    }

    return NextResponse.json({
      success: true,
      profile: profileWithSocial,
    })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    const updates = await request.json()
    const supabase = createServerClient()

    // Validate allowed fields
    const allowedFields = [
      'display_name',
      'bio',
      'location',
      'website',
      'avatar_url',
      'banner_url',
      'theme_data',
      'privacy_settings',
      'notification_settings'
    ]

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {} as any)

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // Add updated_at timestamp
    filteredUpdates.updated_at = new Date().toISOString()

    // Update profile
    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update(filteredUpdates)
      .eq("id", user.id)
      .select("*")
      .single()

    if (updateError) {
      console.error("Profile update error:", updateError)
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
