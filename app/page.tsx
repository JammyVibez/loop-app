import type { Metadata } from "next"
import { HomePageClient } from "@/components/home-page-client"
import { organizationWebAppJsonLd, landingPageSeo } from "@/lib/seo-jsonld"

export const metadata: Metadata = {
  title: landingPageSeo.title,
  description: landingPageSeo.description,
  keywords: landingPageSeo.keywords,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Loop — Build Together, Not Just Post Into The Void",
    description: landingPageSeo.description,
    type: "website",
    siteName: "Loop",
    images: ["/api/og?type=home"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop — Build Together, Not Just Post Into The Void",
    description: landingPageSeo.description,
  },
}

export default function HomePage() {
  return (
    <>
      {/* Schema.org structured data: Organization + WebApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationWebAppJsonLd()) }}
      />
      <HomePageClient />
    </>
  )
}
