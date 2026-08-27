import { type NextRequest, NextResponse } from "next/server"
import { withAdminParams } from "@/lib/api-handler"


// Get circle events (admin view)
export const GET = withAdminParams(async (request, { params, supabase }) => {
  const { circleId } = await params

  const { searchParams } = new URL(request.url)
  const limit = Number.parseInt(searchParams.get("limit") || "50")
  const offset = Number.parseInt(searchParams.get("offset") || "0")
  const status = searchParams.get("status") // upcoming, past, ongoing
  const type = searchParams.get("type") // discussion, voice_chat, screen_share, game
  const search = searchParams.get("search")

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
    .from("circle_events")
    .select(`
      *,
      organizer:profiles!organizer_id(id, username, display_name, avatar_url, is_verified, is_premium)
    `)
    .eq("circle_id", circleId)
    .order("starts_at", { ascending: true })
    .range(offset, offset + limit - 1)

  // Filter by status
  const now = new Date().toISOString()
  if (status === "upcoming") {
    query = query.gte("starts_at", now)
  } else if (status === "past") {
    query = query.lt("ends_at", now)
  } else if (status === "ongoing") {
    query = query.lte("starts_at", now).gte("ends_at", now)
  }

  if (type) {
    query = query.eq("event_type", type)
  }

  if (search) {
    query = query.ilike("title", `%${search}%`)
  }

  const { data: events, error } = await query

  if (error) {
    console.error("Database error:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    events: events || [],
    hasMore: events?.length === limit,
  })
})

// Delete an event (admin override)
export const DELETE = withAdminParams(async (request, { params, supabase }) => {
  const { circleId } = await params

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("eventId")

  if (!eventId) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
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

  // Check if event exists
  const { data: event } = await supabase
    .from("circle_events")
    .select("id")
    .eq("id", eventId)
    .eq("circle_id", circleId)
    .single()

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  // Delete event
  const { error: deleteError } = await supabase
    .from("circle_events")
    .delete()
    .eq("id", eventId)

  if (deleteError) {
    console.error("Database delete error:", deleteError)
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: "Event deleted successfully"
  })
})
