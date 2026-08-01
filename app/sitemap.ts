import { MetadataRoute } from "next"

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

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/explore" ? "always" : "daily",
    priority: route === "" ? 1.0 : 0.8,
  }))
}
