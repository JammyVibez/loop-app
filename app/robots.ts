import type { MetadataRoute } from "next"

const SITE_URL = "https://loop-app-xi.vercel.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/settings/",
          "/messages/",
          "/notifications/",
          "/onboarding/",
          "/bookmarks/",
          "/inventory/",
          "/login",
          "/signup",
          "/reset-password",
          "/email-confirmed",
          "/offline",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
