import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!import { type NextRequest, NextResponse } from "next/server"
,
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

export async function POST(request: NextRequest) {
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

    const { user_id: targetUserId, action } = await request.json()

    if (!targetUserId || !action) {
      return NextResponse.json(
        { error: "user_id and action are required" },
        { status: 400 }
      )
    }

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      )
    }

    // Check if target user exists
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", targetUserId)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (action === "follow") {
      // Check if already following
      const { data: existingFollow } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .single()

      if (existingFollow) {
        return NextResponse.json(
          { error: "Already following this user" },
          { status: 400 }
        )
      }

      // Create follow relationship
      const { error: followError } = await supabase
        .from("follows")
        .insert({
          follower_id: user.id,
          following_id: targetUserId,
        })

      if (followError) {
        console.error("Follow error:", followError)
        return NextResponse.json({ error: "Failed to follow user" }, { status: 500 })
      }

      // Create notification for the followed user
      await supabase.from("notifications").insert({
        user_id: targetUserId,
        type: "follow",
        title: "New Follower",
        message: `${user.email} started following you`,
        data: {
          follower_id: user.id,
          follower_username: user.email,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Successfully followed user",
        is_following: true,
      })

    } else if (action === "unfollow") {
      // Remove follow relationship
      const { error: unfollowError } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)

      if (unfollowError) {
        console.error("Unfollow error:", unfollowError)
        return NextResponse.json({ error: "Failed to unfollow user" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Successfully unfollowed user",
        is_following: false,
      })

    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'follow' or 'unfollow'" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error in follow/unfollow:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Get follow status
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("user_id")

    if (!targetUserId) {
      return NextResponse.json({ error: "user_id parameter is required" }, { status: 400 })
    }

    // Check if following
    const { data: followData } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .single()

    return NextResponse.json({
      success: true,
      is_following: !!followData,
    })
  } catch (error) {
    console.error("Error checking follow status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
