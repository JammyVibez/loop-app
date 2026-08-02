export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface EnhancedDatabase {
  public: {
    Tables: {
      // Enhanced profiles table
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string
          email: string
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          loop_coins: number
          is_premium: boolean
          is_verified: boolean
          is_admin: boolean
          theme_data: Json | null
          xp_points: number
          level: number
          reputation_score: number
          skill_points: number
          current_streak: number
          longest_streak: number
          last_activity_date: string
          timezone: string
          language_preference: string
          accessibility_settings: Json
          privacy_settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name: string
          email: string
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          loop_coins?: number
          is_premium?: boolean
          is_verified?: boolean
          is_admin?: boolean
          theme_data?: Json | null
          xp_points?: number
          level?: number
          reputation_score?: number
          skill_points?: number
          current_streak?: number
          longest_streak?: number
          last_activity_date?: string
          timezone?: string
          language_preference?: string
          accessibility_settings?: Json
          privacy_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string
          email?: string
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          loop_coins?: number
          is_premium?: boolean
          is_verified?: boolean
          is_admin?: boolean
          theme_data?: Json | null
          xp_points?: number
          level?: number
          reputation_score?: number
          skill_points?: number
          current_streak?: number
          longest_streak?: number
          last_activity_date?: string
          timezone?: string
          language_preference?: string
          accessibility_settings?: Json
          privacy_settings?: Json
          created_at?: string
          updated_at?: string
        }
      }

      // Enhanced loops table
      loops: {
        Row: {
          id: string
          author_id: string
          parent_loop_id: string | null
          content_type: 'text' | 'image' | 'video' | 'audio' | 'file'
          content_text: string | null
          content_media_url: string | null
          content_metadata: Json | null
          visibility: 'public' | 'private' | 'circle'
          circle_id: string | null
          tree_depth: number
          hashtags: string[] | null
          content_vector: string | null
          category: string | null
          sentiment: string | null
          trending_score: number
          engagement_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          parent_loop_id?: string | null
          content_type: 'text' | 'image' | 'video' | 'audio' | 'file'
          content_text?: string | null
          content_media_url?: string | null
          content_metadata?: Json | null
          visibility?: 'public' | 'private' | 'circle'
          circle_id?: string | null
          tree_depth?: number
          hashtags?: string[] | null
          content_vector?: string | null
          category?: string | null
          sentiment?: string | null
          trending_score?: number
          engagement_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          parent_loop_id?: string | null
          content_type?: 'text' | 'image' | 'video' | 'audio' | 'file'
          content_text?: string | null
          content_media_url?: string | null
          content_metadata?: Json | null
          visibility?: 'public' | 'private' | 'circle'
          circle_id?: string | null
          tree_depth?: number
          hashtags?: string[] | null
          content_vector?: string | null
          category?: string | null
          sentiment?: string | null
          trending_score?: number
          engagement_score?: number
          created_at?: string
          updated_at?: string
        }
      }

      // XP transactions
      xp_transactions: {
        Row: {
          id: string
          user_id: string
          action: string
          xp_amount: number
          multipliers: Json
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          xp_amount: number
          multipliers?: Json
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          xp_amount?: number
          multipliers?: Json
          metadata?: Json
          created_at?: string
        }
      }

      // Achievement system
      achievements: {
        Row: {
          id: string
          name: string
          description: string | null
          icon_url: string | null
          category: string
          rarity: string
          xp_reward: number
          requirements: Json
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          icon_url?: string | null
          category: string
          rarity?: string
          xp_reward?: number
          requirements: Json
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          icon_url?: string | null
          category?: string
          rarity?: string
          xp_reward?: number
          requirements?: Json
          is_active?: boolean
          created_at?: string
        }
      }

      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          progress: Json
          unlocked_at: string | null
          is_displayed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_id: string
          progress?: Json
          unlocked_at?: string | null
          is_displayed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          achievement_id?: string
          progress?: Json
          unlocked_at?: string | null
          is_displayed?: boolean
          created_at?: string
        }
      }

      // Skill trees
      skill_trees: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          tree_data: Json
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          tree_data: Json
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          tree_data?: Json
          is_active?: boolean
          created_at?: string
        }
      }

      user_skills: {
        Row: {
          id: string
          user_id: string
          skill_tree_id: string
          unlocked_nodes: Json
          skill_points: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          skill_tree_id: string
          unlocked_nodes?: Json
          skill_points?: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          skill_tree_id?: string
          unlocked_nodes?: Json
          skill_points?: number
          updated_at?: string
        }
      }

      // Daily challenges
      daily_challenges: {
        Row: {
          id: string
          user_id: string
          challenge_type: string
          target_value: number
          current_progress: number
          is_completed: boolean
          xp_reward: number
          coin_reward: number
          expires_at: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          challenge_type: string
          target_value: number
          current_progress?: number
          is_completed?: boolean
          xp_reward: number
          coin_reward: number
          expires_at: string
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          challenge_type?: string
          target_value?: number
          current_progress?: number
          is_completed?: boolean
          xp_reward?: number
          coin_reward?: number
          expires_at?: string
          completed_at?: string | null
          created_at?: string
        }
      }

      // Leaderboards
      leaderboards: {
        Row: {
          id: string
          leaderboard_type: string
          user_id: string
          score: number
          rank: number
          previous_rank: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          leaderboard_type: string
          user_id: string
          score: number
          rank: number
          previous_rank?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          leaderboard_type?: string
          user_id?: string
          score?: number
          rank?: number
          previous_rank?: number | null
          updated_at?: string
        }
      }

      // User rooms
      user_rooms: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          room_type: string
          layout_data: Json
          theme_id: string | null
          is_public: boolean
          visit_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          room_type?: string
          layout_data: Json
          theme_id?: string | null
          is_public?: boolean
          visit_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          room_type?: string
          layout_data?: Json
          theme_id?: string | null
          is_public?: boolean
          visit_count?: number
          created_at?: string
          updated_at?: string
        }
      }

      // Room visits
      room_visits: {
        Row: {
          id: string
          room_id: string
          visitor_id: string
          visit_duration: number | null
          interactions: Json
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          visitor_id: string
          visit_duration?: number | null
          interactions?: Json
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          visitor_id?: string
          visit_duration?: number | null
          interactions?: Json
          created_at?: string
        }
      }

      // Room guestbook
      room_guestbook: {
        Row: {
          id: string
          room_id: string
          visitor_id: string
          message: string
          rating: number
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          visitor_id: string
          message: string
          rating: number
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          visitor_id?: string
          message?: string
          rating?: number
          is_public?: boolean
          created_at?: string
        }
      }

      // Room items
      room_items: {
        Row: {
          id: string
          room_id: string
          item_type: string
          item_data: Json
          position: Json
          rotation: Json
          scale: Json
          is_interactive: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          item_type: string
          item_data: Json
          position: Json
          rotation: Json
          scale: Json
          is_interactive?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          item_type?: string
          item_data?: Json
          position?: Json
          rotation?: Json
          scale?: Json
          is_interactive?: boolean
          created_at?: string
        }
      }

      // Theme categories
      theme_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          icon_url: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          icon_url?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          icon_url?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
      }

      // Enhanced themes
      themes: {
        Row: {
          id: string
          name: string
          description: string | null
          category_id: string | null
          preview_images: string[]
          preview_video_url: string | null
          theme_data: Json
          components: Json
          animations: Json
          effects_3d: Json
          price_coins: number
          price_usd: number
          rarity: string
          is_premium: boolean
          is_seasonal: boolean
          season_start: string | null
          season_end: string | null
          download_count: number
          rating_average: number
          rating_count: number
          tags: string[]
          creator_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category_id?: string | null
          preview_images?: string[]
          preview_video_url?: string | null
          theme_data: Json
          components: Json
          animations?: Json
          effects_3d?: Json
          price_coins?: number
          price_usd?: number
          rarity?: string
          is_premium?: boolean
          is_seasonal?: boolean
          season_start?: string | null
          season_end?: string | null
          download_count?: number
          rating_average?: number
          rating_count?: number
          tags?: string[]
          creator_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category_id?: string | null
          preview_images?: string[]
          preview_video_url?: string | null
          theme_data?: Json
          components?: Json
          animations?: Json
          effects_3d?: Json
          price_coins?: number
          price_usd?: number
          rarity?: string
          is_premium?: boolean
          is_seasonal?: boolean
          season_start?: string | null
          season_end?: string | null
          download_count?: number
          rating_average?: number
          rating_count?: number
          tags?: string[]
          creator_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      // Gift items
      gift_items: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          rarity: string
          price_coins: number | null
          price_usd: number | null
          gift_multiplier: number
          preview_media: string[]
          item_data: Json
          is_giftable: boolean
          is_limited_edition: boolean
          availability_start: string | null
          availability_end: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          rarity?: string
          price_coins?: number | null
          price_usd?: number | null
          gift_multiplier?: number
          preview_media?: string[]
          item_data: Json
          is_giftable?: boolean
          is_limited_edition?: boolean
          availability_start?: string | null
          availability_end?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          rarity?: string
          price_coins?: number | null
          price_usd?: number | null
          gift_multiplier?: number
          preview_media?: string[]
          item_data?: Json
          is_giftable?: boolean
          is_limited_edition?: boolean
          availability_start?: string | null
          availability_end?: string | null
          created_at?: string
        }
      }

      // Gift transactions
      gift_transactions: {
        Row: {
          id: string
          sender_id: string
          recipient_id: string
          gift_item_id: string
          message: string | null
          is_anonymous: boolean
          payment_method: string
          amount_paid: number
          status: string
          gift_wrapping: Json | null
          delivery_config: Json | null
          sent_at: string
          received_at: string | null
          expires_at: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id: string
          gift_item_id: string
          message?: string | null
          is_anonymous?: boolean
          payment_method: string
          amount_paid: number
          status?: string
          gift_wrapping?: Json | null
          delivery_config?: Json | null
          sent_at?: string
          received_at?: string | null
          expires_at?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          sender_id?: string
          recipient_id?: string
          gift_item_id?: string
          message?: string | null
          is_anonymous?: boolean
          payment_method?: string
          amount_paid?: number
          status?: string
          gift_wrapping?: Json | null
          delivery_config?: Json | null
          sent_at?: string
          received_at?: string | null
          expires_at?: string | null
          metadata?: Json
        }
      }

      // Gift reactions
      gift_reactions: {
        Row: {
          id: string
          gift_transaction_id: string
          recipient_id: string
          reaction_type: string
          public_message: string | null
          private_message: string | null
          media_response_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          gift_transaction_id: string
          recipient_id: string
          reaction_type: string
          public_message?: string | null
          private_message?: string | null
          media_response_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          gift_transaction_id?: string
          recipient_id?: string
          reaction_type?: string
          public_message?: string | null
          private_message?: string | null
          media_response_url?: string | null
          created_at?: string
        }
      }

      // Group gifts
      group_gifts: {
        Row: {
          id: string
          organizer_id: string
          recipient_id: string
          target_gift_id: string
          target_amount: number
          current_amount: number
          deadline: string
          status: string
          group_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organizer_id: string
          recipient_id: string
          target_gift_id: string
          target_amount: number
          current_amount?: number
          deadline: string
          status?: string
          group_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organizer_id?: string
          recipient_id?: string
          target_gift_id?: string
          target_amount?: number
          current_amount?: number
          deadline?: string
          status?: string
          group_message?: string | null
          created_at?: string
        }
      }

      // Group gift contributions
      group_gift_contributions: {
        Row: {
          id: string
          group_gift_id: string
          contributor_id: string
          amount_contributed: number
          contributor_message: string | null
          is_anonymous: boolean
          contributed_at: string
        }
        Insert: {
          id?: string
          group_gift_id: string
          contributor_id: string
          amount_contributed: number
          contributor_message?: string | null
          is_anonymous?: boolean
          contributed_at?: string
        }
        Update: {
          id?: string
          group_gift_id?: string
          contributor_id?: string
          amount_contributed?: number
          contributor_message?: string | null
          is_anonymous?: boolean
          contributed_at?: string
        }
      }

      // Search analytics
      search_analytics: {
        Row: {
          id: string
          user_id: string | null
          query: string
          filters: Json | null
          results_count: number | null
          clicked_results: Json | null
          search_duration_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          query: string
          filters?: Json | null
          results_count?: number | null
          clicked_results?: Json | null
          search_duration_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          query?: string
          filters?: Json | null
          results_count?: number | null
          clicked_results?: Json | null
          search_duration_ms?: number | null
          created_at?: string
        }
      }

      // Gift analytics
      gift_analytics: {
        Row: {
          id: string
          user_id: string
          period_start: string
          period_end: string
          gifts_sent_count: number
          gifts_received_count: number
          total_spent_coins: number
          total_spent_usd: number
          total_received_value_coins: number
          analytics_data: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period_start: string
          period_end: string
          gifts_sent_count?: number
          gifts_received_count?: number
          total_spent_coins?: number
          total_spent_usd?: number
          total_received_value_coins?: number
          analytics_data?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          period_start?: string
          period_end?: string
          gifts_sent_count?: number
          gifts_received_count?: number
          total_spent_coins?: number
          total_spent_usd?: number
          total_received_value_coins?: number
          analytics_data?: Json
          created_at?: string
        }
      }

      // User engagement analytics
      user_engagement_analytics: {
        Row: {
          id: string
          user_id: string
          date: string
          session_count: number
          session_duration_minutes: number
          loops_created: number
          loops_liked: number
          loops_commented: number
          searches_performed: number
          rooms_visited: number
          gifts_sent: number
          xp_earned: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          session_count?: number
          session_duration_minutes?: number
          loops_created?: number
          loops_liked?: number
          loops_commented?: number
          searches_performed?: number
          rooms_visited?: number
          gifts_sent?: number
          xp_earned?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          session_count?: number
          session_duration_minutes?: number
          loops_created?: number
          loops_liked?: number
          loops_commented?: number
          searches_performed?: number
          rooms_visited?: number
          gifts_sent?: number
          xp_earned?: number
          created_at?: string
        }
      }

      // Include existing tables
      loop_stats: {
        Row: {
          loop_id: string
          likes_count: number
          comments_count: number
          branches_count: number
          shares_count: number
          views_count: number
          updated_at: string
        }
        Insert: {
          loop_id: string
          likes_count?: number
          comments_count?: number
          branches_count?: number
          shares_count?: number
          views_count?: number
          updated_at?: string
        }
        Update: {
          loop_id?: string
          likes_count?: number
          comments_count?: number
          branches_count?: number
          shares_count?: number
          views_count?: number
          updated_at?: string
        }
      }

      loop_interactions: {
        Row: {
          id: string
          user_id: string
          loop_id: string
          interaction_type: 'like' | 'save' | 'view' | 'share'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          loop_id: string
          interaction_type: 'like' | 'save' | 'view' | 'share'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          loop_id?: string
          interaction_type?: 'like' | 'save' | 'view' | 'share'
          created_at?: string
        }
      }

      comments: {
        Row: {
          id: string
          loop_id: string
          author_id: string
          content: string
          parent_comment_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loop_id: string
          author_id: string
          content: string
          parent_comment_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loop_id?: string
          author_id?: string
          content?: string
          parent_comment_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }

      circles: {
        Row: {
          id: string
          name: string
          description: string | null
          avatar_url: string | null
          banner_url: string | null
          is_private: boolean
          owner_id: string
          member_count: number
          category: string
          tags: string[]
          rules: Json
          theme_id: string | null
          voice_channel_enabled: boolean
          screen_sharing_enabled: boolean
          max_members: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          is_private?: boolean
          owner_id: string
          member_count?: number
          category?: string
          tags?: string[]
          rules?: Json
          theme_id?: string | null
          voice_channel_enabled?: boolean
          screen_sharing_enabled?: boolean
          max_members?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          is_private?: boolean
          owner_id?: string
          member_count?: number
          category?: string
          tags?: string[]
          rules?: Json
          theme_id?: string | null
          voice_channel_enabled?: boolean
          screen_sharing_enabled?: boolean
          max_members?: number
          created_at?: string
          updated_at?: string
        }
      }

      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'like' | 'comment' | 'follow' | 'branch' | 'mention' | 'system' | 'achievement' | 'gift'
          title: string
          message: string
          data: Json | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'like' | 'comment' | 'follow' | 'branch' | 'mention' | 'system' | 'achievement' | 'gift'
          title: string
          message: string
          data?: Json | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'like' | 'comment' | 'follow' | 'branch' | 'mention' | 'system' | 'achievement' | 'gift'
          title?: string
          message?: string
          data?: Json | null
          is_read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_user_level: {
        Args: { total_xp: number }
        Returns: { level: number; current_xp: number; xp_for_next_level: number }[]
      }
      increment_loop_likes: {
        Args: { loop_id: string }
        Returns: undefined
      }
      get_user_feed: {
        Args: {
          user_id: string
          feed_limit?: number
          feed_offset?: number
        }
        Returns: {
          loop_id: string
          author_id: string
          content_type: string
          content_text: string | null
          content_media_url: string | null
          created_at: string
          likes_count: number
          comments_count: number
          branches_count: number
          author_username: string
          author_display_name: string
          author_avatar_url: string | null
          is_liked: boolean
          is_saved: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Type helpers for the enhanced database
export type EnhancedTables<T extends keyof EnhancedDatabase['public']['Tables']> = EnhancedDatabase['public']['Tables'][T]['Row']
export type EnhancedInserts<T extends keyof EnhancedDatabase['public']['Tables']> = EnhancedDatabase['public']['Tables'][T]['Insert']
export type EnhancedUpdates<T extends keyof EnhancedDatabase['public']['Tables']> = EnhancedDatabase['public']['Tables'][T]['Update']

// Specific type exports for commonly used tables
export type EnhancedProfile = EnhancedTables<'profiles'>
export type EnhancedLoop = EnhancedTables<'loops'>
export type XPTransaction = EnhancedTables<'xp_transactions'>
export type Achievement = EnhancedTables<'achievements'>
export type UserAchievement = EnhancedTables<'user_achievements'>
export type SkillTree = EnhancedTables<'skill_trees'>
export type UserSkill = EnhancedTables<'user_skills'>
export type DailyChallenge = EnhancedTables<'daily_challenges'>
export type UserRoom = EnhancedTables<'user_rooms'>
export type RoomVisit = EnhancedTables<'room_visits'>
export type Theme = EnhancedTables<'themes'>
export type ThemeCategory = EnhancedTables<'theme_categories'>
export type GiftItem = EnhancedTables<'gift_items'>
export type GiftTransaction = EnhancedTables<'gift_transactions'>
export type GiftReaction = EnhancedTables<'gift_reactions'>
export type GroupGift = EnhancedTables<'group_gifts'>
export type SearchAnalytics = EnhancedTables<'search_analytics'>
export type GiftAnalytics = EnhancedTables<'gift_analytics'>
export type UserEngagementAnalytics = EnhancedTables<'user_engagement_analytics'>

// Utility types for common operations
export interface UserLevelInfo {
  level: number
  current_xp: number
  xp_for_next_level: number
  total_xp_required: number
  level_benefits: string[]
}

export interface SearchFilters {
  type?: 'loops' | 'users' | 'hashtags' | 'all'
  category?: string
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed'
  timeframe?: '1h' | '24h' | '7d' | '30d' | 'all'
  sort?: 'relevance' | 'recent' | 'popular' | 'trending'
  verified_only?: boolean
  premium_only?: boolean
  min_engagement?: number
  language?: string
}

export interface SearchResponse {
  query: string
  total_results: number
  search_time_ms: number
  filters_applied: SearchFilters
  results: {
    loops: LoopSearchResult[]
    users: UserSearchResult[]
    hashtags: HashtagSearchResult[]
    suggestions: SearchSuggestion[]
  }
  pagination: {
    current_page: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export interface LoopSearchResult {
  id: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
    is_verified: boolean
    is_premium: boolean
  }
  content: {
    type: 'text' | 'image' | 'video' | 'audio' | 'file'
    text?: string
    media_url?: string
    preview?: string
  }
  metadata: {
    category: string
    sentiment: string
    trending_score: number
    relevance_score: number
    engagement_score: number
  }
  stats: {
    likes: number
    comments: number
    branches: number
    shares: number
    views: number
  }
  created_at: string
  highlighted_text?: string
}

export interface UserSearchResult {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  is_verified: boolean
  is_premium: boolean
  level: number
  xp_points: number
  followers_count: number
  following_count: number
  relevance_score: number
}

export interface HashtagSearchResult {
  tag: string
  count: number
  trending: boolean
  category?: string
  relevance_score: number
}

export interface SearchSuggestion {
  query: string
  type: 'completion' | 'correction' | 'related'
  confidence: number
}

export interface Room3DLayout {
  id: string
  name: string
  type: 'personal' | 'showcase' | 'meeting' | 'gallery' | 'workspace' | 'social'
  dimensions: { width: number; height: number; depth: number }
  camera_positions: Array<{
    name: string
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
  }>
  lighting_setup: {
    ambient: { color: string; intensity: number }
    directional: Array<{
      color: string
      intensity: number
      position: { x: number; y: number; z: number }
    }>
  }
  interactive_zones: Array<{
    id: string
    type: 'clickable' | 'hoverable' | 'draggable'
    position: { x: number; y: number; z: number }
    size: { width: number; height: number; depth: number }
    content_type: string
  }>
}

export interface GiftWrapping {
  id: string
  name: string
  theme: 'elegant' | 'festive' | 'minimalist' | 'animated' | 'seasonal'
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  pattern: string
  animation: string
  unwrap_effect: string
  price_coins?: number
}
