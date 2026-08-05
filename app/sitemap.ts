import { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

// Regenerate hourly so new profiles/loops/circles get indexed without
// needing a full redeploy.
export const revalidate = 3600

// Previously static-only: profiles, loops, and circles — the pages that
// actually carry the new per-type OG images and are what search engines
// should be indexing for organic discovery — were completely invisible to
// crawlers because nothing ever listed their URLs here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loop-app.com"
  const now = new Date()

  const staticRoutes = [
    "",
    "/explore",
    "/reels",
    "/circles",
    "/events",
    "/streams",
    "/trending",
    "/landing",
    "/developers",
    "/marketplace",
    "/help",
    "/terms",
    "/privacy",
  ]

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/explore" ? "always" : "daily",
    priority: route === "" ? 1.0 : 0.8,
  }))

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return entries

    const supabase = createClient(supabaseUrl, supabaseKey)

    const [{ data: profiles }, { data: loops }, { data: circles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, updated_at")
        .not("username", "is", null)
        .order("followers_count", { ascending: false, nullsFirst: false })
        .limit(1000),
      supabase
        .from("loops")
        .select("id, updated_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("circles")
        .select("id, updated_at")
        .eq("is_private", false)
        .order("created_at", { ascending: false })
        .limit(500),
    ])

    for (const profile of profiles || []) {
      entries.push({
        url: `${baseUrl}/profile/${profile.username}`,
        lastModified: profile.updated_at ? new Date(profile.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.6,
      })
    }
    for (const loop of loops || []) {
      entries.push({
        url: `${baseUrl}/loop/${loop.id}`,
        lastModified: loop.updated_at ? new Date(loop.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.5,
      })
    }
    for (const circle of circles || []) {
      entries.push({
        url: `${baseUrl}/circles/${circle.id}`,
        lastModified: circle.updated_at ? new Date(circle.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.5,
      })
    }
  } catch (error) {
    console.error("Error building dynamic sitemap entries:", error)
  }

  return entries
}
