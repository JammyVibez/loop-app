import Link from "next/link"
import { Header } from "@/components/header"
import { ExploreContent, type ExploreTab } from "@/components/explore/explore-content"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Film, GitBranch } from "lucide-react"

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams
  const requestedTab = params.tab === "chains" ? "deepest" : params.tab
  const validTabs: ExploreTab[] = [
    "events",
    "recent",
    "personalized",
    "following",
    "community",
    "deepest",
    "creative",
    "hashtags",
  ]
  const initialTab = validTabs.includes(requestedTab as ExploreTab) ? (requestedTab as ExploreTab) : "recent"
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-7">
        <div className="space-y-4">
          <PageHeader
            eyebrow="Discover"
            title="Explore"
            description="Find a loop worth joining, a creator worth following, or a corner of Loop you haven't seen yet."
            actions={
              <>
                <Button asChild variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs">
                  <Link href="/explore/reels">
                    <Film className="mr-1.5 h-3.5 w-3.5" />
                    Reels
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs">
                  <Link href="/chains">
                    <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                    Trees
                  </Link>
                </Button>
              </>
            }
          />

          <ExploreContent initialTab={initialTab} />
        </div>
      </main>
    </div>
  )
}
