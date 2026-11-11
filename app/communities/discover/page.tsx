import Link from "next/link"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { DiscoverCommunities } from "@/components/communities/discover-communities"
import { Button } from "@/components/ui/button"
import { Compass, Plus, Users } from "@/components/icons/lucide-compat"
import { buildOgMetadata } from "@/lib/og/metadata"

export const dynamic = "force-dynamic"
export const metadata: Metadata = buildOgMetadata({
  baseUrl: (process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/$/, ""),
  path: "/communities/discover",
  type: "community",
  title: "Discover Circles on Loop",
  description: "Find new circles to join and build together.",
  params: { name: "Discover Circles", category: "Circles", url: "/communities/discover" },
})

export default function DiscoverCirclesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Find your people</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Discover Circles</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Explore public communities, find your corner of Loop, and join the conversation.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-full"><Link href="/communities"><Users className="mr-2 h-4 w-4" />My Circles</Link></Button>
            <Button asChild className="rounded-full"><Link href="/communities/create"><Plus className="mr-2 h-4 w-4" />Create a Circle</Link></Button>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-r from-amber-500/[0.08] via-card/60 to-transparent p-4 text-sm text-muted-foreground">
          <Compass className="mr-2 inline h-4 w-4 text-amber-500" />Already joined circles are kept in <Link href="/communities" className="font-semibold text-foreground underline decoration-amber-500/60 underline-offset-4">My Circles</Link> and won’t appear here.
        </div>
        <DiscoverCommunities />
      </main>
    </div>
  )
}
