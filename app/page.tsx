import type { Metadata } from "next"
import { HomePageClient } from "@/components/home-page-client"

export const metadata: Metadata = {
  title: "loopapp.me - Next-Gen Collaborative Social OS",
  description:
    "Connect, create, and collaborate in the loopapp.me ecosystem with live streams, real-time co-loops, interactive circles, and gamified reward economies.",
  alternates: {
    canonical: "/",
  },
}

export default function HomePage() {
  return <HomePageClient />
}
