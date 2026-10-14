import { Metadata } from "next"
import { Enhanced3DProfile } from "@/components/profile/enhanced-3d-profile"
import { Header } from "@/components/header"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { stripCircleBioTokens } from "@/lib/circle-bio-tokens"
import { profileStatus } from "@/lib/user-status"
import { buildOgMetadata } from "@/lib/og/metadata"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

interface ProfilePageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params
  const baseUrl = await getAbsoluteAppUrl()

  let title = `@${username} on loopapp.me`
  let description = `Check out @${username}'s profile, loops, and activity on Loop Social OS.`
  let avatarUrl = ""
  let isVerified = false
  let followersCount = 0
  let displayName = ""

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, bio, avatar_url, is_verified, followers_count, is_deleted, deletion_executed_at, is_banned")
      .eq("username", username)
      .single()

    // Deleted / suspended accounts are 200-by-design (the client renders a
    // masked profile) — tell crawlers not to index them instead of soft-404s.
    const status = profileStatus(profile as any)
    if (status !== "active") {
      return {
        title: status === "deleted" ? "Account deleted — loopapp.me" : "Account suspended — loopapp.me",
        description: "This account is no longer available.",
        robots: { index: false, follow: false } as const,
      }
    }

    if (profile) {
      const name = profile.display_name || username
      displayName = name
      title = `${name} (@${username}) — Profile`
      if (profile.bio) description = stripCircleBioTokens(profile.bio).slice(0, 160)
      avatarUrl = profile.avatar_url || ""
      isVerified = Boolean(profile.is_verified)
      followersCount = Number(profile.followers_count || 0)
    }
  } catch (err) {
    console.error("Error generating profile metadata:", err)
  }

  return buildOgMetadata({
    baseUrl,
    path: `/profile/${username}`,
    type: "profile",
    title,
    description,
    ogType: "profile",
    params: {
      name: displayName,
      username,
      avatar: avatarUrl,
      verified: isVerified,
      stat: followersCount || undefined,
      stat_label: followersCount === 1 ? "follower" : "followers",
      url: `loopapp.me/profile/${username}`,
    },
  })
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  const baseUrl = await getAbsoluteAppUrl()

  // Load profile details for structured data (ProfilePage/Person schema).
  let displayName = username
  let bio = ""
  let avatarUrl = ""
  let followersCount = 0

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, bio, avatar_url, followers_count")
      .eq("username", username)
      .single()

    if (profile) {
      displayName = profile.display_name || username
      bio = profile.bio ? stripCircleBioTokens(profile.bio).slice(0, 160) : ""
      avatarUrl = profile.avatar_url || ""
      followersCount = Number(profile.followers_count || 0)
    }
  } catch (err) {
    console.error("Error loading profile for structured data:", err)
  }

  const person: Record<string, unknown> = {
    "@type": "Person",
    name: displayName,
    alternateName: `@${username}`,
    url: `${baseUrl}/profile/${username}`,
  }
  if (avatarUrl) person.image = avatarUrl
  if (bio) person.description = bio
  if (followersCount > 0) {
    person.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/FollowAction",
      userInteractionCount: followersCount,
    }
  }

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-0 sm:px-4 sm:py-6">
        {/* Schema.org structured data: ProfilePage + Person */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }}
        />
        <Enhanced3DProfile username={username} />
      </main>
    </div>
  )
}
