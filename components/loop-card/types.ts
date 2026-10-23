import type { ActiveCosmetics } from "@/lib/cosmetics"

export interface LoopAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  video_avatar_url?: string | null
  is_verified?: boolean
  is_team_member?: boolean
  is_sponsor?: boolean
  is_premium?: boolean
  is_organization?: boolean
  organization_badge_url?: string
  organization_name?: string
  equipped_frame_id?: string | number | null
  level?: number
  cosmetics?: ActiveCosmetics | null
  active_cosmetics?: ActiveCosmetics | null
  badge_id?: string | number | null
}

export interface LoopStats {
  likes_count: number
  comments_count: number
  branches_count: number
  /** Rebranches that quoted this post. */
  quotes_count?: number
  shares_count: number
  views_count: number
}

export interface LoopData {
  id: string
  author_id: string
  content: string
  media_type: string
  media_url?: string
  media_urls?: string[]
  hashtags?: string[]
  created_at: string
  author: LoopAuthor
  stats: LoopStats
  user_interactions: {
    is_liked: boolean
    is_saved: boolean
  }
  is_featured?: boolean
  is_pinned?: boolean
  engagement_score?: number
  gifts_received?: number
  total_gift_value?: number
  parent_loop_id?: string | null
  parent_loop?: any
  content_metadata?: Record<string, any> | null
  content_title?: string | null
  content_type?: string
  category?: string
  post_type?: string
  poll?: any
  duel?: any
  is_co_loop?: boolean
  co_authors?: any[]
  boost_coins_current?: number
  boost_coins_target?: number
  is_boosted?: boolean
  is_clutch?: boolean
  is_spoiler?: boolean
}

export interface LoopCardProps {
  loop: any
  interacting?: string | null
  onInteraction?: (loopId: string, type: "like" | "save") => void
  onDeleted?: (loopId: string) => void
  onEdited?: (loop: any) => void
  onLike?: () => void
  onBookmark?: () => void
  isChild?: boolean
  className?: string
}
