import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "Loop ID is required" }, { status: 400 })
    }

    // 1. Fetch target loop details
    const { data: loop, error } = await supabase
      .from("loops")
      .select(`
        id,
        content_title,
        content,
        created_at,
        parent_loop_id,
        author_id,
        post_type,
        profiles (
          id,
          username,
          display_name,
          avatar_url, video_avatar_url,
          is_verified
        ),
        loop_stats (
          likes_count,
          comments_count,
          branches_count
        )
      `)
      .eq("id", id)
      .single()

    if (error || !loop) {
      return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    }

    // Find the true root loop if this is a branch
    let rootId = loop.id
    let currParentId = loop.parent_loop_id
    let maxHop = 5

    while (currParentId && maxHop > 0) {
      const { data: pLoop } = await supabase
        .from("loops")
        .select("id, parent_loop_id")
        .eq("id", currParentId)
        .single()
      if (pLoop) {
        rootId = pLoop.id
        currParentId = pLoop.parent_loop_id
      } else {
        break
      }
      maxHop--
    }

    // Fetch all loops that belong to this tree family (where parent_loop_id is rootId or any branch)
    const { data: allFamily } = await supabase
      .from("loops")
      .select(`
        id,
        content_title,
        content,
        created_at,
        parent_loop_id,
        author_id,
        post_type,
        profiles (
          id,
          username,
          display_name,
          avatar_url, video_avatar_url,
          is_verified
        ),
        loop_stats (
          likes_count,
          comments_count,
          branches_count
        )
      `)

    const familyList = allFamily || [loop]

    // Recursive helper to build tree nodes
    const buildTreeNode = (nodeId: string, depth = 0): any => {
      const target = familyList.find((item: any) => item.id === nodeId)
      if (!target) return null

      const directChildren = familyList.filter((item: any) => item.parent_loop_id === nodeId)

      const profileObj = Array.isArray(target.profiles) ? target.profiles[0] : target.profiles
      const statsObj = Array.isArray(target.loop_stats) ? target.loop_stats[0] : target.loop_stats

      return {
        id: target.id,
        title: target.content_title || target.content?.slice(0, 40) || "Untitled Loop",
        content: target.content || "",
        createdAt: target.created_at,
        parentLoopId: target.parent_loop_id,
        depth,
        author: {
          id: profileObj?.id || target.author_id,
          username: profileObj?.username || "creator",
          displayName: profileObj?.display_name || "Creator",
          avatar: profileObj?.avatar_url,
          verified: Boolean(profileObj?.is_verified),
        },
        stats: {
          likes: Number(statsObj?.likes_count || 0),
          branches: Number(statsObj?.branches_count || directChildren.length),
        },
        children: directChildren.map((child: any) => buildTreeNode(child.id, depth + 1)).filter(Boolean),
      }
    }

    const tree = buildTreeNode(rootId)

    const rootProf = Array.isArray(loop.profiles) ? loop.profiles[0] : loop.profiles

    return NextResponse.json({
      tree: tree || {
        id: loop.id,
        title: loop.content_title || "Root Loop",
        content: loop.content,
        createdAt: loop.created_at,
        depth: 0,
        author: {
          id: rootProf?.id || loop.author_id,
          username: rootProf?.username || "creator",
          displayName: rootProf?.display_name || "Creator",
          avatar: rootProf?.avatar_url,
        },
        stats: { likes: 0, branches: 0 },
        children: [],
      },
    })
  } catch (err: any) {
    console.error("Error fetching loop chain tree:", err)
    return NextResponse.json({ error: "Failed to fetch loop chain" }, { status: 500 })
  }
}
