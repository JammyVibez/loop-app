import type { Metadata } from "next"
import { DownloadPageClient } from "@/components/download-page-client"

export const metadata: Metadata = {
  title: "Download Loop — Native Apps",
  description:
    "Download the Loop app for Android. iOS coming soon. Build together, not just post into the void.",
  openGraph: {
    title: "Download Loop — Native Apps",
    description: "Get the Loop app on your device.",
  },
}

export default function DownloadPage() {
  return <DownloadPageClient />
}
