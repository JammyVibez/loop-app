"use client"

import { Header } from "@/components/header"
import { CreateHub, type CreateTab } from "@/components/create/create-hub"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Save, Sparkles } from "lucide-react"

export function CreatePageContent({ defaultTab = "loop" }: { defaultTab?: CreateTab }) {
  const { user, loading, authResolved } = useAuth()
  const router = useRouter()

  // Only bounce to sign-in once the session check has actually *concluded*
  // that nobody is signed in. Firing on `!user` alone redirected signed-in
  // users to /login whenever their session lookup was still in flight or had
  // failed transiently — which is exactly what a page refresh used to do.
  useEffect(() => {
    if (!loading && authResolved && !user) {
      // Preserve where they were headed so signing in lands them back here.
      router.replace("/login?redirect=/create")
    }
  }, [user, loading, authResolved, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-900/20">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Studio
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Create
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
                Publish a Loop, cut a Reel, or open a Co-Loop room. Your draft is
                saved locally as you type, so a refresh never costs you the post.
              </p>
            </div>
          </div>

          <span className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-2 text-[11px] font-semibold text-muted-foreground sm:inline-flex">
            <Save className="h-3.5 w-3.5 text-emerald-500" />
            Drafts save automatically
          </span>
        </div>

        <CreateHub defaultTab={defaultTab} />
      </main>
    </div>
  )
}
