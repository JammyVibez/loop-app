import Link from "next/link";
import { Header } from "@/components/header";
import { ExploreContent } from "@/components/explore/explore-content";
import { PageHeader } from "@/components/ui/page-header";
import { Film, GitBranch, ArrowRight } from "lucide-react";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams
  const initialTab = params.tab === "chains" ? "deepest" : params.tab === "hashtags" ? "hashtags" : "recent"
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-6">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Discover"
            title="Explore"
            description="Loops, Trees, Reels and the people making them. Everything public, ranked by what people are actually opening."
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/explore/reels"
              className="group flex min-w-0 items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3.5 transition-colors duration-150 hover:border-border hover:bg-muted/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-foreground">
                  <Film className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Reels</p>
                  <p className="truncate text-xs text-muted-foreground">Trending and fresh clips, one swipe at a time</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>

            <Link
              href="/chains"
              className="group flex min-w-0 items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3.5 transition-colors duration-150 hover:border-border hover:bg-muted/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-foreground">
                  <GitBranch className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Trees</p>
                  <p className="truncate text-xs text-muted-foreground">Branch a Loop and keep the thread growing</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          </div>

          <ExploreContent initialTab={initialTab} />
        </div>
      </main>
    </div>
  )
}
