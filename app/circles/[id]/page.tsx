import { Metadata } from "next"
import { Header } from "@/components/header"
import { EnhancedCircleDetail } from "@/components/circles/enhanced-circle-detail"
import { createClient } from "@supabase/supabase-js"
import { getAbsoluteAppUrl } from "@/lib/app-url"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

interface CirclePageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: CirclePageProps): Promise<Metadata> {
  const { id } = await params
  const baseUrl = await getAbsoluteAppUrl()

  let title = "Circle Community — Loop"
  let description = "Join this Circle community on Loop Social OS to connect and collaborate."

  try {
    const { data: circle } = await supabase
      .from("circles")
      .select("name, description")
      .eq("id", id)
      .single()

    if (circle) {
      title = `${circle.name} Circle — Loop Community`
      if (circle.description) description = circle.description.slice(0, 160)
    }
  } catch (err) {
    console.error("Error generating circle metadata:", err)
  }

  const ogImageUrl = `${baseUrl}/api/og?type=circle&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/circles/${id}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/circles/${id}`,
      type: "website",
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

export default async function CirclePage({ params }: CirclePageProps) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <EnhancedCircleDetail circleId={id} />
      </main>
    </div>
  )
}
