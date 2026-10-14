import Link from "next/link"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { DiscoverCommunities } from "@/components/communities/discover-communities"
import { AdSlot } from "@/components/ads/ad-slot"
import { Globe2, Plus, Users, Flame } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { buildOgMetadata } from "@/lib/og/metadata"

export const dynamic = "force-dynamic"

const SEO_TITLE = "Communities on Loop — worlds people build together"
const SEO_DESCRIPTION =
  "Find a community to join on Loop: circles with their own spaces, projects, challenges and memory. Post together, build something that outlives a thread."

// The index page inherits the site-default card, which says nothing about
// communities. Give it its own so a share of /communities looks intentional.
// Static (not generateMetadata) on purpose: this page streams its shell while
// Supabase is still working, and only metadata known before the first byte is
// guaranteed to land in the head, where crawlers read it.
export const metadata: Metadata = buildOgMetadata({
  baseUrl: (process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/$/, ""),
  path: "/communities",
  type: "community",
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  params: { name: "Communities", category: "Circles", url: "/communities" },
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

async function getStats() {
  try {
    const [{ count: circleCount }, { count: memberCount }, { count: postCount }] = await Promise.all([
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("circle_members").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("circle_posts").select("id", { count: "exact", head: true }),
    ])
    return { communities: circleCount || 0, members: memberCount || 0, posts: postCount || 0 }
  } catch {
    return { communities: 0, members: 0, posts: 0 }
  }
}

export default async function CommunitiesPage() {
  const stats = await getStats()
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-7xl space-y-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                <Globe2 className="h-3.5 w-3.5" />
                Communities — worlds people build together
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                Not just groups.{" "}
                <span className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
                  Living worlds.
                </span>
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg">
                Join a community, participate, create together and watch it evolve. Every world has a
                pulse, spaces, projects, challenges, memory — and a DNA shaped by its members.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/communities/create"
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
                >
                  <Plus className="h-4 w-4" />
                  Create a Community
                </Link>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-indigo-500" />
                    <strong className="text-foreground">{stats.communities.toLocaleString()}</strong> communities
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <strong className="text-foreground">{stats.members.toLocaleString()}</strong> members
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DiscoverCommunities />

        {/* Tasteful sponsored slot (server-gated; never for Pro/Sponsor) */}
        <div className="mx-auto max-w-xl pt-2">
          <AdSlot surface="communities" />
        </div>
      </main>
    </div>
  )
}