"use client"

import { Header } from "@/components/header"
import { CreateHub, type CreateTab } from "@/components/create/create-hub"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Layers, Save, Sparkles, Wand2 } from "lucide-react"

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
      <main className="create-studio mx-auto w-full max-w-[1440px] px-3 pb-24 pt-4 sm:px-6 sm:pb-14 sm:pt-7 lg:px-8">
        <section className="create-studio-hero relative mb-5 overflow-hidden rounded-[28px] border border-border/70">
          <div aria-hidden className="create-studio-hero-glow pointer-events-none absolute inset-0" />
          <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/50 to-cyan-200/40" />

          <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between lg:px-9 lg:py-8">
            <div className="flex min-w-0 items-start gap-4">
              <span className="create-studio-mark flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet-400/25 via-indigo-400/15 to-cyan-300/15 shadow-[0_12px_36px_-16px_rgba(124,92,255,0.75)]">
                <Sparkles className="h-5 w-5 text-violet-200" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Creator studio <span aria-hidden className="hidden h-px w-6 bg-gradient-to-r from-violet-400/70 to-cyan-300/70 sm:block" />
                  <span className="hidden tracking-[0.14em] sm:inline">A space for the unfinished</span>
                </p>
                <h1 className="mt-2 max-w-3xl text-[clamp(1.65rem,3vw,2.65rem)] font-semibold leading-[1.06] tracking-[-0.045em] text-foreground">
                  Make something <span className="bg-gradient-to-r from-violet-300 via-indigo-200 to-cyan-200 bg-clip-text text-transparent">worth replying to.</span>
                </h1>
                <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-muted-foreground sm:text-[13px]">
                  A thought, a frame, a room full of people. Start with the format that fits — refine it before it goes live.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[10.5px] font-medium text-muted-foreground backdrop-blur-xl">
                <Save className="h-3.5 w-3.5 text-emerald-300" /> Drafts autosave
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[10.5px] font-medium text-muted-foreground backdrop-blur-xl">
                <Layers className="h-3.5 w-3.5 text-violet-300" /> 5 formats
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/[0.08] px-3 py-2 text-[10.5px] font-semibold text-violet-100">
                <Wand2 className="h-3.5 w-3.5" />
                {user.is_premium ? "Pro · up to 10 files" : user.is_verified ? "Up to 4 files" : "Up to 1 file"}
              </span>
            </div>
          </div>
        </section>

        <CreateHub defaultTab={defaultTab} />
      </main>
    </div>
  )
}
