import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: streamId } = await params
    const supabase = createServerClient()

    const { data: messages, error } = await supabase
      .from("stream_chat")
      .select(`
        id,
        user_id,
        message,
        message_type,
        gift_amount,
        created_at,
        user:profiles!user_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        )
      `)
      .eq("stream_id", streamId)
      .order("created_at", { ascending: true })
      .limit(100)

    if (error) {
      console.warn("Fetch stream_chat error:", error.message)
      return NextResponse.json({ success: true, messages: [] })
    }

    const formattedMessages = (messages || []).map((msg: any) => {
      // gift_data is a JSONB column; older rows may have stored a plain
      // amount number — normalize both shapes so tips always render.
      let tipAmount = 0
      const giftData = msg.gift_data
      if (typeof giftData === "number") tipAmount = giftData
      else if (giftData && typeof giftData === "object") tipAmount = Number(giftData.amount || giftData.value || 0) || 0
      else if (msg.gift_amount) tipAmount = Number(msg.gift_amount) || 0

      return {
        id: msg.id,
        user_id: msg.user_id,
        username: msg.user?.username || "user",
        display_name: msg.user?.display_name || msg.user?.username || "Viewer",
        avatar_url: msg.user?.avatar_url,
        message: msg.message,
        is_verified: Boolean(msg.user?.is_verified),
        is_premium: Boolean(msg.user?.is_premium),
        is_tip: msg.message_type === "gift" || tipAmount > 0,
        tip_amount: tipAmount,
        timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
    })

    return NextResponse.json({ success: true, messages: formattedMessages })
  } catch (error: any) {
    console.error("Get stream chat error:", error)
    return NextResponse.json({ error: "Failed to fetch stream chat" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: streamId } = await params
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const body = await request.json()
    const { message, is_tip, tip_amount } = body

    if (!message && !is_tip) {
      return NextResponse.json({ error: "Message content or tip is required" }, { status: 400 })
    }

    const messageType = is_tip ? "gift" : "text"
    const giftAmount = is_tip ? (tip_amount || 0) : 0

    const { data: inserted, error: insertErr } = await supabase
      .from("stream_chat")
      .insert({
        stream_id: streamId,
        user_id: user.id,
        message: message || `Sent ${giftAmount} Loop Coins! 🎁`,
        message_type: messageType,
        // stream_chat stores gift details in the JSONB `gift_data` column.
        gift_data: giftAmount > 0 ? { amount: giftAmount } : null,
      })
      .select(`
        id,
        user_id,
        message,
        message_type,
        gift_amount,
        created_at,
        user:profiles!user_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        )
      `)
      .single()

    if (insertErr) {
      console.warn("Insert stream_chat error:", insertErr.message)
    }

    const userProfile: any = Array.isArray(inserted?.user) ? inserted.user[0] : inserted?.user

    const savedMsg = {
      id: inserted?.id || `chat-${Date.now()}`,
      user_id: user.id,
      username: userProfile?.username || user.user_metadata?.username || "user",
      display_name: userProfile?.display_name || user.user_metadata?.display_name || "Viewer",
      avatar_url: userProfile?.avatar_url || user.user_metadata?.avatar_url,
      message: message || `Sent ${giftAmount} Loop Coins! 🎁`,
      is_verified: Boolean(userProfile?.is_verified),
      is_premium: Boolean(userProfile?.is_premium),
      is_tip: Boolean(is_tip),
      tip_amount: giftAmount,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    return NextResponse.json({ success: true, message: savedMsg })
  } catch (error: any) {
    console.error("Post stream chat error:", error)
    return NextResponse.json({ error: "Failed to post stream chat" }, { status: 500 })
  }
}
