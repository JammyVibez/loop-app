import Link from "next/link"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { DiscoverCommunities } from "@/components/communities/discover-communities"
import { AdSlot } from "@/components/ads/ad-slot"
import { Globe2, Plus, Users, MessagesSquare, Compass, ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
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
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader
          eyebrow="Circles"
          title="Circles"
          description="A Circle is a smaller Loop: its own rooms, its own people, its own rules. Join one to post inside it, or start one and invite the people you already build with."
          actions={
            <>
              <Link
                href="/communities/create"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create a Circle
              </Link>
              <Link
                href="#discover"
                className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3.5 py-2 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted"
              >
                <Compass className="h-4 w-4" />
                Browse
              </Link>
            </>
          }
        />

        <dl className="mt-6 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70">
          {[
            { id: "communities", label: "Circles", value: stats.communities, icon: Globe2 },
            { id: "members", label: "Members", value: stats.members, icon: Users },
            { id: "posts", label: "Threads", value: stats.posts, icon: MessagesSquare },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.id} className="bg-card px-4 py-3.5 sm:px-5">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {stat.label}
                </dt>
                <dd className="loop-stat mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {stat.value.toLocaleString()}
                </dd>
              </div>
            )
          })}
        </dl>

        {/* Discover */}
        <section id="discover" className="mt-10 scroll-mt-20">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">Find your Circle</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Smaller rooms, slower threads, the same people showing up.
              </p>
            </div>
            <Link
              href="/communities/create"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Or start your own <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <DiscoverCommunities />
        </section>

        {/* Tasteful sponsored slot (server-gated; never for Pro/Sponsor) */}
        <div className="mx-auto max-w-xl pt-10">
          <AdSlot surface="communities" />
        </div>
      </main>
    </div>
  )
}
