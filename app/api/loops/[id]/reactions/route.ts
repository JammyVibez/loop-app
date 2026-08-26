import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

const ALLOWED = new Set(["🔥", "❤️", "🚀", "💡", "👏", "💯"])


export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: loopId } = await params
    const user = await getUserFromRequest(request)
    const supabase = createServerClient()

    const { data: rows, error } = await supabase.from("loop_reactions").select("emoji, user_id").eq("loop_id", loopId)

    if (error) {
      // Table may not exist yet — fail soft
      if (/does not exist|relation/i.test(error.message || "")) {
        return NextResponse.json({ success: true, reactions: {}, my_reaction: null })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const reactions: Record<string, number> = {}
    let my_reaction: string | null = null
    for (const row of rows || []) {
      const emoji = String(row.emoji || "")
      if (!emoji) continue
      reactions[emoji] = (reactions[emoji] || 0) + 1
      if (user && row.user_id === user.id) my_reaction = emoji
    }

    return NextResponse.json({ success: true, reactions, my_reaction })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: loopId } = await params
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const emoji = typeof body.emoji === "string" ? body.emoji.trim() : ""
    if (!ALLOWED.has(emoji)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: existing } = await supabase
      .from("loop_reactions")
      .select("id, emoji")
      .eq("loop_id", loopId)
      .eq("user_id", user.id)
      .maybeSingle()

    let my_reaction: string | null = emoji

    if (existing && existing.emoji === emoji) {
      // Toggle off
      await supabase.from("loop_reactions").delete().eq("id", existing.id)
      my_reaction = null
    } else if (existing) {
      await supabase.from("loop_reactions").update({ emoji }).eq("id", existing.id)
    } else {
      const { error: insertError } = await supabase.from("loop_reactions").insert({
        loop_id: loopId,
        user_id: user.id,
        emoji,
      })
      if (insertError) {
        if (/does not exist|relation/i.test(insertError.message || "")) {
          return NextResponse.json(
            { error: "Reactions table missing — run scripts/loop-reactions.sql" },
            { status: 503 },
          )
        }
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    const { data: rows } = await supabase.from("loop_reactions").select("emoji").eq("loop_id", loopId)
    const reactions: Record<string, number> = {}
    for (const row of rows || []) {
      const e = String(row.emoji || "")
      if (!e) continue
      reactions[e] = (reactions[e] || 0) + 1
    }

    return NextResponse.json({ success: true, reactions, my_reaction })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 })
  }
}
