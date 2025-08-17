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

// Get circle members (admin view)
export async function GET(request: NextRequest, { params }: { params: { circleId: string } }) {
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

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const role = searchParams.get("role")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const circleId = params.circleId

    // Check if circle exists
    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single()

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    let query = supabase
      .from("circle_members")
      .select(`
        *,
        user:profiles!inner(id, username, display_name, avatar_url, is_verified, is_premium, loop_coins, level, last_active)
      `)
      .eq("circle_id", circleId)
      .order("joined_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (role) {
      query = query.eq("role", role)
    }

    if (status) {
      query = query.eq("status", status)
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

// Update member role or status (admin override)
export async function PUT(request: NextRequest, { params }: { params: { circleId: string } }) {
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

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const circleId = params.circleId
    const { memberId, role, status, ban_reason, banned_until } = await request.json()

    // Check if circle exists
    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single()

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Check if member exists
    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("id", memberId)
      .eq("circle_id", circleId)
      .single()

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Update member
    const { data: updatedMember, error: updateError } = await supabase
      .from("circle_members")
      .update({
        role: role || undefined,
        status: status || undefined,
        ban_reason: ban_reason || undefined,
        banned_until: banned_until || undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", memberId)
      .select(`
        *,
        user:profiles!inner(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      member: updatedMember,
      message: "Member updated successfully"
    })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Remove member from circle (admin override)
export async function DELETE(request: NextRequest, { params }: { params: { circleId: string } }) {
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

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const circleId = params.circleId
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId")

    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 })
    }

    // Check if circle exists
    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single()

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Check if member exists
    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("id", memberId)
      .eq("circle_id", circleId)
      .single()

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Delete member
    const { error: deleteError } = await supabase
      .from("circle_members")
      .delete()
      .eq("id", memberId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Member removed successfully"
    })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
