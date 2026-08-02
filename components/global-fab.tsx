"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

const EXCLUDED_PATHS = ["/login", "/signup", "/onboarding", "/create"]

export function GlobalFab() {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user) return null
  if (EXCLUDED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null
  }

  return (
    <div className="fixed bottom-20 right-5 z-50 sm:bottom-8 sm:right-8">
      <Link
        href="/create"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-violet-500/30 hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/40"
        title="Create Post"
      >
        <Plus className="h-7 w-7 stroke-[2.5]" />
        <span className="sr-only">Create Post</span>
      </Link>
    </div>
  )
}
