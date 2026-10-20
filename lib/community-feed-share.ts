import type { SupabaseClient } from "@supabase/supabase-js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export interface CircleShareRow {
  id: string | number
  name?: string | null
  handle?: string | null
  is_private?: boolean | null
}

/**
 * Community content is community-only by default. This module is the single
 * place that turns a member's explicit choice into a Loop feed post, so the
 * privacy rules live in one function instead of being re-derived per route.
 *
 * Rules, enforced server-side:
 *   - private communities can never be shared to the public feed
 *   - only published posts are eligible (pending approval is not)
 *   - the copied Loop always points back at the community post
 */
export function canShareCircle(circle: CircleShareRow | null | undefined) {
  return Boolean(circle && !circle.is_private)
}

export function isShareablePost(post: {
  status?: string | null
  feed_loop_id?: string | null
  media_url?: string | null
  media_urls?: string[] | null
  content?: string | null
}) {
  if (!post) return false
  if (post.status && post.status !== "published") return false
  if (post.feed_loop_id) return false
  const hasMedia =
    Boolean(post.media_url) || (Array.isArray(post.media_urls) && post.media_urls.length > 0)
  return Boolean((post.content || "").trim()) || hasMedia
}

/**
 * Mirror a community discussion into the Loop feed as a public Loop.
 * Returns the created loop id (as a string) so the caller can stamp
 * circle_posts.feed_loop_id.
 */
export async function sharePostToLoopFeed(
  sb: SB,
  args: {
    circle: CircleShareRow
    postId: string | number
    authorId: string
    content: string
    mediaUrl?: string | null
    mediaUrls?: string[] | null
    mediaType?: string | null
    spaceName?: string | null
  },
): Promise<string | null> {
  const {
    circle,
    postId,
    authorId,
    content,
    mediaUrl = null,
    mediaUrls = [],
    mediaType = null,
    spaceName = null,
  } = args

  const cleanUrls = (mediaUrls || []).filter((u) => typeof u === "string" && u.trim())
  const primary = mediaUrl || cleanUrls[0] || null
  const resolvedType = primary ? mediaType || "image" : "text"

  const { data: loop, error } = await sb
    .from("loops")
    .insert({
      author_id: authorId,
      content: content?.trim() || `Shared a ${resolvedType}`,
      content_text: content?.trim() || null,
      content_title: content?.trim() ? content.trim().slice(0, 80) : null,
      content_media_url: primary,
      media_url: primary,
      media_urls: cleanUrls.length > 0 ? cleanUrls : undefined,
      content_type: resolvedType,
      media_type: resolvedType,
      category: "community",
      hashtags: [],
      circle_id: circle.id,
      visibility: "public",
      tree_depth: 0,
      content_metadata: {
        shared_from_community: true,
        circle_id: circle.id,
        circle_name: circle.name || null,
        circle_handle: circle.handle || null,
        circle_space: spaceName || null,
        mirror_post_id: String(postId),
      },
    })
    .select("id")
    .single()

  if (error || !loop) {
    console.error("[community-feed-share] loop insert failed:", error?.message)
    return null
  }

  // loop_stats is normally created by a DB trigger; upsert keeps the feed card
  // from rendering a broken stats row if the trigger is missing.
  try {
    await sb.from("loop_stats").upsert(
      { loop_id: loop.id, likes_count: 0, comments_count: 0, shares_count: 0, views_count: 0, branches_count: 0 },
      { onConflict: "loop_id", ignoreDuplicates: true },
    )
  } catch {
    /* best effort */
  }

  return String(loop.id)
}

/**
 * Withdraw a shared Loop from the public feed without destroying the copy —
 * the community post keeps its history, the Loop just stops being public.
 */
export async function unsharePostFromFeed(sb: SB, feedLoopId: string | null | undefined) {
  if (!feedLoopId) return
  try {
    await sb.from("loops").update({ visibility: "private" }).eq("id", feedLoopId)
  } catch (error) {
    console.error("[community-feed-share] unshare failed:", error)
  }
}
