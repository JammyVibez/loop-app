import { Metadata } from "next"
import { Enhanced3DProfile } from "@/components/profile/enhanced-3d-profile"
import { Header } from "@/components/header"
import { createClient } from "@supabase/supabase-js"
import { getAbsoluteAppUrl } from "@/lib/app-url"

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

  let title = `@${username} on Loop`
  let description = `Check out @${username}'s profile, loops, and activity on Loop Social OS.`
  let avatarUrl = ""

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, bio, avatar_url")
      .eq("username", username)
      .single()

    if (profile) {
      const name = profile.display_name || username
      title = `${name} (@${username}) — Profile`
      if (profile.bio) description = profile.bio.slice(0, 160)
      avatarUrl = profile.avatar_url || ""
    }
  } catch (err) {
    console.error("Error generating profile metadata:", err)
  }

  const ogImageUrl = `${baseUrl}/api/og?type=profile&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatarUrl)}`

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/profile/${username}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/profile/${username}`,
      type: "profile",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-0 sm:px-4 sm:py-6">
        <Enhanced3DProfile username={username} />
      </main>
    </div>
  )
}
