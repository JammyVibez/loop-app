import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: loopId } = await params
    const supabase = createServerClient()

    // Fetch the loop to verify ownership
    const { data: loop, error: loopErr } = await supabase
      .from("loops")
      .select("author_id, comments_disabled")
      .eq("id", loopId)
      .single()

    if (loopErr || !loop) {
      return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    }

    if (loop.author_id !== user.id) {
      return NextResponse.json({ error: "Only the author can toggle comments" }, { status: 403 })
    }

    const newDisabled = !loop.comments_disabled

    const { error: updateErr } = await supabase
      .from("loops")
      .update({ comments_disabled: newDisabled } as any)
      .eq("id", loopId)

    if (updateErr) {
      // Column might not exist yet — return a clear error instead of crashing
      if (updateErr.message?.includes("column") || updateErr.code === "42703") {
        return NextResponse.json({
          error: "Comments lock feature needs a database column. Run: ALTER TABLE loops ADD COLUMN IF NOT EXISTS comments_disabled BOOLEAN DEFAULT FALSE;",
        }, { status: 501 })
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      comments_disabled: newDisabled,
      message: newDisabled ? "Comments locked" : "Comments unlocked",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
