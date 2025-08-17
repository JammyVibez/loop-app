
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration')
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || user.id

    const supabase = createServerClient()

    // Get user achievements with achievement details
    const { data: userAchievements, error: achievementsError } = await supabase
      .from("user_achievements")
      .select(`
        id,
        earned_at,
        achievement:achievements(
          id,
          name,
          description,
          category,
          level,
          xp_reward,
          coins_reward,
          icon
        )
      `)
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })

    if (achievementsError) {
      console.error('Error fetching achievements:', achievementsError)
      return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 })
    }

    // Get user stats
    const { data: userStats, error: statsError } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (statsError && statsError.code !== 'PGRST116') {
      console.error('Error fetching user stats:', statsError)
    }

    // Get achievement progress (total achievements by category and level)
    const { data: allAchievements, error: allAchievementsError } = await supabase
      .from("achievements")
      .select("id, category, level")
      .eq("is_active", true)

    if (allAchievementsError) {
      console.error('Error fetching all achievements:', allAchievementsError)
    }

    // Calculate achievement statistics
    const earnedAchievementIds = userAchievements?.map(ua => ua.achievement.id) || []
    const achievementStats = {
      total_earned: userAchievements?.length || 0,
      total_available: allAchievements?.length || 0,
      by_category: {},
      by_level: {}
    }

    // Group achievements by category and level
    if (allAchievements) {
      const categories = ['social', 'content', 'engagement', 'special', 'milestone']
      const levels = ['bronze', 'silver', 'gold', 'platinum', 'diamond']

      categories.forEach(category => {
        const categoryAchievements = allAchievements.filter(a => a.category === category)
        const earnedInCategory = categoryAchievements.filter(a => earnedAchievementIds.includes(a.id))
        achievementStats.by_category[category] = {
          earned: earnedInCategory.length,
          total: categoryAchievements.length
        }
      })

      levels.forEach(level => {
        const levelAchievements = allAchievements.filter(a => a.level === level)
        const earnedInLevel = levelAchievements.filter(a => earnedAchievementIds.includes(a.id))
        achievementStats.by_level[level] = {
          earned: earnedInLevel.length,
          total: levelAchievements.length
        }
      })
    }

    return NextResponse.json({
      success: true,
      achievements: userAchievements || [],
      stats: userStats || {
        loops_created: 0,
        total_likes_received: 0,
        total_comments_received: 0,
        followers_count: 0,
        following_count: 0,
        total_xp: 0,
        level: 1
      },
      achievement_stats: achievementStats
    })

  } catch (error: any) {
    console.error("Error fetching user achievements:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
