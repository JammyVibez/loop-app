import Link from "next/link"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { DiscoverCommunities } from "@/components/communities/discover-communities"
import { AdSlot } from "@/components/ads/ad-slot"
import { Globe2, Plus, Users, MessagesSquare, Compass, ArrowRight } from "lucide-react"
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
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[32px] border border-border bg-card">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.3]"
            style={{
              backgroundImage:
                "radial-gradient(90% 120% at 85% -10%, hsl(var(--primary) / 0.22) 0%, transparent 60%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 88px), repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 88px)",
            }}
          />

          <div className="relative px-6 py-12 sm:px-12 sm:py-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              <Globe2 className="h-3.5 w-3.5 text-primary" />
              Communities
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              Worlds people build
              <br />
              <span className="text-muted-foreground/60">together.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Not groups, not feeds — worlds. Each one has its own spaces, projects, challenges and memory,
              shaped by the people inside it.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/communities/create"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create a community
              </Link>
              <Link
                href="#discover"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                <Compass className="h-4 w-4" />
                Explore worlds
              </Link>
            </div>

            <dl className="mt-12 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
              {[
                { id: "communities", label: "Worlds", value: stats.communities, icon: Globe2 },
                { id: "members", label: "Members", value: stats.members, icon: Users },
                { id: "posts", label: "Threads", value: stats.posts, icon: MessagesSquare },
              ].map((stat) => {
                const Icon = stat.icon
                return (
                  <div key={stat.id} className="bg-card px-4 py-4 sm:px-6 sm:py-5">
                    <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {stat.label}
                    </dt>
                    <dd className="mt-1.5 text-2xl font-black tabular-nums tracking-tight sm:text-3xl">
                      {stat.value.toLocaleString()}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </section>

        {/* Discover */}
        <section id="discover" className="mt-12 scroll-mt-20">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Find your world</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every community here is run by someone who started exactly where you are.
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
