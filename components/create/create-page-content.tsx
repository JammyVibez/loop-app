"use client"

import { Header } from "@/components/header"
import { CreateHub, type CreateTab } from "@/components/create/create-hub"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Sparkles } from "lucide-react"

export function CreatePageContent({ defaultTab = "loop" }: { defaultTab?: CreateTab }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {/* Studio header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-900/30">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Create
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Publish a Loop, a Reel, or go live — your draft is saved automatically.
              </p>
            </div>
          </div>
        </div>
        <CreateHub defaultTab={defaultTab} />
      </main>
    </div>
  )
}
