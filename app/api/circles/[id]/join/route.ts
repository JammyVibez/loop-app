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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Check if circle exists
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("id, name, is_private")
      .eq("id", circleId)
      .single()

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("circle_members")
      .select("id, status")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .single()

    if (existingMember) {
      if (existingMember.status === "active") {
        return NextResponse.json({ error: "Already a member" }, { status: 400 })
      } else if (existingMember.status === "pending") {
        return NextResponse.json({ error: "Join request already pending" }, { status: 400 })
      }
    }

    // For private circles, create a pending request
    const status = circle.is_private ? "pending" : "active"

    // Add user to circle
    const { error: insertError } = await supabase.from("circle_members").insert({
      circle_id: circleId,
      user_id: user.id,
      role: "member",
      status,
      joined_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to join circle" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: circle.is_private ? "Join request sent to moderators" : "Successfully joined circle",
      status,
    })
  } catch (error) {
    console.error("Error joining circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    // Remove user from circle
    const { error: deleteError } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", circleId)
      .eq("user_id", user.id)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to leave circle" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Successfully left circle",
    })
  } catch (error) {
    console.error("Error leaving circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
