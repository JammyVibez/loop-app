import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const supabase = createServerClient()

    const { data: messages, error } = await supabase
      .from("event_messages")
      .select(
        `
        id, content, created_at, user_id,
        author:profiles!user_id(id, username, display_name, avatar_url)
      `,
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(200)

    if (error) {
      console.warn("Fetch event messages error:", error.message)
      return NextResponse.json({ success: true, messages: [] })
    }

    return NextResponse.json({ success: true, messages: messages || [] })
  } catch (error: any) {
    console.error("GET event messages error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Sign in to chat" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim().slice(0, 500)
    if (!content) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: message, error } = await supabase
      .from("event_messages")
      .insert({ event_id: eventId, user_id: user.id, content })
      .select(
        `
        id, content, created_at, user_id,
        author:profiles!user_id(id, username, display_name, avatar_url)
      `,
      )
      .single()

    if (error) {
      console.error("Insert event message error:", error)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    console.error("POST event message error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
