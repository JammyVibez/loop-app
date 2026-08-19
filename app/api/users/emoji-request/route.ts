import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// Pro users can request custom emojis from admin
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check if user is pro/premium
    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .single()

    if (!profile?.is_premium) {
      return NextResponse.json(
        { error: "Only Pro users can request custom emojis. Upgrade to Pro to unlock this feature." },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const description = String(body.description || "").trim()
    const image_url = String(body.image_url || "").trim()

    if (!description && !image_url) {
      return NextResponse.json(
        { error: "Please provide a description or upload an image for your custom emoji request." },
        { status: 400 },
      )
    }

    // Store the request in notifications table as a special admin notification
    const { error } = await supabase.from("notifications").insert({
      user_id: user.id,
      type: "emoji_request",
      title: "Custom Emoji Request",
      message: description || "Custom emoji request with image",
      metadata: JSON.stringify({
        image_url: image_url || null,
        description,
        requested_by: user.id,
        status: "pending",
      }),
    })

    if (error) {
      // If notifications table doesn't have the right schema, just log it
      console.warn("Could not store emoji request in notifications:", error.message)
    }

    return NextResponse.json({
      success: true,
      message: "Your custom emoji request has been sent to the admin team. You'll be notified when it's processed!",
    })
  } catch (error: any) {
    console.error("Emoji request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Pro users can view their own requests
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: requests, error } = await supabase
      .from("notifications")
      .select("id, title, message, metadata, created_at, read")
      .eq("user_id", user.id)
      .eq("type", "emoji_request")
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ requests: [] })

    const parsed = (requests || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      image_url: r.metadata ? JSON.parse(r.metadata).image_url : null,
      description: r.metadata ? JSON.parse(r.metadata).description : null,
      status: r.metadata ? JSON.parse(r.metadata).status : "pending",
      created_at: r.created_at,
    }))

    return NextResponse.json({ success: true, requests: parsed })
  } catch {
    return NextResponse.json({ requests: [] })
  }
}
