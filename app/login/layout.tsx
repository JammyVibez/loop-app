import type React from "react"
import type { Metadata } from "next"
import { getAbsoluteAppUrl } from "@/lib/app-url"

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getAbsoluteAppUrl()
  const title = "Log in to Loop"
  const description = "Sign back in to Loop — your loops, circles, and Co-Loop sessions are waiting."
  const ogImageUrl = `${baseUrl}/api/og?type=home&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/login` },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/login`,
      siteName: "Loop Social OS",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, type: "image/png", alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
