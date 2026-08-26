import { Header } from "@/components/header"
import { CirclesList } from "@/components/circles/circles-list"
import { CreateCircleButton } from "@/components/circles/create-circle-button"
import { Users, Zap, MessageSquare, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

// The hero used to show hardcoded "12.4K+ Active Members" / "850+ Daily
// Discussions" marketing numbers with no data behind them. Real counts only
// — and if the community is still small, an honest tagline instead of a
// fabricated number.
async function getCircleStats() {
  try {
    const [{ count: circleCount }, { count: memberCount }, { count: postCount }] = await Promise.all([
      supabase.from("circles").select("id", { count: "exact", head: true }),
      supabase.from("circle_members").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("circle_posts").select("id", { count: "exact", head: true }),
    ])
    return {
      circles: circleCount || 0,
      members: memberCount || 0,
      posts: postCount || 0,
    }
  } catch {
    return { circles: 0, members: 0, posts: 0 }
  }
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+`
  return `${n}`
}

export default async function CirclesPage() {
  const stats = await getCircleStats()
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-cyan-500 selection:text-black">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm">

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">


              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Discover & Build{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  loopapp.me Communities
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Join private or public creator hubs, collaborate on live Co-Loops, share exclusive content, and interact with verified founders and Pro creators worldwide.
              </p>

              {/* Stats Bar — real counts, not marketing numbers */}
              <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-semibold">
                {stats.members >= 25 ? (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <span><strong className="text-white font-extrabold">{formatCount(stats.members)}</strong> Active Members</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-cyan-400" />
                    <span>Communities are just getting started — <strong className="text-white font-extrabold">be one of the first</strong></span>
                  </div>
                )}
                {stats.posts >= 25 && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-400" />
                    <span><strong className="text-white font-extrabold">{formatCount(stats.posts)}</strong> Discussions Started</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span><strong className="text-white font-extrabold">Verified</strong> Host Privileges</span>
                </div>
              </div>
            </div>

            {/* Create Circle Action CTA */}
            <div className="shrink-0 w-full md:w-auto">
              <CreateCircleButton />
            </div>
          </div>
        </div>

        {/* Community List Component */}
        <CirclesList />
      </main>
    </div>
  )
}
