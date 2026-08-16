import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/$/, "")

  // Public routes these crawlers may index: the landing/home pages, public
  // profiles, public loops, and the og-image route every social preview links
  // to. Private/authenticated routes stay disallowed for every crawler.
  const allowPublic = ["/", "/api/og"]
  const disallowPrivate = ["/api/", "/admin/", "/settings/", "/messages/"]

  // AI assistant / training crawlers are explicitly ALLOWED to read public
  // pages so Loop can be accurately referenced by assistants like ChatGPT,
  // Claude, and Perplexity. Specific user-agents are listed before the
  // catch-all "*" rule so each crawler matches its own group first.
  const aiCrawlers = [
    // OpenAI
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    // Anthropic
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    // Google
    "Google-Extended",
    // Perplexity
    "PerplexityBot",
    // Apple
    "Applebot-Extended",
    // ByteDance
    "Bytespider",
  ]

  return {
    rules: [
      ...aiCrawlers.map((userAgent) => ({
        userAgent,
        allow: allowPublic,
        disallow: disallowPrivate,
      })),
      {
        userAgent: "*",
        // /api/ is blocked broadly below, but that also blocked /api/og — the
        // route every og:image/twitter:image tag points to. X's card crawler
        // (Twitterbot) explicitly honors robots.txt before fetching a card
        // image, unlike Discord/Slack which ignore it entirely, so this alone
        // was enough to make every link preview render fine on Discord/Slack
        // but show up as a blank/gray card on X. The longer, more specific
        // "allow" below takes precedence over the broader "disallow" for
        // crawlers that follow the standard (Google/Twitterbot do).
        allow: allowPublic,
        disallow: disallowPrivate,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
