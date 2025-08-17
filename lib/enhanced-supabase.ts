import { createClient } from '@supabase/supabase-js'
import { EnhancedDatabase } from './enhanced-database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Enhanced Supabase client with full type safety
export const enhancedSupabase = createClient<EnhancedDatabase>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-application-name': 'loop-social-platform',
      },
    },
  }
)

// Utility functions for common database operations
export class EnhancedDatabaseService {
  private client = enhancedSupabase

  // User and Profile Operations
  async getUserProfile(userId: string) {
    const { data, error } = await this.client
      .from('profiles')
      .select(`
        *,
        user_achievements (
          id,
          achievement_id,
          unlocked_at,
          achievements (
            name,
            description,
            icon_url,
            category,
            rarity
          )
        ),
        user_rooms (
          id,
          name,
          room_type,
          is_public,
          visit_count
        )
      `)
      .eq('id', userId)
      .single()

    return { data, error }
  }

  async updateUserXP(userId: string, xpAmount: number, action: string, metadata?: any) {
    // Start a transaction
    const { data: currentProfile, error: profileError } = await this.client
      .from('profiles')
      .select('xp_points, level')
      .eq('id', userId)
      .single()

    if (profileError) return { error: profileError }

    const newXP = currentProfile.xp_points + xpAmount

    // Update profile XP (trigger will handle level calculation)
    const { error: updateError } = await this.client
      .from('profiles')
      .update({ xp_points: newXP })
      .eq('id', userId)

    if (updateError) return { error: updateError }

    // Log XP transaction
    const { error: logError } = await this.client
      .from('xp_transactions')
      .insert({
        user_id: userId,
        action,
        xp_amount: xpAmount,
        metadata: metadata || {}
      })

    return { error: logError }
  }

