/**
 * Shared Schema.org (JSON-LD) structured data for Loop's public pages.
 * Helps traditional search engines AND AI assistants (ChatGPT, Claude,
 * Perplexity, ...) understand and accurately represent what Loop is.
 */

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/$/, "")
}

const orgDescription =
  "Loop is where communities create in real time — co-write posts live with friends, settle debates in public Duels, and build spaces that are actually yours."

/**
 * Organization + WebApplication + FAQ + MobileApp graph for the landing/home pages.
 * `@id` anchors let the WebApplication reference the Organization as publisher.
 */
export function organizationWebAppJsonLd(): Record<string, unknown> {
  const siteUrl = getSiteUrl()
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": siteUrl + "/#organization",
        name: "Loop",
        alternateName: "loopapp.me",
        url: siteUrl,
        logo: siteUrl + "/icons/icon-144x144.png",
        description: orgDescription,
        sameAs: [
          "https://twitter.com/loopappme",
          "https://www.tiktok.com/@loopappme",
          "https://www.instagram.com/loopappme/",
        ],
      },
      {
        "@type": "WebApplication",
        "@id": siteUrl + "/#webapplication",
        name: "Loop",
        alternateName: "loopapp.me",
        url: siteUrl,
        description:
          "Collaborative social networking platform with real-time co-loops, public duels, circles, live streams, reels, and a creator economy.",
        applicationCategory: "SocialNetworkingApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        inLanguage: "en",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: {
          "@id": siteUrl + "/#organization",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          ratingCount: "150",
          bestRating: "5",
          worstRating: "1",
        },
      },
      {
        "@type": "MobileApplication",
        name: "Loop - Social Network",
        operatingSystem: "iOS, Android",
        applicationCategory: "SocialNetworkingApplication",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        url: siteUrl,
        description: orgDescription,
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is Loop?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Loop is a collaborative social network where you co-write posts live with friends, settle debates in public Duels, build communities in Circles, go live with streams, and earn Loop Coins for being active. Think of it as the social app built for creators, builders, and communities — not just scrolling.",
            },
          },
          {
            "@type": "Question",
            name: "What are Co-Loops?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Co-Loops are real-time collaborative posts where multiple people write, edit, and create together simultaneously. It's like Google Docs meets social media — your audience watches the creation happen live.",
            },
          },
          {
            "@type": "Question",
            name: "What are Circles on Loop?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Circles are community spaces where people with shared interests come together. Each Circle has its own feed, rooms (text/voice/video), events, and customizable themes. Think of them as Discord servers meets subreddits, but with real-time collaboration built in.",
            },
          },
          {
            "@type": "Question",
            name: "What are Loop Duels?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Loop Duels are public debates where two people take opposite sides on a topic and the community votes on who made the better argument. It's structured, respectful disagreement — the opposite of Twitter arguments.",
            },
          },
          {
            "@type": "Question",
            name: "How do Loop Coins work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Loop Coins are earned by being active on the platform — posting, commenting, getting likes, winning Duels, and completing daily challenges. You can spend coins on profile themes, cosmetics, and gift items in the Loop Shop.",
            },
          },
          {
            "@type": "Question",
            name: "Is Loop free to use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, Loop is completely free. There's a free tier with all core features (posting, Circles, Co-Loops, Duels, messaging) and a Pro tier with premium cosmetics, higher account limits, and priority support.",
            },
          },
        ],
      },
    ],
  }
}

/**
 * SEO metadata for the landing page — export for use in layout.tsx or page.tsx.
 */
export const landingPageSeo = {
  title: "Loop — Build Together, Not Just Post Into The Void",
  description:
    "Loop is the collaborative social network where you co-write posts live with friends, settle debates in public Duels, build communities in Circles, and earn rewards for being active. Free to join.",
  keywords:
    "social network, collaborative social media, co-loop, real-time collaboration, circles, live streams, duels, social app, community app, creator economy, loop coins, social networking",
}
