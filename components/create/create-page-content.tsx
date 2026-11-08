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
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-14">
        <section className="relative mb-5 overflow-hidden rounded-3xl border border-border/70 bg-card/50">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(520px 240px at 4% -20%, rgba(245,184,61,0.14), transparent 60%), radial-gradient(460px 240px at 76% -30%, rgba(139,92,246,0.16), transparent 62%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent"
          />

          <div className="relative flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/25 to-violet-500/20 shadow-[0_10px_30px_-12px_rgba(245,184,61,0.5)]">
                <Sparkles className="h-5 w-5 text-amber-200" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                  Creator studio
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[2rem]">
                  Make something worth replying to.
                </h1>
                <p className="mt-1.5 max-w-xl text-[12.5px] leading-6 text-muted-foreground sm:text-[13px]">
                  Write a Loop, cut a Reel, drop a Moment or open a room. Media gets a proper edit step
                  before it publishes — crop, colour, trim, mute.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                <Save className="h-3.5 w-3.5 text-emerald-400" />
                Drafts autosave
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-violet-400" />
                5 formats
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200">
                <Wand2 className="h-3.5 w-3.5" />
                {user.is_premium ? "Pro: up to 10 files" : "Up to 4 files"}
              </span>
            </div>
          </div>
        </section>

        <CreateHub defaultTab={defaultTab} />
      </main>
    </div>
  )
}
