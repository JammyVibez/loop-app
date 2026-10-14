import type { Metadata } from "next"
import type { ReactNode } from "react"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata } from "@/lib/og/metadata"

/** Reel (moment) pages are client components — metadata is generated here. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

interface MomentLayoutProps {
  params: Promise<{ id: string }>
  children: ReactNode
}

export async function generateMetadata({ params }: MomentLayoutProps): Promise<Metadata> {
  const { id } = await params
  const baseUrl = await getAbsoluteAppUrl()

  let title = "A moment on Loop"
  let description = "Moments are 24-hour reels on Loop — quick visual drops from the community."
  let authorName = ""
  let username = ""
  let avatar = ""
  let poster = ""
  let verified = false
  let expired = false

  try {
    const { data: moment } = await supabase
      .from("moments")
      .select("*, author:profiles!user_id(display_name, username, avatar_url, is_verified)")
      .eq("id", id)
      .maybeSingle()

    if (moment) {
      const expiresAt = (moment as any).expires_at
      expired = Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now())
      const author = Array.isArray((moment as any).author) ? (moment as any).author[0] : (moment as any).author
      authorName = author?.display_name || author?.username || ""
      username = author?.username || ""
      avatar = author?.avatar_url || ""
      verified = Boolean(author?.is_verified)

      const caption = String((moment as any).content || "").trim()
      if (!expired) {
        title = caption || (authorName ? `${authorName} posted a moment` : title)
        description = caption ? `${authorName || "A creator"} on Loop: ${caption}`.slice(0, 170) : description
        // Video posters are left to the template's fallback frame; the loader
        // only inlines real images.
        poster = String((moment as any).media_url || "")
      } else {
        title = "This moment has expired"
        description = "Moments last 24 hours. Follow the creator on Loop to catch the next one."
      }
    }
  } catch (err) {
    console.error("Error generating moment metadata:", err)
  }

  return buildOgMetadata({
    baseUrl,
    path: `/moments/${id}`,
    type: "reel",
    title,
    description,
    params: {
      name: authorName,
      username,
      avatar: expired ? "" : avatar,
      verified: verified && !expired,
      media: expired ? "" : poster,
      category: expired ? "Expired" : "Moment",
      url: `loopapp.me/moments/${id}`,
    },
  })
}

export default function MomentLayout({ children }: MomentLayoutProps) {
  return children
}