  async checkAndUnlockAchievements(userId: string) {
    // Get user's current stats
    const { data: userStats } = await this.client
      .rpc('get_user_stats', { user_id: userId })

    if (!userStats) return

    // Get all achievements user hasn't unlocked yet
    const { data: availableAchievements } = await this.client
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .not('id', 'in', `(
        SELECT achievement_id FROM user_achievements 
        WHERE user_id = '${userId}' AND unlocked_at IS NOT NULL
      )`)

    if (!availableAchievements) return

    // Check each achievement's requirements
    for (const achievement of availableAchievements) {
      const requirements = achievement.requirements as any
      let shouldUnlock = true

      // Check each requirement
      for (const [key, value] of Object.entries(requirements)) {
        if (userStats[key] < value) {
          shouldUnlock = false
          break
        }
      }

      if (shouldUnlock) {
        // Unlock achievement
        await this.client
          .from('user_achievements')
          .upsert({
            user_id: userId,
            achievement_id: achievement.id,
            unlocked_at: new Date().toISOString(),
            progress: requirements
          })

        // Award XP
        if (achievement.xp_reward > 0) {
          await this.updateUserXP(userId, achievement.xp_reward, 'achievement_unlock', {
            achievement_id: achievement.id,
            achievement_name: achievement.name
          })
        }

        // Send notification
        await this.client
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'achievement',
            title: 'Achievement Unlocked!',
            message: `You've unlocked the "${achievement.name}" achievement!`,
            data: {
              achievement_id: achievement.id,
              achievement_name: achievement.name,
              xp_reward: achievement.xp_reward
            }
          })
      }
    }
  }

  // Search Operations
  async performSearch(query: string, filters: any = {}, userId?: string) {
    const startTime = Date.now()
    
    // Build search query based on filters
    let searchQuery = this.client
      .from('loops')
      .select(`
        id,
        content_text,
        content_media_url,
        content_type,
        category,
        sentiment,
        trending_score,
        engagement_score,
        created_at,
        profiles!loops_author_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        ),
        loop_stats (
          likes_count,
          comments_count,
          branches_count,
          shares_count,
          views_count
        )
      `)

    // Apply text search
    if (query) {
      searchQuery = searchQuery.textSearch('content_text', query)
    }

    // Apply filters
    if (filters.category) {
      searchQuery = searchQuery.eq('category', filters.category)
    }
    if (filters.sentiment) {
      searchQuery = searchQuery.eq('sentiment', filters.sentiment)
    }
    if (filters.timeframe && filters.timeframe !== 'all') {
      const timeMap = {
        '1h': 1,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30
      }
      const hoursAgo = timeMap[filters.timeframe as keyof typeof timeMap]
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
      searchQuery = searchQuery.gte('created_at', cutoffTime)
    }

    // Apply sorting
    const sortMap = {
      'recent': 'created_at.desc',
      'popular': 'engagement_score.desc',
      'trending': 'trending_score.desc',
      'relevance': 'trending_score.desc' // Default fallback
    }
    const sortBy = sortMap[filters.sort as keyof typeof sortMap] || 'trending_score.desc'
    searchQuery = searchQuery.order(sortBy.split('.')[0], { 
      ascending: sortBy.includes('asc') 
    })

    // Execute search
    const { data: loops, error } = await searchQuery
      .limit(filters.limit || 20)
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20) - 1)

    const searchTime = Date.now() - startTime

    // Log search analytics
    if (userId) {
      await this.client
        .from('search_analytics')
        .insert({
          user_id: userId,
          query,
          filters,
          results_count: loops?.length || 0,
          search_duration_ms: searchTime
        })
    }

    return {
      data: loops,
      error,
      search_time_ms: searchTime,
      total_results: loops?.length || 0
    }
  }

  // Gift Operations
  async sendGift(senderId: string, recipientId: string, giftItemId: string, options: any = {}) {
    // Get gift item details
    const { data: giftItem, error: giftError } = await this.client
      .from('gift_items')
      .select('*')
      .eq('id', giftItemId)
      .single()

    if (giftError || !giftItem) {
      return { error: giftError || new Error('Gift item not found') }
    }

    // Calculate total cost (including gift multiplier)
    const totalCost = Math.floor(giftItem.price_coins * giftItem.gift_multiplier)

    // Check sender's balance
    const { data: senderProfile, error: balanceError } = await this.client
      .from('profiles')
      .select('loop_coins')
      .eq('id', senderId)
      .single()

    if (balanceError || !senderProfile) {
      return { error: balanceError || new Error('Sender not found') }
    }

    if (senderProfile.loop_coins < totalCost) {
      return { error: new Error('Insufficient coins') }
    }

    // Create gift transaction
    const { data: transaction, error: transactionError } = await this.client
      .from('gift_transactions')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        gift_item_id: giftItemId,
        message: options.message,
        is_anonymous: options.is_anonymous || false,
        payment_method: 'coins',
        amount_paid: totalCost,
        status: 'sent',
        gift_wrapping: options.gift_wrapping,
        delivery_config: options.delivery_config,
        metadata: options.metadata || {}
      })
      .select()
      .single()

    if (transactionError) {
      return { error: transactionError }
    }

    // Deduct coins from sender
    const { error: deductError } = await this.client
      .from('profiles')
      .update({ 
        loop_coins: senderProfile.loop_coins - totalCost 
      })
      .eq('id', senderId)

    if (deductError) {
      return { error: deductError }
    }

    // Add item to recipient's inventory (if applicable)
    if (giftItem.category === 'themes' || giftItem.category === 'effects') {
      await this.client
        .from('user_inventory')
        .upsert({
          user_id: recipientId,
          item_id: giftItemId,
          is_active: false
        })
    }

    // Send notification to recipient
    await this.client
      .from('notifications')
      .insert({
        user_id: recipientId,
        type: 'gift',
        title: 'You received a gift!',
        message: `${options.is_anonymous ? 'Someone' : 'A friend'} sent you ${giftItem.name}`,
        data: {
          gift_transaction_id: transaction.id,
          gift_item_name: giftItem.name,
          sender_id: options.is_anonymous ? null : senderId
        }
      })

    // Award XP to sender
    await this.updateUserXP(senderId, 20, 'send_gift', {
      gift_item_id: giftItemId,
      recipient_id: recipientId,
      amount: totalCost
    })

    return { data: transaction, error: null }
  }

  // Room Operations
  async createUserRoom(userId: string, roomData: any) {
    const { data, error } = await this.client
      .from('user_rooms')
      .insert({
        user_id: userId,
        name: roomData.name,
        description: roomData.description,
        room_type: roomData.room_type || 'personal',
        layout_data: roomData.layout_data,
        theme_id: roomData.theme_id,
        is_public: roomData.is_public || false
      })
      .select()
      .single()

    if (!error) {
      // Award XP for room creation
      await this.updateUserXP(userId, 150, 'create_room', {
        room_id: data.id,
        room_type: roomData.room_type
      })
    }

    return { data, error }
  }

  async visitRoom(roomId: string, visitorId: string, visitDuration?: number) {
    // Record visit
    const { error: visitError } = await this.client
      .from('room_visits')
      .insert({
        room_id: roomId,
        visitor_id: visitorId,
        visit_duration: visitDuration,
        interactions: []
      })

    if (visitError) return { error: visitError }

    // Increment visit count
    const { error: countError } = await this.client
      .rpc('increment_room_visits', { room_id: roomId })

    // Award XP to visitor
    await this.updateUserXP(visitorId, 5, 'visit_room', {
      room_id: roomId
    })

    return { error: countError }
  }

  // Daily Challenges
  async generateDailyChallenges(userId: string) {
    const today = new Date().toISOString().split('T')[0]
    
    // Check if user already has challenges for today
    const { data: existing } = await this.client
      .from('daily_challenges')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', today)

    if (existing && existing.length > 0) {
      return { data: existing, error: null }
    }

    // Generate new challenges
    const challenges = [
      {
        user_id: userId,
        challenge_type: 'create_loops',
        target_value: 3,
        xp_reward: 50,
        coin_reward: 25,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: userId,
        challenge_type: 'like_loops',
        target_value: 10,
        xp_reward: 30,
        coin_reward: 15,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: userId,
        challenge_type: 'visit_profiles',
        target_value: 5,
        xp_reward: 25,
        coin_reward: 10,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    ]

    const { data, error } = await this.client
      .from('daily_challenges')
      .insert(challenges)
      .select()

    return { data, error }
  }

  async updateChallengeProgress(userId: string, challengeType: string, increment: number = 1) {
    const today = new Date().toISOString().split('T')[0]

    const { data: challenge, error: fetchError } = await this.client
      .from('daily_challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('challenge_type', challengeType)
      .gte('created_at', today)
      .eq('is_completed', false)
      .single()

    if (fetchError || !challenge) return

    const newProgress = challenge.current_progress + increment
    const isCompleted = newProgress >= challenge.target_value

    const { error: updateError } = await this.client
      .from('daily_challenges')
      .update({
        current_progress: newProgress,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq('id', challenge.id)

    if (!updateError && isCompleted) {
      // Award rewards
      await this.updateUserXP(userId, challenge.xp_reward, 'complete_daily_challenge', {
        challenge_type: challengeType,
        challenge_id: challenge.id
      })

      await this.client
        .from('profiles')
        .update({
          loop_coins: this.client.raw(`loop_coins + ${challenge.coin_reward}`)
        })
        .eq('id', userId)

      // Send notification
      await this.client
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'system',
          title: 'Challenge Complete!',
          message: `You've completed the ${challengeType.replace('_', ' ')} challenge!`,
          data: {
            challenge_id: challenge.id,
            xp_reward: challenge.xp_reward,
            coin_reward: challenge.coin_reward
          }
        })
    }
  }
}

// Export singleton instance
export const enhancedDb = new EnhancedDatabaseService()

// Export individual functions for convenience
export const {
  getUserProfile,
  updateUserXP,
  checkAndUnlockAchievements,
  performSearch,
  sendGift,
  createUserRoom,
  visitRoom,
  generateDailyChallenges,
  updateChallengeProgress
} = enhancedDb
