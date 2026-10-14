import type { Metadata } from "next"
import type { ReactNode } from "react"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata, personParam } from "@/lib/og/metadata"

/**
 * The project page itself is a client component, so its metadata lives here.
 * A layout receives the same route params and can fetch server-side, which
 * keeps the share card dynamic without rewriting the page.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

interface ProjectLayoutProps {
  params: Promise<{ id: string }>
  children: ReactNode
}

export async function generateMetadata({ params }: ProjectLayoutProps): Promise<Metadata> {
  const { id } = await params
  const baseUrl = await getAbsoluteAppUrl()

  let title = "A project on Loop Developers"
  let description = "Browse projects, share code and collaborate with other builders on Loop."
  let owner = ""
  let avatar = ""
  let language = ""
  const stats: string[] = []

  try {
    const { data: project } = await supabase.from("developer_projects").select("*").eq("id", id).maybeSingle()

    if (project && (project as any).is_public !== false) {
      title = String((project as any).title || title)
      description = String((project as any).description || description).slice(0, 170)
      language = String((project as any).language || "")
      const authorId = (project as any).author_id || (project as any).user_id
      const stars = Number((project as any).stars || 0)
      const forks = Number((project as any).forks || 0)
      const views = Number((project as any).views || 0)
      if (stars) stats.push(`${stars}|stars`)
      if (forks) stats.push(`${forks}|forks`)
      if (views) stats.push(`${views}|views`)

      if (authorId) {
        const { data: author } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_url")
          .eq("id", authorId)
          .maybeSingle()
        if (author) {
          owner = String((author as any).display_name || (author as any).username || "")
          avatar = String((author as any).avatar_url || "")
        }
      }
    }
  } catch (err) {
    console.error("Error generating project metadata:", err)
  }

  return buildOgMetadata({
    baseUrl,
    path: `/developers/${id}`,
    type: "project",
    title,
    description,
    params: {
      name: owner,
      avatar,
      category: language,
      stats: stats.join(","),
      p1: personParam(owner, avatar),
      url: `loopapp.me/developers/${id}`,
    },
  })
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  return children
}
