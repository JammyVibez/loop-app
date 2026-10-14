import type { Metadata } from "next"
import type { ReactNode } from "react"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata } from "@/lib/og/metadata"

/** Event page is a client component — metadata is generated here instead. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

interface EventLayoutProps {
  params: Promise<{ id: string }>
  children: ReactNode
}

export async function generateMetadata({ params }: EventLayoutProps): Promise<Metadata> {
  const { id } = await params
  const baseUrl = await getAbsoluteAppUrl()

  let title = "An event on Loop"
  let description = "Events on Loop bring the community together — live, scheduled, and open to members."
  let category = "Event"
  let cover = ""
  let when = ""
  let dateBlock: { day: string; month: string } | undefined

  try {
    const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle()

    if (event) {
      title = String((event as any).title || title)
      description = String((event as any).description || description).slice(0, 170)
      category = String((event as any).category || "Event")
      cover = String((event as any).cover_image || (event as any).banner_url || "")
      const start = (event as any).start_time || (event as any).starts_at
      if (start) {
        const date = new Date(start)
        if (!Number.isNaN(date.getTime())) {
          when = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          dateBlock = {
            day: date.toLocaleDateString("en-US", { day: "numeric" }),
            month: date.toLocaleDateString("en-US", { month: "short" }),
          }
        }
      }
    }
  } catch (err) {
    console.error("Error generating event metadata:", err)
  }

  return buildOgMetadata({
    baseUrl,
    path: `/events/${id}`,
    type: "event",
    title,
    description,
    params: {
      category,
      date: when,
      date_day: dateBlock?.day,
      date_month: dateBlock?.month,
      media: cover,
      name: title,
      url: `loopapp.me/events/${id}`,
    },
  })
}

export default function EventLayout({ children }: EventLayoutProps) {
  return children
}
