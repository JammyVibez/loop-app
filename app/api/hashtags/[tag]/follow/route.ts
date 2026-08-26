import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

async function getUser(token: string | null) {
  if (!token) return null
  const user = await getUserFromRequest(request);
  return user || null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tag: string }> },
) {
  try {
    const user = await getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tag: raw } = await params
    const tag = String(raw || "")
      .replace(/^#/, "")
      .toLowerCase()
      .trim()
    if (!tag) return NextResponse.json({ error: "Tag required" }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const action = body.action === "unfollow" ? "unfollow" : "follow"

    if (action === "unfollow") {
      const { error } = await supabase
        .from("hashtag_follows")
        .delete()
        .eq("user_id", user.id)
        .eq("hashtag_tag", tag)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, is_following: false })
    }

    const { error } = await supabase.from("hashtag_follows").upsert(
      {
        user_id: user.id,
        hashtag_tag: tag,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,hashtag_tag", ignoreDuplicates: true },
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, is_following: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
