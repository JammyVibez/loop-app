import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/$/, "")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  )

  const now = new Date()
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/explore`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/trending`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/auth`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ]

  // Public loop pages
  const { data: loops } = await supabase
    .from("loops")
    .select("id, updated_at, created_at")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(5000)

  const loopPages: MetadataRoute.Sitemap =
    loops?.map((loop) => ({
      url: `${siteUrl}/loop/${loop.id}`,
      lastModified: new Date(loop.updated_at || loop.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) || []

  // Public profile pages
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, updated_at")
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000)

  const profilePages: MetadataRoute.Sitemap =
    profiles
      ?.filter((p) => p.username)
      .map((profile) => ({
        url: `${siteUrl}/profile/${profile.username}`,
        lastModified: new Date(profile.updated_at || now),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })) || []

  // Public circles
  const { data: circles } = await supabase
    .from("circles")
    .select("id, updated_at")
    .order("created_at", { ascending: false })
    .limit(2000)

  const circlePages: MetadataRoute.Sitemap =
    circles?.map((circle) => ({
      url: `${siteUrl}/circles/${circle.id}`,
      lastModified: new Date(circle.updated_at || now),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })) || []

  return [...staticPages, ...loopPages, ...profilePages, ...circlePages]
}
