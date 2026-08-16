import { Metadata } from "next"
import { LoopDetailClient } from "@/components/loops/loop-detail-client"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"

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

  try {
    const { data: loop } = await supabase
      .from("loops")
      .select(
        "content_title, content, author_id, content_type, content_metadata, loop_stats(likes_count), profiles(username, display_name, avatar_url, is_verified)",
      )
      .eq("id", id)
      .single()

    if (loop) {
      const authorName = (loop as any)?.profiles?.display_name || (loop as any)?.profiles?.username || "Creator"
      username = (loop as any)?.profiles?.username || ""
      avatarUrl = (loop as any)?.profiles?.avatar_url || ""
      isVerified = Boolean((loop as any)?.profiles?.is_verified)
      likeCount = Number((loop as any)?.loop_stats?.likes_count || 0)
      isCodeLoop =
        (loop as any)?.content_type === "code" ||
        Boolean((loop as any)?.content_metadata?.is_code) ||
        (loop as any)?.media_type === "code"
      title = `${loop.content_title || loop.content.slice(0, 50)} by @${authorName}`
      description = loop.content.slice(0, 160)
    }
  } catch (err) {
    console.error("Error generating metadata for loop:", err)
  }

  const ogParams = new URLSearchParams({
    type: isCodeLoop ? "developer" : "loop",
    id,
    title,
    description,
    username,
  })
  if (avatarUrl) ogParams.set("avatar", avatarUrl)
  if (isVerified) ogParams.set("verified", "true")
  if (likeCount > 0) {
    ogParams.set("stat", likeCount.toLocaleString())
    ogParams.set("stat_label", likeCount === 1 ? "like" : "likes")
  }
  const ogImageUrl = `${baseUrl}/api/og?${ogParams.toString()}`

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/loop/${id}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/loop/${id}`,
      type: "article",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
  }
}

export default async function LoopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LoopDetailClient loopId={id} />
}
