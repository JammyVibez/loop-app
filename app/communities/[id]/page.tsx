import { Metadata } from "next"
import { Header } from "@/components/header"
import { CommunityWorld } from "@/components/communities/community-world"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata } from "@/lib/og/metadata"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

interface CommunityPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: CommunityPageProps): Promise<Metadata> {
  const { id } = await params
  const baseUrl = await getAbsoluteAppUrl()

  let title = "Community — Loop Social OS"
  let description = "Join a community on Loop Social OS, build together, and watch it evolve."
  let avatarUrl = ""
  let bannerUrl = ""
  let communityName = ""
  let category = ""
  let isPrivate = false
  let isVerified = false
  let memberCount = 0

  try {
    const [{ data: circle }, { count }] = await Promise.all([
      supabase
        .from("circles")
        .select("name, description, avatar_url, banner_url, category, is_private, is_verified")
        .eq("id", id)
        .single(),
      supabase
        .from("circle_members")
        .select("id", { count: "exact", head: true })
        .eq("circle_id", id)
        .eq("status", "active"),
    ])

    if (circle) {
      title = `${circle.name} — Community on Loop`
      if (circle.description) description = circle.description.slice(0, 160)
      avatarUrl = circle.avatar_url || ""
      communityName = circle.name || ""
      bannerUrl = (circle as any).banner_url || ""
      category = circle.category || ""
      isPrivate = Boolean(circle.is_private)
      isVerified = Boolean(circle.is_verified)
    }
    memberCount = count || 0
  } catch (err) {
    console.error("Error generating community metadata:", err)
  }

  return buildOgMetadata({
    baseUrl,
    path: `/communities/${id}`,
    type: "community",
    title,
    description,
    params: {
      name: communityName,
      avatar: avatarUrl,
      media: bannerUrl,
      category,
      is_private: isPrivate,
      verified: isVerified,
      stat: memberCount || undefined,
      stat_label: memberCount === 1 ? "member" : "members",
      url: `loopapp.me/communities/${id}`,
    },
  })
}

export default async function CommunityWorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-7xl">
        <CommunityWorld communityId={id} />
      </main>
    </div>
  )
}
