"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

const EXCLUDED_PATHS = ["/login", "/signup", "/onboarding"]

export function GlobalFab() {
  const pathname = usePathname()

  if (EXCLUDED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-6 sm:right-6">
      <Link
        href="/create"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-2xl shadow-violet-500/40 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-500/40 border border-white/20"
        title="Create New Post / Loop"
      >
        <Plus className="h-7 w-7 stroke-[2.5]" />
        <span className="sr-only">Create New Post</span>
      </Link>
    </div>
  )
}
