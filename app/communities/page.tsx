import type { Metadata } from "next"
import { Header } from "@/components/header"
import { MyCommunities } from "@/components/communities/my-communities"
import { AdSlot } from "@/components/ads/ad-slot"
import { buildOgMetadata } from "@/lib/og/metadata"

export const dynamic = "force-dynamic"

const SEO_TITLE = "My Circles on Loop"
const SEO_DESCRIPTION = "Your joined circles, people, and conversations on Loop."

export const metadata: Metadata = buildOgMetadata({
  baseUrl: (process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/$/, ""),
  path: "/communities",
  type: "community",
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  params: { name: "My Circles", category: "Circles", url: "/communities" },
})

export default async function CommunitiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <MyCommunities />
        <div className="mx-auto max-w-xl pt-10"><AdSlot surface="communities" /></div>
      </main>
    </div>
  )
}
