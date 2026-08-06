import type { Metadata } from "next"
import { LandingContent } from "@/components/landing/landing-content"

export const metadata: Metadata = {
  title: "Loop — Collaborative Social OS for Creators & Developers",
  description:
    "Loop is a social platform for people who make things — Loops, Reels, live streams, real-time Co-Loop collaboration, Circles, and a Developer Hub with a real Loop Coins economy.",
  alternates: {
    canonical: "/landing",
  },
  openGraph: {
    title: "Loop — Collaborative Social OS for Creators & Developers",
    description:
      "Loops, Reels, live streams, Co-Loop collaboration, Circles, and a Developer Hub — with a real Loop Coins economy.",
    url: "/landing",
  },
}

export default function LandingPage() {
  return <LandingContent />
}
