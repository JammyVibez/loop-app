/**
 * Shared Schema.org (JSON-LD) structured data for Loop's public pages.
 * Helps traditional search engines AND AI assistants (ChatGPT, Claude,
 * Perplexity, ...) understand and accurately represent what Loop is.
 */

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/$/, "")
}

const orgDescription =
  "loopapp.me is where communities create in real time — co-write posts live with friends, settle debates in public Duels, and build spaces that are actually yours."

/**
 * Organization + WebApplication graph for the landing/home pages.
 * `@id` anchors let the WebApplication reference the Organization as publisher.
 */
export function organizationWebAppJsonLd(): Record<string, unknown> {
  const siteUrl = getSiteUrl()
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "loopapp.me",
        alternateName: "Loop",
        url: siteUrl,
        logo: `${siteUrl}/icons/icon-144x144.png`,
        description: orgDescription,
        sameAs: [],
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#webapplication`,
        name: "loopapp.me",
        alternateName: "Loop",
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
          "@id": `${siteUrl}/#organization`,
        },
      },
    ],
  }
}
