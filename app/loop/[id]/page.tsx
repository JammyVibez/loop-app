import { Metadata } from "next"
import { LoopDetailClient } from "@/components/loops/loop-detail-client"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata, personParam } from "@/lib/og/metadata"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const baseUrl = await getAbsoluteAppUrl()

  let title = "loopapp.me Details — Collaborative Social OS"
  let description = "View and interact with this loop on Loop Social OS."
  let username = ""
  let avatarUrl = ""
  let isVerified = false
  let likeCount = 0
  let isCodeLoop = false
  // Extra fields the premium share card needs (author name, PRO, custom mark).
  let authorName = ""
  let isPremium = false
  let createdAt = ""
  let postBody = ""
  let badgeLabel = ""
  let badgeColors: string[] = []
  let mediaUrl = ""
  let kicker = "Post"
  // Posts limited to a circle audience never publish text, media or stats to
  // a public preview — the crawler only ever sees the branded fallback.
  let isRestricted = false

  try {
    const { data: loop } = await supabase
      .from("loops")
      .select(
        "content_title, content, author_id, content_type, content_metadata, created_at, media_url, media_type, visibility, loop_stats(likes_count), profiles(username, display_name, avatar_url, is_verified, is_premium, badge_id)",
      )
      .eq("id", id)
      .single()

    if (loop) {
      authorName = (loop as any)?.profiles?.display_name || (loop as any)?.profiles?.username || "Creator"
      username = (loop as any)?.profiles?.username || ""
      avatarUrl = (loop as any)?.profiles?.avatar_url || ""
      isVerified = Boolean((loop as any)?.profiles?.is_verified)
      isPremium = Boolean((loop as any)?.profiles?.is_premium)
      likeCount = Number((loop as any)?.loop_stats?.likes_count || 0)
      createdAt = (loop as any)?.created_at || ""
      postBody = String(loop.content || "").slice(0, 480)
      mediaUrl = String((loop as any).media_url || "")
      const visibility = String((loop as any).visibility || "public")
      isRestricted = visibility !== "public"

      // Custom verification mark (admin badge) — resolved so the share card can
      // paint it next to the standard verified / PRO badges.
      const badgeId = (loop as any)?.profiles?.badge_id
      if (badgeId) {
        const { data: badge } = await supabase
          .from("verification_badges")
          .select("label, name, colors")
          .eq("id", badgeId)
          .maybeSingle()
        if (badge) {
          badgeLabel = (badge as any)?.label || (badge as any)?.name || ""
          let colors: unknown = (badge as any)?.colors
          if (typeof colors === "string") {
            try {
              colors = JSON.parse(colors)
            } catch {
              colors = (badge as any)?.colors
            }
          }
          if (Array.isArray(colors)) {
            badgeColors = colors.map((c: unknown) => String(c).trim()).filter(Boolean).slice(0, 2)
          }
        }
      }
      isCodeLoop =
        (loop as any)?.content_type === "code" ||
        Boolean((loop as any)?.content_metadata?.is_code) ||
        (loop as any)?.media_type === "code"
      kicker = isCodeLoop ? "Code" : "Post"
      title = `${loop.content_title || loop.content.slice(0, 50)} by @${authorName}`
      description = loop.content.slice(0, 160)
    }
  } catch (err) {
    console.error("Error generating metadata for loop:", err)
  }

  // A duel lives inside its loop, so the share card has to recognise the
  // debate and render the two sides instead of a generic post.
  let duelPrompt = ""
  let side1: string | undefined
  let side2: string | undefined
  if (!isRestricted) {
    try {
      const { data: duel } = await supabase
        .from("loop_duels")
        .select(
          "prompt, creator:profiles!creator_id(display_name, username, avatar_url), opponent:profiles!opponent_id(display_name, username, avatar_url)",
        )
        .eq("loop_id", id)
        .maybeSingle()
      if (duel) {
        const creator = Array.isArray((duel as any).creator) ? (duel as any).creator[0] : (duel as any).creator
        const opponent = Array.isArray((duel as any).opponent) ? (duel as any).opponent[0] : (duel as any).opponent
        duelPrompt = String((duel as any).prompt || "")
        side1 = personParam(creator?.display_name || creator?.username, creator?.avatar_url)
        side2 = personParam(opponent?.display_name || opponent?.username, opponent?.avatar_url)
      }
    } catch (err) {
      console.error("Error loading duel for loop metadata:", err)
    }
  }

  const type = duelPrompt ? "duel" : isCodeLoop ? "developer" : "post"
  const shownTitle = duelPrompt ? duelPrompt : title
  const shownDescription = isRestricted
    ? "This post is only visible to its audience on Loop."
    : duelPrompt
      ? "Two sides, one public vote. Open the duel on Loop."
      : description

  return buildOgMetadata({
    baseUrl,
    path: `/loop/${id}`,
    type,
    title: shownTitle,
    description: shownDescription,
    ogType: "article",
    params: {
      // Restricted posts publish nothing but the branded fallback card.
      name: isRestricted ? "" : authorName,
      username: isRestricted ? "" : username,
      avatar: isRestricted ? "" : avatarUrl,
      body: isRestricted ? "" : postBody,
      media: isRestricted ? "" : mediaUrl,
      category: isRestricted ? "" : kicker,
      date: createdAt && !isRestricted ? formatOgDate(createdAt) : "",
      verified: !isRestricted && isVerified,
      premium: !isRestricted && isPremium,
      badge_color: badgeColors[0],
      badge_color2: badgeColors[1],
      stat: !isRestricted && likeCount > 0 ? likeCount : undefined,
      stat_label: likeCount === 1 ? "like" : "likes",
      side1,
      side2,
      url: `loopapp.me/loop/${id}`,
    },
  })
}

function formatOgDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function LoopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LoopDetailClient loopId={id} />
}
