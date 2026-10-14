import type { Metadata } from "next"
import { DownloadPageClient } from "@/components/download-page-client"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata } from "@/lib/og/metadata"

const TITLE = "Download Loop — Native Apps"
const DESCRIPTION =
  "Download the Loop app for Android. iOS coming soon. Build together, not just post into the void."

// Handing over an openGraph block without images used to blank the og:image
// out (metadata does not merge page-by-page), so downloads shared as links.
export async function generateMetadata(): Promise<Metadata> {
  return buildOgMetadata({
    baseUrl: await getAbsoluteAppUrl(),
    path: "/download",
    type: "home",
    title: TITLE,
    description: DESCRIPTION,
  })
}

export default function DownloadPage() {
  return <DownloadPageClient />
}
