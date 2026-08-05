import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loop-app.com"
  return {
    rules: {
      userAgent: "*",
      // /api/ is blocked broadly below, but that also blocked /api/og — the
      // route every og:image/twitter:image tag points to. X's card crawler
      // (Twitterbot) explicitly honors robots.txt before fetching a card
      // image, unlike Discord/Slack which ignore it entirely, so this alone
      // was enough to make every link preview render fine on Discord/Slack
      // but show up as a blank/gray card on X. The longer, more specific
      // "allow" below takes precedence over the broader "disallow" for
      // crawlers that follow the standard (Google/Twitterbot do).
      allow: ["/", "/api/og"],
      disallow: ["/api/", "/admin/", "/settings/", "/messages/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
