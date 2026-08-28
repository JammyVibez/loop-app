import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = await params
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

    // Also count reels if the table exists
    let reels: Array<{ created_at: string }> = []
    try {
      const reelsResult = await supabase
        .from("reels")
        .select("created_at")
        .eq("author_id", userId)
        .gte("created_at", oneYearAgo.toISOString())
        .order("created_at", { ascending: true })
      reels = reelsResult.data || []
    } catch {
      // reels table may not exist
    }

    // Combine all activity
    const allActivity = [
      ...(loops || []).map((l) => l.created_at),
      ...reels.map((r) => r.created_at),
    ]

    // Build daily counts
    const dayCounts: Record<string, number> = {}
    for (const dateStr of allActivity) {
      const day = dateStr.split("T")[0]
      dayCounts[day] = (dayCounts[day] || 0) + 1
    }

    // Build the full 365-day grid
    const days: Array<{ date: string; count: number; level: number }> = []
    const now = new Date()

    for (let i = 364; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      const count = dayCounts[dateStr] || 0

      // Level: 0=none, 1=1-2, 2=3-5, 3=6-10, 4=11+
      let level = 0
      if (count >= 11) level = 4
      else if (count >= 6) level = 3
      else if (count >= 3) level = 2
      else if (count >= 1) level = 1

      days.push({ date: dateStr, count, level })
    }

    return NextResponse.json({ days })
  } catch (error) {
    console.error("Activity heatmap error:", error)
    return NextResponse.json({ days: [] })
  }
}
