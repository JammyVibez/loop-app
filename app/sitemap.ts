import type { MetadataRoute } from "next"

const SITE_URL = "https://loop-app-xi.vercel.app"

const PUBLIC_ROUTES: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/explore", changeFrequency: "daily", priority: 0.9 },
  { path: "/trending", changeFrequency: "daily", priority: 0.9 },
  { path: "/reels", changeFrequency: "daily", priority: 0.8 },
  { path: "/circles", changeFrequency: "weekly", priority: 0.8 },
  { path: "/marketplace", changeFrequency: "weekly", priority: 0.7 },
  { path: "/shop", changeFrequency: "weekly", priority: 0.7 },
  { path: "/games", changeFrequency: "weekly", priority: 0.6 },
  { path: "/premium", changeFrequency: "monthly", priority: 0.7 },
  { path: "/landing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/help", changeFrequency: "monthly", priority: 0.5 },
  { path: "/support", changeFrequency: "monthly", priority: 0.5 },
  { path: "/developers", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
