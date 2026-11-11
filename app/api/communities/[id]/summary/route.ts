import { type NextRequest, NextResponse } from "next/server"
import { communityClient } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

/**
 * Compact community payload for the feed share card.
 *
 * The full /api/communities/[id] bundle loads threads, spaces and projects,
 * which is far too much for a card that may appear in every feed row.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const viewer = await getUserFromRequest(request)
    const sb = communityClient()

    const { data: circle, error } = await sb
      .from("circles")
      .select(
        "id, name, handle, description, avatar_url, cover_url, banner_url, accent_color, category, is_private, created_at",
      )
      .eq("id", id)
      .maybeSingle()

    if (error || !circle) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 })
    }

    const { count: activeMembers } = await sb
      .from("circle_members")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", id)
      .eq("status", "active")

    let is_member = false
    let is_pending = false
    if (viewer) {
      const { data: membership } = await sb
        .from("circle_members")
        .select("status")
        .eq("circle_id", id)
        .eq("user_id", viewer.id)
        .maybeSingle()
      is_member = membership?.status === "active" || membership?.status === "approved"
      is_pending = membership?.status === "pending"
    }

    const isPrivate = Boolean(circle.is_private)
    const canSeeDetails = !isPrivate || is_member

    return NextResponse.json({
      community: {
        id: circle.id,
        name: circle.name,
        handle: circle.handle || null,
        description: canSeeDetails ? circle.description || null : null,
        avatar_url: circle.avatar_url || null,
        cover_url: circle.cover_url || circle.banner_url || null,
        accent_color: circle.accent_color || null,
        category: circle.category || null,
        is_private: isPrivate,
        created_at: circle.created_at || null,
      },
      member_count: canSeeDetails ? Number(activeMembers || 0) : null,
      is_member,
      is_pending,
    })
  } catch (err: any) {
    console.error("[communities/summary] GET error:", err)
    return NextResponse.json({ error: err?.message || "Failed to load community" }, { status: 500 })
  }
}
