import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const getUser = getUserFromRequest

async function getMessageWithAccess(supabase: ReturnType<typeof createServerClient>, messageId: string, userId: string) {
  const { data: message } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, author_id, content, media_url, message_type, is_deleted, edited_at")
    .eq("id", messageId)
    .maybeSingle()
  if (!message) return { message: null, error: "Message not found", status: 404 }

  const { data: participant } = await supabase
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", message.conversation_id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle()
  if (!participant) return { message: null, error: "Forbidden", status: 403 }

  return { message, error: null, status: 200 }
}

/** Edit a message — only the author may edit; content-only edits keep media. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const { messageId } = await params
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim()
    if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 })

    const supabase = createServerClient()
    const { message, error, status } = await getMessageWithAccess(supabase, messageId, user.id)
    if (error || !message) return NextResponse.json({ error: error || "Message not found", status })

    const isAuthor = message.sender_id === user.id || message.author_id === user.id
    if (!isAuthor) return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 })

    const { data: updated, error: updateError } = await supabase
      .from("messages")
      .update({ content, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", messageId)
      .select("*")
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || "Failed to edit message" }, { status: 500 })
    }

    // Tell live peers about the edit so the thread updates without a reload.
    try {
      await supabase.channel(`conversation:${updated.conversation_id}`).send({
        type: "broadcast",
        event: "message_edited",
        payload: { id: updated.id, content: updated.content, edited_at: updated.edited_at },
      })
    } catch { /* intentionally silent */ }

    return NextResponse.json({ success: true, message: updated })
  } catch (err) {
    console.error("Message edit error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Delete (soft-delete) a message — the author, or anyone in the conversation when `for_everyone`. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const { messageId } = await params
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { message, error, status } = await getMessageWithAccess(supabase, messageId, user.id)
    if (error || !message) return NextResponse.json({ error: error || "Message not found", status })

    const isAuthor = message.sender_id === user.id || message.author_id === user.id
    if (!isAuthor) return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 })

    const { error: deleteError } = await supabase
      .from("messages")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        content: message.media_url ? "" : "This message was deleted",
        edited_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", messageId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message || "Failed to delete message" }, { status: 500 })
    }

    try {
      await supabase.channel(`conversation:${message.conversation_id}`).send({
        type: "broadcast",
        event: "message_deleted",
        payload: { id: messageId },
      })
    } catch { /* intentionally silent */ }

    return NextResponse.json({ success: true, message: "Message deleted" })
  } catch (err) {
    console.error("Message delete error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
