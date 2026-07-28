import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
  if (!token) return null
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser(token)
  return user || null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const messageId = request.nextUrl.searchParams.get("message_id")
    if (!messageId) return NextResponse.json({ error: "message_id required" }, { status: 400 })

    const supabase = createServerClient()

    // Prefer dedicated table; fall back to reactions JSON on message
    const { data: rows, error } = await supabase
      .from("message_reactions")
      .select("emoji, user_id, created_at")
      .eq("message_id", messageId)

    if (!error) {
      const grouped: Record<string, { emoji: string; count: number; users: string[]; reacted: boolean }> = {}
      for (const row of rows || []) {
        if (!grouped[row.emoji]) grouped[row.emoji] = { emoji: row.emoji, count: 0, users: [], reacted: false }
        grouped[row.emoji].count += 1
        grouped[row.emoji].users.push(row.user_id)
        if (row.user_id === user.id) grouped[row.emoji].reacted = true
      }
      return NextResponse.json({ success: true, reactions: Object.values(grouped) })
    }

    const { data: message } = await supabase.from("messages").select("reactions").eq("id", messageId).maybeSingle()
    const raw = Array.isArray(message?.reactions) ? message.reactions : []
    return NextResponse.json({ success: true, reactions: raw })
  } catch (error) {
    console.error("Message reactions GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const messageId = body.message_id as string
    const emoji = String(body.emoji || "").slice(0, 8)
    const action = body.action === "remove" ? "remove" : "add"

    if (!messageId || !emoji) {
      return NextResponse.json({ error: "Message ID and emoji are required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: message } = await supabase
      .from("messages")
      .select("id, conversation_id, reactions")
      .eq("id", messageId)
      .maybeSingle()

    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    // Try dedicated table first
    if (action === "add") {
      const { error } = await supabase.from("message_reactions").upsert(
        {
          message_id: messageId,
          user_id: user.id,
          emoji,
          created_at: new Date().toISOString(),
        },
        { onConflict: "message_id,user_id,emoji" },
      )

      if (error) {
        // JSONB fallback on messages.reactions
        const current = Array.isArray(message.reactions) ? [...message.reactions] : []
        const idx = current.findIndex((r: any) => r.emoji === emoji)
        if (idx >= 0) {
          const users = new Set<string>(current[idx].users || [])
          users.add(user.id)
          current[idx] = { emoji, count: users.size, users: Array.from(users) }
        } else {
          current.push({ emoji, count: 1, users: [user.id] })
        }
        await supabase.from("messages").update({ reactions: current }).eq("id", messageId)
      }
    } else {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)

      if (error) {
        const current = Array.isArray(message.reactions) ? [...message.reactions] : []
        const next = current
          .map((r: any) => {
            if (r.emoji !== emoji) return r
            const users = (r.users || []).filter((id: string) => id !== user.id)
            return users.length ? { emoji, count: users.length, users } : null
          })
          .filter(Boolean)
        await supabase.from("messages").update({ reactions: next }).eq("id", messageId)
      }
    }

    try {
      await supabase.channel(`conversation:${message.conversation_id}`).send({
        type: "broadcast",
        event: "reaction",
        payload: { message_id: messageId, emoji, action, user_id: user.id },
      })
    } catch {
      /* ignore */
    }

    return NextResponse.json({ success: true, message: action === "add" ? "Reaction added" : "Reaction removed" })
  } catch (error) {
    console.error("Message reaction error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
