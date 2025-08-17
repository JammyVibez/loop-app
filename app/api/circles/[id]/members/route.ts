import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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

// Get circle members
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const role = searchParams.get("role")
    const search = searchParams.get("search")

    const circleId = params.id

    let query = supabase
      .from("circle_members")
      .select(`
        *,
        user:profiles(id, username, display_name, avatar_url, is_verified, is_premium, last_active, loop_coins, level)
      `)
      .eq("circle_id", circleId)
      .order("joined_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (role) {
      query = query.eq("role", role)
    }

    if (search) {
      query = query.ilike("profiles.display_name", `%${search}%`)
    }

    const { data: members, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      members: members || [],
      hasMore: members?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching circle members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update member role (admin/moderator actions)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    const circleId = params.id
    const { targetUserId, newRole } = await request.json()

    // Check if requesting user has permission (owner or admin)
    const { data: requestingMember } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .single()

    if (!requestingMember) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Validate role
    const validRoles = ["member", "moderator", "admin"]
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Update member role
    const { data: updatedMember, error: updateError } = await supabase
      .from("circle_members")
      .update({ role: newRole })
      .eq("circle_id", circleId)
      .eq("user_id", targetUserId)
      .select(`
        *,
        user:profiles(id, username, display_name, avatar_url)
      `)
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update member role" }, { status: 500 })
    }

    if (!updatedMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      member: updatedMember,
      message: `Member role updated to ${newRole}`
    })
  } catch (error) {
    console.error("Error updating member role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Remove member (kick/ban)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const circleId = params.id
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("userId")
    const action = searchParams.get("action") || "remove" // remove or ban

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 })
    }

    // Check if requesting user has permission (owner or admin/moderator)
    const { data: requestingMember } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "moderator"])
      .single()

    if (!requestingMember) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check target user's role to prevent lower roles from removing higher roles
    const { data: targetMember } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", targetUserId)
      .single()

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Role hierarchy check
    const roleHierarchy: { [key: string]: number } = { "owner": 3, "admin": 2, "moderator": 1, "member": 0 }
    if (roleHierarchy[requestingMember.role] <= roleHierarchy[targetMember.role] && 
        !(requestingMember.role === "owner")) {
      return NextResponse.json({ 
        error: "Cannot remove user with equal or higher role" 
      }, { status: 403 })
    }

    // Perform action
    if (action === "ban") {
      // Ban member
      const { error: banError } = await supabase
        .from("circle_members")
        .update({ 
          status: "banned",
          updated_at: new Date().toISOString()
        })
        .eq("circle_id", circleId)
        .eq("user_id", targetUserId)

      if (banError) {
        console.error("Database ban error:", banError)
        return NextResponse.json({ error: "Failed to ban member" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Member banned successfully"
      })
    } else {
      // Remove member
      const { error: removeError } = await supabase
        .from("circle_members")
        .delete()
        .eq("circle_id", circleId)
        .eq("user_id", targetUserId)

      if (removeError) {
        console.error("Database remove error:", removeError)
        return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
      }

      // Update circle member count
      await supabase.rpc('decrement_circle_member_count', { circle_id: circleId })

      return NextResponse.json({
        success: true,
        message: "Member removed successfully"
      })
    }
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
