import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loop-app.com"
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/settings/", "/messages/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
