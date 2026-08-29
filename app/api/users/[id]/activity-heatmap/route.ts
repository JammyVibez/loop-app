import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: userId } = await params
    const supabase = createServerClient()

    // Get all posts from the last year
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { data: loops, error } = await supabase
      .from("loops")
      .select("created_at")
      .eq("author_id", userId)
      .gte("created_at", oneYearAgo.toISOString())
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Heatmap query error:", error)
    }

    // Also count trees if the table exists
    let trees: Array<{ created_at: string }> = []
    try {
      const { data } = await supabase
        .from("reels")
        .select("created_at")
        .eq("author_id", userId)
        .gte("created_at", oneYearAgo.toISOString())
        .order("created_at", { ascending: true })
      trees = data || []
    } catch {
      // reels table might not exist
    }

    // Build heatmap data
    const heatmap: Record<string, number> = {}
    const allPosts = [...(loops || []), ...trees]

    for (const post of allPosts) {
      if (!post.created_at) continue
      const date = new Date(post.created_at).toISOString().split("T")[0]
      heatmap[date] = (heatmap[date] || 0) + 1
    }

    // Calculate stats
    const totalPosts = allPosts.length
    const activeDays = Object.keys(heatmap).length
    const maxPosts = Math.max(...Object.values(heatmap), 0)

    // Calculate streak
    let currentStreak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      if (heatmap[dateStr]) {
        currentStreak++
      } else {
        break
      }
    }

    // Best streak
    let bestStreak = 0
    let tempStreak = 0
    const sortedDates = Object.keys(heatmap).sort()
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1
      } else {
        const prev = new Date(sortedDates[i - 1])
        const curr = new Date(sortedDates[i])
        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays === 1) {
          tempStreak++
        } else {
          bestStreak = Math.max(bestStreak, tempStreak)
          tempStreak = 1
        }
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak)

    return NextResponse.json({
      success: true,
      data: {
        heatmap,
        totalPosts,
        activeDays,
        maxPosts,
        currentStreak,
        bestStreak,
      },
    })
  } catch (error: any) {
    console.error("Heatmap error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
