export type NormalizedLoop = {
  id: string
  author_id: string
  content: string
  content_title?: string | null
  media_type: string
  media_url?: string
  media_urls?: string[]
  hashtags?: string[]
  created_at: string
  updated_at?: string
  parent_loop_id?: string | null
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_verified?: boolean
    is_premium?: boolean
    level?: number
  }
  stats: {
    likes_count: number
    comments_count: number
    branches_count: number
    shares_count: number
    views_count: number
  }
  user_interactions: {
    is_liked: boolean
    is_saved: boolean
    has_viewed?: boolean
    has_shared?: boolean
  }
  visibility?: string
  category?: string
  is_featured?: boolean
  engagement_score?: number
}

const defaultStats = {
  likes_count: 0,
  comments_count: 0,
  branches_count: 0,
  shares_count: 0,
  views_count: 0,
}

function first<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value || undefined
}

export function normalizeLoop(row: any, interactionTypes: string[] = []): NormalizedLoop {
  const author = first(row?.author) || first(row?.profiles) || row?.profile || {}
  const stats = first(row?.stats) || first(row?.loop_stats) || row?.loop_stats || {}
  const interactions = interactionTypes.length
    ? interactionTypes
    : Array.isArray(row?.loop_interactions)
      ? row.loop_interactions.map((interaction: any) => interaction.interaction_type)
      : []

  return {
    id: row?.id || "",
    author_id: row?.author_id || author?.id || "",
    content: row?.content_text ?? row?.content ?? row?.text ?? "",
    content_title: row?.content_title ?? row?.title ?? null,
    media_type: row?.content_type ?? row?.media_type ?? "text",
    media_url: row?.content_media_url ?? row?.media_url ?? undefined,
    media_urls: row?.media_urls ?? undefined,
    hashtags: Array.isArray(row?.hashtags) ? row.hashtags : [],
    created_at: row?.created_at || new Date().toISOString(),
    updated_at: row?.updated_at || row?.created_at,
    parent_loop_id: row?.parent_loop_id ?? null,
    author: {
      id: author?.id || row?.author_id || "",
      username: author?.username || "unknown",
      display_name: author?.display_name || author?.username || "Unknown User",
      avatar_url: author?.avatar_url || undefined,
      is_verified: Boolean(author?.is_verified),
      is_premium: Boolean(author?.is_premium),
      level: author?.level,
    },
    stats: {
      likes_count: Number(stats?.likes_count ?? stats?.likes ?? defaultStats.likes_count),
      comments_count: Number(stats?.comments_count ?? stats?.comments ?? defaultStats.comments_count),
      branches_count: Number(stats?.branches_count ?? stats?.branches ?? defaultStats.branches_count),
      shares_count: Number(stats?.shares_count ?? stats?.shares ?? defaultStats.shares_count),
      views_count: Number(stats?.views_count ?? stats?.views ?? defaultStats.views_count),
    },
    user_interactions: {
      is_liked: Boolean(row?.user_interactions?.is_liked ?? interactions.includes("like")),
      is_saved: Boolean(row?.user_interactions?.is_saved ?? interactions.includes("save")),
      has_viewed: Boolean(row?.user_interactions?.has_viewed ?? interactions.includes("view")),
      has_shared: Boolean(row?.user_interactions?.has_shared ?? interactions.includes("share")),
    },
    visibility: row?.visibility,
    category: row?.category,
    is_featured: row?.is_featured,
    engagement_score: Number(
      row?.engagement_score ??
        (Number(stats?.likes_count ?? 0) * 3 + Number(stats?.comments_count ?? 0) * 4 + Number(stats?.branches_count ?? 0) * 5 + Number(stats?.views_count ?? 0)),
    ),
  }
}

export function normalizeLoops(rows: any[] = [], interactionMap: Map<string, string[]> = new Map()) {
  return rows.map((row) => normalizeLoop(row, interactionMap.get(row?.id) || []))
}
