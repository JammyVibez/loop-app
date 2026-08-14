import type React from "react"
import type { Metadata } from "next"
import { getAbsoluteAppUrl } from "@/lib/app-url"

// app/signup/page.tsx is a client component (uses useSearchParams, local
// state), so it can't export generateMetadata itself — it silently
// inherited the generic homepage title/description/OG image instead of
// anything tailored to "you've been invited to loopapp.me", which is what most
// people actually see when someone shares a referral link.
export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getAbsoluteAppUrl()
  const title = "Join loopapp.me — Build together. Not just post into the void."
  const description =
    "loopapp.me is where communities create in real time — co-write posts live with friends, settle debates in public Duels, and build spaces that are actually yours."
  const ogImageUrl = `${baseUrl}/api/og?type=home&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/signup` },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/signup`,
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

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
