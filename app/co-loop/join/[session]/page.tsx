import type { Metadata } from "next"
import { CoLoopJoinLanding } from "@/components/loops/co-loop-join-landing"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata, personParam } from "@/lib/og/metadata"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

interface PageProps {
  params: Promise<{ session: string }>
  searchParams: Promise<{ invitedBy?: string; inviter?: string }>
}

/** Co-Loop invites preview with the topic and the creators already in it. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { session } = await params
  const baseUrl = await getAbsoluteAppUrl()
  let title = "Join a Co-Loop session on Loop"
  let description = "Co-Loop is live co-writing: two to four creators build one post together, in real time."
  let status = "Open invite"
  let host = ""
  let avatar = ""
  const people: string[] = []

  try {
    if (session && !session.startsWith("demo-")) {
      const { data: row } = await supabase
        .from("co_loop_sessions")
        .select("open_invite_topic, status, owner_username, owner_id, co_authors, max_collaborators")
        .eq("session_id", session)
        .maybeSingle()

      if (row) {
        const topic = String((row as any).open_invite_topic || "").trim()
        host = String((row as any).owner_username || "")
        if (topic) title = topic
        const state = String((row as any).status || "")
        status = state === "ended" ? "Session ended" : state === "published" ? "Published" : "Open invite"
        const authors = Array.isArray((row as any).co_authors) ? (row as any).co_authors : []
        for (const author of authors.slice(0, 4)) {
          const profile = author?.profiles || author
          const encoded = personParam(profile?.display_name || profile?.username, profile?.avatar_url)
          if (encoded) people.push(encoded)
        }
        if (!people.length && host) people.push(host)

        // The host's avatar anchors the card; their screen name reads better
        // than the raw handle when the topic is empty.
        const ownerId = (row as any).owner_id
        if (ownerId) {
          const { data: owner } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("id", ownerId)
            .maybeSingle()
          if (owner) {
            avatar = String((owner as any).avatar_url || "")
            host = String((owner as any).display_name || (owner as any).username || host)
          }
        }
      }
    }
  } catch (err) {
    console.error("Error generating Co-Loop metadata:", err)
  }

  return buildOgMetadata({
    baseUrl,
    path: `/co-loop/join/${session}`,
    type: "coloop",
    title,
    description,
    params: {
      name: host || "Co-Loop",
      avatar,
      date: status,
      people: people.join(","),
      url: `loopapp.me/co-loop/join/${session}`,
    },
  })
}

export default async function CoLoopJoinSessionPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const session = resolvedParams?.session || "demo-session-1"
  const invitedBy = resolvedSearchParams?.invitedBy || resolvedSearchParams?.inviter || ""

  return <CoLoopJoinLanding sessionId={session} invitedByUsername={invitedBy} />
}
