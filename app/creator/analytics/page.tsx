"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { CreatorAnalytics } from "@/components/creator/creator-analytics"

export default function CreatorAnalyticsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Back bar */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>

        {/* Analytics Dashboard */}
        <CreatorAnalytics />
      </div>
    </div>
  )
}
