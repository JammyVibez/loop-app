import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase"

/**
 * Server-side existence gate for every /profile/[username] route
 * (profile, followers, following).
 *
 * A username that doesn't exist must return a REAL HTTP 404, not a 200 with
 * a client-rendered "not found" message — otherwise OSINT tools (Sherlock)
 * treat every probe as a hit, and search engines index soft-404s.
 *
 * Deleted and suspended accounts intentionally pass through: the app masks
 * them ("Deleted Account" / "Suspended User") and metadata marks them
 * noindex, so they stay 200-by-design without leaking profile data.
 */
export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle()

  if (!profile) notFound()

  return <>{children}</>
}
