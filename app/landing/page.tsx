import type { Metadata } from "next"
import { LandingContent } from "@/components/landing/landing-content"

const title = "loopapp.me — Build together. Not just post into the void."
const description =
  "loopapp.me is where communities create in real time — co-write posts live with friends, settle debates in public Duels, and build spaces that are actually yours."

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/landing",
  },
  openGraph: {
    title,
    description,
    url: "/landing",
    siteName: "loopapp.me",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
}

export default function LandingPage() {
  return <LandingContent />
}
