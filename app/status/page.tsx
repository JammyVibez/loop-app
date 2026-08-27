import type { Metadata } from "next"
import { StatusPageClient } from "./status-page-client"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "System Status",
  description: "Real-time status and uptime information for Loop (loopapp.me). Check if all systems are operational.",
  openGraph: {
    title: "Loop Status — System Health",
    description: "Real-time status and uptime information for Loop (loopapp.me).",
    type: "website",
  },
}

export default function StatusPage() {
  return <StatusPageClient />
}
