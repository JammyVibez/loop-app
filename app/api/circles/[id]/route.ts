import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { hardDeleteCircle, setCircleActive } from "@/lib/circle-lifecycle";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "") ?? null
    const currentUser = token ? await getUserFromToken(token) : null

    const { id: circleId } = await params

    // Fetch circle details with owner info
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified, is_premium),
        creator:profiles!creator_id(id, username, display_name, avatar_url, is_verified, is_premium),
        member_count:circle_members(count)
      `)
      .eq("id", circleId)
      .single()

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Check if current user is a member
    let isMember = false
    let userRole = "guest"
    let membershipStatus: string | null = null
    let isPlatformAdmin = false

    if (currentUser) {
      const [{ data: memberData }, { data: adminProfile }] = await Promise.all([
        supabase
          .from("circle_members")
          .select("role, status")
          .eq("circle_id", circleId)
          .eq("user_id", currentUser.id)
          .maybeSingle(),
        supabase.from("profiles").select("is_admin").eq("id", currentUser.id).maybeSingle(),
      ])

      isPlatformAdmin = Boolean(adminProfile?.is_admin)

      if (memberData) {
        const status = String(memberData.status || "active").toLowerCase()
        membershipStatus = status
        if (["active", "approved"].includes(status) || !memberData.status) {
          isMember = true
          userRole = memberData.role || "member"
        }
      }

      // Circle owner always has dashboard access even if membership row is missing/stale.
      if (circle.owner_id === currentUser.id || circle.creator_id === currentUser.id) {
        isMember = true
        userRole = "owner"
        membershipStatus = "active"
      }
    }

    const canManageLifecycle =
      userRole === "owner" || userRole === "admin" || isPlatformAdmin

    // Deactivated communities are hidden from the public; managers can still open admin.
    if (circle.is_active === false && !canManageLifecycle) {
      return NextResponse.json(
        {
          error: "This community has been deactivated",
          deactivated: true,
          circle: {
            id: circle.id,
            name: circle.name,
            description: circle.description,
            avatar_url: circle.avatar_url,
            is_active: false,
          },
        },
        { status: 410 },
      )
    }

    const memberCount = Array.isArray(circle.member_count) ? circle.member_count[0]?.count || 0 : Number(circle.member_count || 0)

    // Private circles must not leak posts/events/rooms/discussion content to
    // non-approved visitors — they should only see enough to decide whether
    // to request access, and land on a waiting screen once requested.
    const canViewContent = !circle.is_private || isMember

    if (!canViewContent) {
      return NextResponse.json({
        success: true,
        locked: true,
        circle: {
          id: circle.id,
          name: circle.name,
          description: circle.description,
          category: circle.category,
          avatar_url: circle.avatar_url,
          banner_url: circle.banner_url,
          is_private: circle.is_private,
          owner: circle.owner || circle.creator,
          member_count: memberCount,
          is_member: isMember,
          user_role: userRole,
          membership_status: membershipStatus,
          created_at: circle.created_at,
        },
        is_member: isMember,
        user_role: userRole,
        membership_status: membershipStatus,
        posts: [],
        events: [],
        rooms: [],
      })
    }

    // Get recent posts
    const { data: posts } = await supabase
      .from("circle_posts")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(20)

    // Posts previously always reported is_liked: false regardless of the
    // viewer's actual interactions, which desynced the like button after a
    // page refresh (server said "not liked" even though it was).
    let likedPostIds = new Set<string>()
    if (currentUser && posts && posts.length > 0) {
      const { data: likeRows } = await supabase
        .from("circle_post_interactions")
        .select("post_id")
        .eq("user_id", currentUser.id)
        .eq("interaction_type", "like")
        .in("post_id", posts.map((p: any) => p.id))
      likedPostIds = new Set((likeRows || []).map((r: any) => r.post_id))
    }

    // Get upcoming events
    const { data: events } = await supabase
      .from("circle_events")
      .select("*")
      .eq("circle_id", circleId)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5)

    // Get rooms
    const { data: rooms } = await supabase
      .from("circle_rooms")
      .select("*")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })

    // Real stats — computed the same way here for both the main community
    // page (which reads circle.stats.* directly) and the admin dashboard
    // (which remaps post_count/comment_count with fallbacks). Previously
    // this only returned member_count/post_count/room_count/event_count,
    // so the community page's "Total Comments"/"Active Members"/"Weekly
    // Growth" cards — which read total_comments/active_members/
    // weekly_growth — always showed 0 no matter what actually happened.
    const [{ count: totalPostsCount }, { count: activeMembersCount }, { count: newMembersThisWeek }, { data: postCommentRows }] =
      await Promise.all([
        supabase.from("circle_posts").select("id", { count: "exact", head: true }).eq("circle_id", circleId),
        supabase.from("circle_members").select("id", { count: "exact", head: true }).eq("circle_id", circleId).eq("status", "active"),
        supabase
          .from("circle_members")
          .select("id", { count: "exact", head: true })
          .eq("circle_id", circleId)
          .gte("joined_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("circle_posts").select("comment_count").eq("circle_id", circleId),
      ])

    const totalComments = (postCommentRows || []).reduce((sum, p: any) => sum + Number(p.comment_count || 0), 0)
    const weeklyGrowth = memberCount > 0 ? Math.round(((newMembersThisWeek || 0) / memberCount) * 100) : 0

    return NextResponse.json({
      success: true,
      locked: false,
      circle: {
        ...circle,
        owner: circle.owner || circle.creator,
        member_count: memberCount,
        is_member: isMember,
        user_role: userRole,
        membership_status: membershipStatus,
        stats: {
          member_count: memberCount,
          post_count: totalPostsCount || 0,
          room_count: rooms?.length || 0,
          event_count: events?.length || 0,
          total_posts: totalPostsCount || 0,
          total_comments: totalComments,
          active_members: activeMembersCount || 0,
          weekly_growth: weeklyGrowth,
        }
      },
      is_member: isMember,
      user_role: userRole,
      membership_status: membershipStatus,
      posts: (posts || []).map((post: any) => ({
        ...post,
        timestamp: post.created_at,
        likes: post.like_count || 0,
        comments: post.comment_count || 0,
        shares: post.share_count || 0,
        is_liked: likedPostIds.has(post.id),
        is_bookmarked: false,
      })),
      events: events || [],
      rooms: rooms || []
    })
  } catch (error) {
    console.error("Error fetching circle details:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: circleId } = await params

    // Check if user has permission to edit (owner or admin)
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .single()

    if (!member) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { 
      name, 
      description, 
      category, 
      is_private, 
      avatar_url, 
      banner_url,
      rules,
      tags,
      settings: settingsPatch,
      allow_posts,
    } = body

    // Merge settings (used for allow_posts and other community toggles)
    let nextSettings: Record<string, unknown> | undefined
    if (settingsPatch !== undefined || typeof allow_posts === "boolean") {
      const { data: current } = await supabase
        .from("circles")
        .select("settings")
        .eq("id", circleId)
        .maybeSingle()
      const existing =
        current?.settings && typeof current.settings === "object" ? (current.settings as Record<string, unknown>) : {}
      const patch =
        settingsPatch && typeof settingsPatch === "object" ? (settingsPatch as Record<string, unknown>) : {}
      nextSettings = {
        ...existing,
        ...patch,
        ...(typeof allow_posts === "boolean" ? { allow_posts } : {}),
        ...(typeof patch.allow_posts === "boolean" ? { allow_posts: patch.allow_posts } : {}),
      }
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (typeof name === "string") updatePayload.name = name.trim()
    if (typeof description === "string") updatePayload.description = description.trim()
    if (category !== undefined) updatePayload.category = category
    if (typeof is_private === "boolean") updatePayload.is_private = is_private
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url
    if (banner_url !== undefined) updatePayload.banner_url = banner_url
    if (rules !== undefined) updatePayload.rules = rules
    if (tags !== undefined) updatePayload.tags = tags
    if (nextSettings !== undefined) updatePayload.settings = nextSettings

    // Update circle
    let { data: updatedCircle, error: updateError } = await supabase
      .from("circles")
      .update(updatePayload)
      .eq("id", circleId)
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url)
      `)
      .single()

    // Compat if settings column missing
    if (updateError?.code === "PGRST204" && "settings" in updatePayload) {
      delete updatePayload.settings
      ;({ data: updatedCircle, error: updateError } = await supabase
        .from("circles")
        .update(updatePayload)
        .eq("id", circleId)
        .select(`
          *,
          owner:profiles!owner_id(id, username, display_name, avatar_url)
        `)
        .single())
    }

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update circle" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      circle: updatedCircle
    })
  } catch (error) {
    console.error("Error updating circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { id: circleId } = await params
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || "")

    const { data: circle } = await supabase
      .from("circles")
      .select("id, owner_id, creator_id, is_active")
      .eq("id", circleId)
      .maybeSingle()

    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })

    const [{ data: member }, { data: adminProfile }] = await Promise.all([
      supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .maybeSingle(),
      supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    ])

    const isOwner = circle.owner_id === user.id || circle.creator_id === user.id
    const canManage = isOwner || Boolean(member) || Boolean(adminProfile?.is_admin)
    if (!canManage) {
      return NextResponse.json({ error: "Only community admins can manage this circle" }, { status: 403 })
    }

    if (action === "deactivate" || action === "activate") {
      const { data, error } = await setCircleActive(supabase, circleId, action === "activate", user.id)
      if (error) {
        // Compat without lifecycle columns
        if (error.code === "PGRST204" || /is_active|deactivated/i.test(error.message || "")) {
          return NextResponse.json(
            { error: "Deactivate requires a database update. Please retry after schema sync." },
            { status: 500 },
          )
        }
        return NextResponse.json({ error: error.message || "Failed to update circle status" }, { status: 500 })
      }
      return NextResponse.json({
        success: true,
        circle: data,
        message: action === "activate" ? "Community reactivated" : "Community deactivated",
      })
    }

    return NextResponse.json({ error: "Invalid action. Use activate or deactivate." }, { status: 400 })
  } catch (error) {
    console.error("Error patching circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: circleId } = await params

    const { data: circle } = await supabase
      .from("circles")
      .select("owner_id, creator_id")
      .eq("id", circleId)
      .maybeSingle()

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    const [{ data: member }, { data: adminProfile }] = await Promise.all([
      supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .maybeSingle(),
      supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    ])

    const isOwner = circle.owner_id === user.id || circle.creator_id === user.id
    const canDelete = isOwner || member?.role === "admin" || Boolean(adminProfile?.is_admin)
    if (!canDelete) {
      return NextResponse.json({ error: "Only community admins can delete this circle" }, { status: 403 })
    }

    const { error: deleteError } = await hardDeleteCircle(supabase, circleId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete circle" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Circle deleted successfully. All community content has been removed.",
    })
  } catch (error) {
    console.error("Error deleting circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
